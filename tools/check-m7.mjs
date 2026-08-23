import fs from "node:fs/promises";
import path from "node:path";
import { adminAuthorized } from "../functions/_lib/b2.js";
import {
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  issueAdminSession,
  verifyAdminSession
} from "../functions/_lib/admin-session.js";
import { adminCooldown, registerAdminFailure } from "../functions/_lib/admin-throttle.js";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");
const env={
  SG_ADMIN_TOKEN:"correct-horse-battery-staple",
  SG_MEDIA_SIGNING_SECRET:"shadow-garden-ci-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ"
};

async function checkAdminSession(){
  if(ADMIN_SESSION_TTL_SECONDS!==3600)fail("Garden Keeper session TTL must remain one hour");
  const session=await issueAdminSession(env,1_000_000);
  const cookie=adminSessionCookie(session);
  for(const marker of ["HttpOnly","Secure","SameSite=Strict","Path=/admin-api","Max-Age=3600"]){
    if(!cookie.includes(marker))fail(`admin session cookie is missing ${marker}`);
  }
  if(!(await verifyAdminSession(env,cookie,1_000_060)).valid)fail("fresh Garden Keeper session did not verify");
  if((await verifyAdminSession(env,cookie,session.expiresAt+1)).valid)fail("expired Garden Keeper session must not verify");

  const validRequest=new Request("https://shadow.example/admin-api/status",{headers:{authorization:`Bearer ${env.SG_ADMIN_TOKEN}`,cookie}});
  if(!(await adminAuthorized(validRequest,env)))fail("admin API must accept the correct token plus a valid Garden Keeper session");
  const noSession=new Request("https://shadow.example/admin-api/status",{headers:{authorization:`Bearer ${env.SG_ADMIN_TOKEN}`}});
  if(await adminAuthorized(noSession,env))fail("admin API must reject a correct token without the Garden Keeper session");
  const wrongToken=new Request("https://shadow.example/admin-api/status",{headers:{authorization:"Bearer wrong",cookie}});
  if(await adminAuthorized(wrongToken,env))fail("admin API must reject an invalid token even with a valid Garden Keeper session");
}

async function checkCooldown(){
  let cookie="";
  const first=await registerAdminFailure(env,cookie,2_000_000);
  if(first.retryAfterSeconds!==0)fail("the first failed unlock should not impose a cooldown");
  cookie=first.cookie;
  const second=await registerAdminFailure(env,cookie,2_000_001);
  if(second.retryAfterSeconds!==5)fail("the second failed unlock should impose a 5 second cooldown");
  cookie=second.cookie;
  const active=await adminCooldown(env,cookie,2_000_001);
  if(!active.blocked||active.retryAfterSeconds!==5)fail("signed cooldown state must block during its active interval");
  const recovered=await adminCooldown(env,cookie,2_000_006);
  if(recovered.blocked)fail("Garden Keeper cooldown must recover after the wait expires");
}

async function checkWiring(){
  const [endpoint,client,b2,human,routes,robots,headers,roadmap]=await Promise.all([
    read("functions/admin-access.js"),
    read("src/assets/js/admin-security.js"),
    read("functions/_lib/b2.js"),
    read("functions/_lib/human-session.js"),
    read("src/_routes.json"),
    read("src/robots.txt"),
    read("src/_headers"),
    read("SECURITY_ROADMAP.md")
  ]);
  for(const marker of ["ADMIN_ACCESS_ACTION","verifyTurnstileToken","adminTokenMatches","adminCooldown","registerAdminFailure","issueAdminSession","Retry-After","Access denied. Please try again."]){
    if(!endpoint.includes(marker))fail(`admin-access endpoint is missing ${marker}`);
  }
  for(const marker of ["/admin-access","turnstile.render","admin_access","allowLegacyUnlockOnce","Retry-After"]){
    if(!client.includes(marker))fail(`admin-security client is missing ${marker}`);
  }
  if(!b2.includes("verifyAdminSession")||!b2.includes("adminTokenMatches"))fail("admin API authorization must require token and signed Garden Keeper session");
  if(!human.includes("expectedAction = HUMAN_ACCESS_ACTION"))fail("Turnstile verifier must support an admin-specific action while preserving book_access by default");
  const routeConfig=JSON.parse(routes);
  if(!routeConfig.include?.includes("/admin-access"))fail("_routes.json must route /admin-access through Pages Functions");
  if(!robots.includes("Disallow: /admin-access"))fail("robots.txt must exclude /admin-access");
  if(!headers.includes("/assets/js/admin-security.js")||!headers.includes("Cache-Control: no-store"))fail("Garden Keeper security client must be served no-store");
  if(!roadmap.includes("7. Garden Keeper hardening | 🟨 In progress"))fail("Milestone 7 must be recorded as in progress");

  const protectedEndpoints=["status.js","library.js","catalog.js","upload.js","backup.js","maintenance.js","series-banner.js"];
  for(const file of protectedEndpoints){
    const source=await read(`functions/admin-api/${file}`);
    if(!source.includes("adminAuthorized"))fail(`${file} must remain behind adminAuthorized`);
  }
}

await checkAdminSession();
await checkCooldown();
await checkWiring();
if(failures.length){
  console.error(`Shadow Garden Milestone 7 check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden Milestone 7 Garden Keeper hardening checks passed.");
}
