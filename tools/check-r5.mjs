import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=file=>fs.readFile(path.join(ROOT,file),"utf8");
const exists=async file=>{try{await fs.access(path.join(ROOT,file));return true}catch{return false}};

const files={
  html:"src/admin.html",
  app:"src/assets/js/admin/app.js",
  core:"src/assets/js/admin/core.js",
  auth:"src/assets/js/admin/auth-session.js",
  library:"src/assets/js/admin/library-workflow.js",
  shell:"src/assets/js/admin/shell.js",
  maintenance:"src/assets/js/admin/maintenance-workflow.js",
  history:"src/assets/js/admin/history-workflow.js",
  trash:"src/assets/js/admin/trash-workflow.js",
  abuse:"src/assets/js/admin/abuse-workflow.js",
  version:"src/assets/js/admin/version.js",
  uploadSafety:"src/assets/js/admin/upload-safety.js",
  uploadPresentation:"src/assets/js/admin-upload-presentation.js",
  uploadEvents:"src/assets/js/admin/upload-events.js",
  roadmap:"docs/roadmaps/REFACTOR_ROADMAP.md",
  architecture:"docs/architecture/KEEPER_LAYER.md",
  pkg:"package.json"
};
const entries=Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,file])=>[key,await read(file)])));
const pkg=JSON.parse(entries.pkg);

const retired=[
  "admin.js","admin-audio.js","admin-preflight.js","admin-batch-safety.js","admin-maintenance.js","admin-bootstrap.js","admin-security.js",
  "admin-series-status.js","admin-series-banner.js","admin-series-editor-polish.js","admin-overhaul.js","admin-abuse.js","admin-backup-history.js","admin-upload-polish.js"
];
for(const legacy of retired){
  if(entries.html.includes(`/assets/js/${legacy}`)||entries.app.includes(`/assets/js/${legacy}`))fail(`Garden Keeper runtime still loads retired R5/R10 owner ${legacy}`);
  if(await exists(`src/assets/js/${legacy}`))fail(`retired Garden Keeper owner must stay deleted after R10: ${legacy}`);
}
for(const marker of ["/assets/js/admin/core.js","/assets/js/admin/app.js"]){if(!entries.html.includes(marker))fail(`Garden Keeper HTML is missing R5 entrypoint ${marker}`)}

for(const name of ["session","library","maintenance","history","trash","abuse","version","shell"]){
  if(!entries.app.includes(`initializeWorkflow(\"${name}\")`)&&!entries.app.includes(`\"${name}\"`))fail(`R5 app shell is missing ${name} workflow initialization`);
}
for(const source of ["auth","library","shell","maintenance","history","trash","abuse","version"]){if(!entries[source].includes("registerWorkflow"))fail(`${files[source]} must register through the R5 shell`)}

for(const marker of ["class AdminClient","#authorized=false","credentials:\"same-origin\"","authorization","verifySession()","markUnlocked()","markLocked()","session:rejected","opaqueCoverKey","transformPayload"]){if(!entries.core.includes(marker))fail(`R5 AdminClient is missing ${marker}`)}
if((entries.core.match(/window\.api=/g)||[]).length!==1)fail("R5 core must expose exactly one compatibility API binding");
for(const source of ["auth","library","shell","maintenance","history","trash","abuse","version","uploadSafety","uploadPresentation","uploadEvents"]){
  for(const forbidden of ["window.fetch=","api=async","api = async","renderManagerList=function","openAdminView=","showDashboardHome="]){if(entries[source].includes(forbidden))fail(`${files[source]} restores forbidden cross-workflow patching: ${forbidden}`)}
}

for(const marker of ["/admin-access","turnstile.render","admin_access","client.verifySession()","showUnlocked()","client.closeSession()"]){if(!entries.auth.includes(marker))fail(`R5 session workflow is missing ${marker}`)}
const verifyIndex=entries.auth.indexOf("await client.verifySession()"),unlockIndex=entries.auth.indexOf("showUnlocked()",verifyIndex);
if(verifyIndex<0||unlockIndex<verifyIndex)fail("R5 unlock must verify the signed admin session before marking the UI/client unlocked");

for(const marker of ["update-series","update-volume","delete-series","delete-volume","audioAlignedUrl","series-banner","Move to Trash","normalizeSeriesStatus"]){if(!entries.library.includes(marker))fail(`R5 Library/Series workflow is missing ${marker}`)}
for(const marker of ["check-objects","apply-cover-optimizations","optimizedCoverSet"]){if(!entries.maintenance.includes(marker))fail(`R5 Maintenance workflow is missing ${marker}`)}
for(const marker of ["create-backup","restore-backup","/admin-api/backup"]){if(!entries.history.includes(marker))fail(`R5 History workflow is missing ${marker}`)}
for(const marker of ["restore-trash","purge-trash"]){if(!entries.trash.includes(marker))fail(`R5 Trash workflow is missing ${marker}`)}
for(const marker of ["/admin-api/abuse","data-release-abuse"]){if(!entries.abuse.includes(marker))fail(`R5 Abuse workflow is missing ${marker}`)}
for(const marker of ["scheduleEditorRestore","enhanceSeriesChooser","upload-series-card-cover"]){if(!entries.uploadPresentation.includes(marker))fail(`semantic Upload presentation owner is missing ${marker}`)}
if(!entries.app.includes('/assets/js/admin-upload-presentation.js'))fail("Garden Keeper composition root must load admin-upload-presentation.js");

for(const marker of ["Garden Keeper Application Layer","Single admin client","Authentication/session","Upload workflow","Maintenance workflow","History workflow","Trash workflow","Abuse workflow","Security invariants","Final R5/R10 acceptance"]){if(!entries.architecture.includes(marker))fail(`KEEPER_LAYER.md is missing ${marker}`)}
if(!entries.roadmap.includes("R5. Garden Keeper decomposition | ✅ Done"))fail("Refactor roadmap must record R5 complete");
if(!entries.roadmap.includes("R6. Pages Functions service layer |"))fail("Refactor roadmap must retain the R6 backend milestone after R5");
const [major=0,minor=0]=String(pkg.version||"").split(".").map(value=>Number.parseInt(value,10)||0);if(major<1||(major===1&&minor<20))fail(`R5 requires v1.20.0 or newer, found ${pkg.version}`);
if(!String(pkg.scripts?.check||"").includes("check-r5.mjs"))fail("tools/check-r5.mjs must remain in npm run check");

if(failures.length){console.error(`Shadow Garden R5 Garden Keeper check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);failures.forEach(message=>console.error(`- ${message}`));process.exitCode=1}
else console.log("Shadow Garden R5/R10 Garden Keeper shell, client, session, workflow, and final legacy-removal contracts passed.");
