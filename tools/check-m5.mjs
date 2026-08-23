import fs from "node:fs/promises";
import path from "node:path";
import {
  ACQUISITION_COOKIE,
  ACQUISITION_UNIQUE_LIMIT,
  ACQUISITION_WINDOW_SECONDS,
  evaluateAcquisition,
  verifyAcquisitionState
} from "../functions/_lib/acquisition-limit.js";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");
const env={SG_MEDIA_SIGNING_SECRET:"shadow-garden-ci-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ"};

async function checkLimiter(){
  if(ACQUISITION_UNIQUE_LIMIT!==20)fail("Milestone 5 session limit must remain 20 unique books");
  if(ACQUISITION_WINDOW_SECONDS!==600)fail("Milestone 5 session window must remain 10 minutes");
  let cookie="";
  const now=2_000_000;
  let firstId="";

  for(let index=0;index<ACQUISITION_UNIQUE_LIMIT;index++){
    const id=`bk_${String(index).padStart(22,"A")}`;
    if(index===0)firstId=id;
    const result=await evaluateAcquisition(env,cookie,id,now+index);
    if(!result.allowed)fail(`unique book ${index+1} should be allowed inside the session budget`);
    if(!result.cookie.includes(`${ACQUISITION_COOKIE}=`))fail("allowed acquisitions must refresh the signed acquisition cookie");
    for(const marker of ["HttpOnly","Secure","SameSite=Strict","Path=/book-access","Max-Age=600"]){
      if(!result.cookie.includes(marker))fail(`acquisition cookie is missing ${marker}`);
    }
    cookie=result.cookie;
  }

  const repeated=await evaluateAcquisition(env,cookie,firstId,now+30);
  if(!repeated.allowed||repeated.newBook)fail("re-authorizing the same book must not consume another unique-book slot");
  cookie=repeated.cookie;

  const blocked=await evaluateAcquisition(env,cookie,"bk_ZZZZZZZZZZZZZZZZZZZZZZ",now+40);
  if(blocked.allowed)fail("the 21st unique book inside 10 minutes must be throttled");
  if(blocked.retryAfterSeconds<1||blocked.retryAfterSeconds>ACQUISITION_WINDOW_SECONDS)fail("throttled acquisitions must expose a sane retry interval");

  const later=await evaluateAcquisition(env,cookie,"bk_ZZZZZZZZZZZZZZZZZZZZZZ",now+ACQUISITION_WINDOW_SECONDS+50);
  if(!later.allowed)fail("the acquisition budget must recover after the rolling window expires");

  const token=cookie.split(";")[0];
  const tampered=`${token.slice(0,-1)}${token.endsWith("A")?"B":"A"}`;
  const invalid=await verifyAcquisitionState(env,tampered,now+50);
  if(invalid.valid)fail("tampered acquisition state must not verify");
}

async function checkWiring(){
  const [endpoint,media,guide,roadmap]=await Promise.all([
    read("functions/book-access.js"),
    read("functions/media/[[path]].js"),
    read("MILESTONE_5_CLOUDFLARE.md"),
    read("SECURITY_ROADMAP.md")
  ]);
  for(const marker of ["evaluateAcquisition","ACQUISITION_UNIQUE_LIMIT","acquisition_rate_limited","Retry-After","X-SG-Acquisition-Remaining","acquisition.cookie"]){
    if(!endpoint.includes(marker))fail(`book-access endpoint is missing Milestone 5 marker ${marker}`);
  }
  if(media.includes("sg_acquisition_window")||media.includes("evaluateAcquisition"))fail("Milestone 5 must not rate-limit EPUB Range/media requests");
  for(const marker of ["/book-access","8 requests","10 seconds","Managed Challenge","optional future hardening"]){
    if(!guide.includes(marker))fail(`Milestone 5 deployment note is missing ${marker}`);
  }
  if(!roadmap.includes("4. Human access sessions | ✅ Done"))fail("Milestone 4 must be recorded as accepted");
  if(!roadmap.includes("5. Bulk-download throttling | ✅ Done"))fail("Milestone 5 must be recorded as complete");
}

await checkLimiter();
await checkWiring();
if(failures.length){
  console.error(`Shadow Garden Milestone 5 check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden Milestone 5 acquisition throttling checks passed.");
}
