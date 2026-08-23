import fs from "node:fs/promises";
import path from "node:path";
import { adminAuthorized } from "../functions/_lib/b2.js";
import {
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  issueAdminSession,
  verifyAdminSession
} from "../functions/_lib/admin-session.js";
import {
  adminCooldown,
  adminThrottleClientId,
  clearAdminFailureState,
  registerAdminFailure
} from "../functions/_lib/admin-throttle.js";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");
const env={
  SG_ADMIN_TOKEN:"correct-horse-battery-staple",
  SG_MEDIA_SIGNING_SECRET:"shadow-garden-ci-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ"
};

function memoryStore(){
  const values=new Map();
  return {
    values,
    async get(key){return values.get(key)??null},
    async put(key,value){values.set(key,String(value))},
    async delete(key){values.delete(key)}
  };
}

function client(ip,cookie=""){
  return new Request("https://shadow.example/admin-access",{
    method:"POST",
    headers:{
      "cf-connecting-ip":ip,
      "user-agent":"Mozilla/5.0 Test Browser",
      ...(cookie?{cookie}:{})
    }
  });
}

async function checkAdminSession(){
  if(ADMIN_SESSION_TTL_SECONDS!==3600)fail("Garden Keeper session TTL must remain one hour");

  const fixedSession=await issueAdminSession(env,1_000_000);
  const fixedCookie=adminSessionCookie(fixedSession);
  for(const marker of ["HttpOnly","Secure","SameSite=Strict","Path=/admin-api","Max-Age=3600"]){
    if(!fixedCookie.includes(marker))fail(`admin session cookie is missing ${marker}`);
  }
  if(!(await verifyAdminSession(env,fixedCookie,1_000_060)).valid)fail("fresh Garden Keeper session did not verify");
  if((await verifyAdminSession(env,fixedCookie,fixedSession.expiresAt+1)).valid)fail("expired Garden Keeper session must not verify");

  const liveSession=await issueAdminSession(env);
  const liveCookie=adminSessionCookie(liveSession);
  const validRequest=new Request("https://shadow.example/admin-api/status",{headers:{authorization:`Bearer ${env.SG_ADMIN_TOKEN}`,cookie:liveCookie}});
  if(!(await adminAuthorized(validRequest,env)))fail("admin API must accept the correct token plus a valid Garden Keeper session");
  const noSession=new Request("https://shadow.example/admin-api/status",{headers:{authorization:`Bearer ${env.SG_ADMIN_TOKEN}`}});
  if(await adminAuthorized(noSession,env))fail("admin API must reject a correct token without the Garden Keeper session");
  const wrongToken=new Request("https://shadow.example/admin-api/status",{headers:{authorization:"Bearer wrong",cookie:liveCookie}});
  if(await adminAuthorized(wrongToken,env))fail("admin API must reject an invalid token even with a valid Garden Keeper session");
}

async function checkCooldown(){
  const store=memoryStore();
  const normal=client("203.0.113.24","sg_admin_failures=old-browser-state");
  const incognito=client("203.0.113.24");
  const otherNetwork=client("198.51.100.77");
  const normalId=await adminThrottleClientId(env,normal);
  const incognitoId=await adminThrottleClientId(env,incognito);
  const otherId=await adminThrottleClientId(env,otherNetwork);
  if(normalId!==incognitoId)fail("normal and Incognito sessions from the same IP must share the server throttle identity");
  if(normalId===otherId)fail("different client IPs must not share the same throttle identity");

  const first=await registerAdminFailure(env,normal,2_000_000,store);
  if(first.retryAfterSeconds!==0)fail("the first failed unlock should not impose a cooldown");
  if(first.storage!=="server")fail("Garden Keeper failure state must identify server storage as authoritative");

  const second=await registerAdminFailure(env,incognito,2_000_001,store);
  if(second.retryAfterSeconds!==5)fail("an Incognito retry from the same IP must inherit the second-attempt 5 second cooldown");
  if([...store.values.keys()].some(key=>key.includes("203.0.113.24")))fail("persisted server throttle keys must be HMAC-derived rather than raw IP values");

  const active=await adminCooldown(env,incognito,2_000_001,store);
  if(!active.blocked||active.retryAfterSeconds!==5)fail("server cooldown must block a fresh browser session on the same IP");
  const other=await adminCooldown(env,otherNetwork,2_000_001,store);
  if(other.blocked||other.failures!==0)fail("a different network must not inherit another IP's Garden Keeper failures");
  const recovered=await adminCooldown(env,normal,2_000_006,store);
  if(recovered.blocked)fail("Garden Keeper cooldown must recover after the wait expires");

  await clearAdminFailureState(env,normal,store);
  const cleared=await adminCooldown(env,incognito,2_000_006,store);
  if(cleared.blocked||cleared.failures!==0)fail("successful authentication must clear server-side failure state for that client identity");
}

async function checkWiring(){
  const [endpoint,client,b2,human,throttle,routes,robots,headers,roadmap,guide]=await Promise.all([
    read("functions/admin-access.js"),
    read("src/assets/js/admin-security.js"),
    read("functions/_lib/b2.js"),
    read("functions/_lib/human-session.js"),
    read("functions/_lib/admin-throttle.js"),
    read("src/_routes.json"),
    read("src/robots.txt"),
    read("src/_headers"),
    read("SECURITY_ROADMAP.md"),
    read("MILESTONE_7_GARDEN_KEEPER.md")
  ]);
  for(const marker of ["ADMIN_ACCESS_ACTION","verifyTurnstileToken","adminTokenMatches","adminCooldown(env, request)","registerAdminFailure(env, request)","clearAdminFailureState(env, request)","issueAdminSession","Retry-After","X-SG-Admin-Throttle","Access denied. Please try again."]){
    if(!endpoint.includes(marker))fail(`admin-access endpoint is missing ${marker}`);
  }
  if(endpoint.includes('adminCooldown(env, request.headers.get("cookie"))')||endpoint.includes('registerAdminFailure(env, request.headers.get("cookie"))')){
    fail("Garden Keeper cooldown must not use browser cookies as the authoritative failure store");
  }
  for(const marker of ["/admin-access","turnstile.render","admin_access","allowLegacyUnlockOnce","Retry-After"]){
    if(!client.includes(marker))fail(`admin-security client is missing ${marker}`);
  }
  if(!b2.includes("verifyAdminSession")||!b2.includes("adminTokenMatches"))fail("admin API authorization must require token and signed Garden Keeper session");
  if(!human.includes("expectedAction = HUMAN_ACCESS_ACTION"))fail("Turnstile verifier must support an admin-specific action while preserving book_access by default");
  for(const marker of ["STATE_PREFIX","shadow-garden/security/admin-throttle/","cf-connecting-ip","writeClient","getTextObject","putObject","deleteObject","adminThrottleClientId","storage: \"server\""]){
    if(!throttle.includes(marker))fail(`server-side Garden Keeper throttle is missing ${marker}`);
  }
  const routeConfig=JSON.parse(routes);
  if(!routeConfig.include?.includes("/admin-access"))fail("_routes.json must route /admin-access through Pages Functions");
  if(!robots.includes("Disallow: /admin-access"))fail("robots.txt must exclude /admin-access");
  if(!headers.includes("/assets/js/admin-security.js")||!headers.includes("Cache-Control: no-store"))fail("Garden Keeper security client must be served no-store");
  if(!roadmap.includes("7. Garden Keeper hardening | ✅ Done"))fail("Milestone 7 must remain recorded as done after acceptance");
  for(const marker of ["server-side","Incognito","CF-Connecting-IP","raw IP","Backblaze B2"]){
    if(!guide.includes(marker))fail(`Milestone 7 guide is missing ${marker}`);
  }

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
  console.log("Shadow Garden Milestone 7 server-side Garden Keeper hardening checks passed.");
}
