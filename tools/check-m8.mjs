import fs from "node:fs/promises";
import path from "node:path";
import {
  ABUSE_COOLDOWN_SECONDS,
  ABUSE_SCORE_LIMIT,
  ABUSE_SIGNAL_WEIGHTS,
  ABUSE_WINDOW_SECONDS,
  abuseClientId,
  abuseCooldown,
  loadAbuseOverview,
  recordSecurityEvent,
  registerAbuseSignal,
  releaseAbuseClient
} from "../functions/_lib/abuse-telemetry.js";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");
const env={SG_MEDIA_SIGNING_SECRET:"shadow-garden-ci-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ"};

function memoryStore(){
  const values=new Map();
  return{
    values,
    async get(key){return values.get(key)??null},
    async put(key,value){values.set(key,String(value))},
    async delete(key){values.delete(key)}
  };
}
function client(ip,cookie=""){
  return new Request("https://shadow.example/book-access",{headers:{
    "cf-connecting-ip":ip,
    "user-agent":"Mozilla/5.0 Test Browser",
    ...(cookie?{cookie}:{})
  }});
}

async function checkTripwire(){
  if(ABUSE_WINDOW_SECONDS!==900)fail("M8 abuse window must remain 15 minutes");
  if(ABUSE_SCORE_LIMIT!==12)fail("M8 public abuse score limit must remain 12");
  if(ABUSE_COOLDOWN_SECONDS!==600)fail("M8 public cooldown must remain 10 minutes");
  if(ABUSE_SIGNAL_WEIGHTS.acquisition_limited!==12)fail("M5 acquisition-limit activation must immediately trip M8");

  const store=memoryStore();
  const normal=client("203.0.113.50","sg_anything=1");
  const incognito=client("203.0.113.50");
  const other=client("198.51.100.88");
  const normalId=await abuseClientId(env,normal);
  if(normalId!==await abuseClientId(env,incognito))fail("same-network normal and Incognito sessions must share the M8 identity");
  if(normalId===await abuseClientId(env,other))fail("different networks must have different M8 identities");

  const first=await registerAbuseSignal(env,normal,"automation_denied",3_000_000,store);
  const second=await registerAbuseSignal(env,incognito,"automation_denied",3_000_001,store);
  if(first.blocked||second.blocked)fail("fewer than three automation denials must not activate the public cooldown");
  const third=await registerAbuseSignal(env,normal,"automation_denied",3_000_002,store);
  if(!third.activated||!third.blocked||third.retryAfterSeconds!==600)fail("three automation denials must activate the 10-minute public cooldown");

  const inherited=await abuseCooldown(env,incognito,3_000_002,store);
  if(!inherited.blocked||inherited.retryAfterSeconds!==600)fail("Incognito must inherit an active same-network M8 cooldown");
  const separate=await abuseCooldown(env,other,3_000_002,store);
  if(separate.blocked)fail("a different public network must not inherit M8 cooldown state");

  let overview=await loadAbuseOverview(env,3_000_002,store);
  if(overview.activeCooldowns!==1)fail("Abuse Watch must report one active public cooldown");
  if(overview.events[0]?.kind!=="public_cooldown")fail("tripwire activation must create a persistent Abuse Watch event");
  const stored=[...store.values.values()].join("\n");
  if(stored.includes("203.0.113.50"))fail("M8 persistent state must never contain the raw client IP");

  await releaseAbuseClient(env,normalId,3_000_010,store);
  if((await abuseCooldown(env,incognito,3_000_010,store)).blocked)fail("manual Garden Keeper release must clear the public cooldown state");
  overview=await loadAbuseOverview(env,3_000_010,store);
  if(overview.activeCooldowns!==0||!overview.events.find(event=>event.kind==="public_cooldown")?.releasedAt)fail("Abuse Watch must mark a released public cooldown");

  await recordSecurityEvent(env,normal,"admin_cooldown",{failures:4,retryAfterSeconds:60},3_000_020,store);
  overview=await loadAbuseOverview(env,3_000_020,store);
  if(!overview.events.some(event=>event.kind==="admin_cooldown"&&event.detail?.failures===4))fail("significant Garden Keeper cooldowns must be recorded in Abuse Watch");
}

async function checkWiring(){
  const [book,human,media,admin,adminApi,bootstrap,clientSource,headers,routes,roadmap,guide,pkg]=await Promise.all([
    read("functions/book-access.js"),
    read("functions/human-access.js"),
    read("functions/media/[[path]].js"),
    read("functions/admin-access.js"),
    read("functions/admin-api/abuse.js"),
    read("src/assets/js/admin-bootstrap.js"),
    read("src/assets/js/admin-abuse.js"),
    read("src/_headers"),
    read("src/_routes.json"),
    read("SECURITY_ROADMAP.md"),
    read("MILESTONE_8_ABUSE_RESPONSE.md"),
    read("package.json")
  ]);

  for(const marker of ["abuseCooldown","registerAbuseSignal","automation_denied","acquisition_limited","abuse_cooldown"]){if(!book.includes(marker))fail(`book-access M8 wiring is missing ${marker}`)}
  for(const marker of ["abuseCooldown","registerAbuseSignal","automation_denied","turnstile_rejected","abuse_cooldown"]){if(!human.includes(marker))fail(`human-access M8 wiring is missing ${marker}`)}
  for(const marker of ["registerAbuseSignal","media_cross_site","media_ticket_invalid","!incomingRange"]){if(!media.includes(marker))fail(`media denial telemetry is missing ${marker}`)}
  if(media.includes("abuseCooldown(env"))fail("M8 cooldown enforcement must stay out of the EPUB media/Range path");
  if(!admin.includes("recordSecurityEvent")||!admin.includes('"admin_cooldown"')||!admin.includes("failure.retryAfterSeconds >= 60"))fail("Garden Keeper significant cooldown telemetry is not wired");
  if(!adminApi.includes("adminAuthorized")||!adminApi.includes("loadAbuseOverview")||!adminApi.includes("releaseAbuseClient"))fail("Abuse Watch admin API must be authenticated and support review/release");
  if(!bootstrap.includes("admin-abuse.js?v=1.14.0"))fail("Garden Keeper bootstrap must load Abuse Watch");
  for(const marker of ["Abuse Watch","raw IP addresses are never stored","/admin-api/abuse","data-release-abuse"]){if(!clientSource.includes(marker))fail(`Abuse Watch client is missing ${marker}`)}
  if(!headers.includes("/assets/js/admin-abuse.js")||!headers.includes("Cache-Control: no-store"))fail("Abuse Watch client must be served no-store");
  const routeConfig=JSON.parse(routes);
  if(!routeConfig.include?.includes("/admin-api/*"))fail("admin API wildcard must remain routed through Pages Functions");
  if(!roadmap.includes("7. Garden Keeper hardening | ✅ Done"))fail("Milestone 7 must remain recorded as accepted");
  if(!roadmap.includes("8. Abuse telemetry and response | ✅ Done"))fail("Milestone 8 must remain recorded as accepted");
  for(const marker of ["15-minute","score 12","10-minute","Abuse Watch","raw IP"]){if(!guide.includes(marker))fail(`M8 guide is missing ${marker}`)}
  const packageData=JSON.parse(pkg),parts=String(packageData.version||"").split(".").map(Number);
  if(parts.length<2||parts[0]!==1||parts[1]<14)fail("Shadow Garden package version must remain at or above v1.14 for M8");
  if(!String(packageData.scripts?.check||"").includes("check-m8.mjs"))fail("M8 regression check must remain in npm run check");
}

await checkTripwire();
await checkWiring();
if(failures.length){
  console.error(`Shadow Garden Milestone 8 check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else console.log("Shadow Garden Milestone 8 abuse telemetry and response checks passed.");
