import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=file=>fs.readFile(path.join(ROOT,file),"utf8");
const exists=async file=>{try{await fs.access(path.join(ROOT,file));return true}catch{return false}};

function normalizeAsset(value){return String(value||"").trim().split("#")[0].split("?")[0]}
function htmlAssets(html,kind){
  const out=[];
  const regex=kind==="style"
    ? /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*>/gi
    : /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  for(const match of html.matchAll(regex))out.push(normalizeAsset(match[1]||match[2]));
  return out;
}
function sameArray(a,b){return a.length===b.length&&a.every((value,index)=>value===b[index])}
async function walk(dir,predicate=()=>true){
  const out=[];
  for(const entry of await fs.readdir(path.join(ROOT,dir),{withFileTypes:true})){
    const relative=path.posix.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(relative,predicate));
    else if(entry.isFile()&&predicate(relative))out.push(relative);
  }
  return out;
}

const required=[
  "docs/architecture/V2_BASELINE.md",
  "docs/architecture/v2-entrypoints.json",
  "docs/releases/v2.0.0.md",
  ".github/workflows/release-v2.yml",
  "src/assets/js/admin-upload-presentation.js"
];
for(const file of required)if(!(await exists(file)))fail(`R10 required artifact is missing: ${file}`);

const [pkgText,lockText,v2Text,legacyText,roadmap,baseline,docsIndex,architectureIndex,releaseWorkflow,releaseNotes,changelog,adminHtml,adminApp]=await Promise.all([
  read("package.json"),read("package-lock.json"),read("docs/architecture/v2-entrypoints.json"),read("docs/architecture/r1-legacy-source-exceptions.json"),
  read("docs/roadmaps/REFACTOR_ROADMAP.md"),read("docs/architecture/V2_BASELINE.md"),read("docs/README.md"),read("docs/architecture/README.md"),
  read(".github/workflows/release-v2.yml"),read("docs/releases/v2.0.0.md"),read("CHANGELOG.md"),read("src/admin.html"),read("src/assets/js/admin/app.js")
]);
const pkg=JSON.parse(pkgText),lock=JSON.parse(lockText),v2=JSON.parse(v2Text),legacy=JSON.parse(legacyText);

if(pkg.version!=="2.0.0")fail(`R10 v2 baseline requires package version 2.0.0, found ${pkg.version}`);
if(lock.version!==pkg.version||lock.packages?.[""]?.version!==pkg.version)fail("package-lock root versions must match the v2 package version");
if(v2.baselineVersion!=="2.0.0"||v2.milestone!=="R10")fail("v2-entrypoints.json must freeze the R10 v2.0.0 baseline");
if(!String(pkg.scripts?.check||"").includes("node tools/check-r10.mjs"))fail("tools/check-r10.mjs must remain in npm run check");

for(const [name,page] of Object.entries(v2.pages||{})){
  if(!(await exists(page.html))){fail(`v2 ${name} HTML is missing: ${page.html}`);continue}
  const html=await read(page.html);
  if(!sameArray(htmlAssets(html,"style"),page.styles||[]))fail(`v2 ${name} direct stylesheet order drifted from v2-entrypoints.json`);
  if(!sameArray(htmlAssets(html,"script"),page.scripts||[]))fail(`v2 ${name} direct script order drifted from v2-entrypoints.json`);
  for(const asset of [...(page.styles||[]),...(page.scripts||[]),...(page.runtimeLoaded||[])]){
    if(!asset.startsWith("/assets/")||asset.startsWith("/assets/vendor/"))continue;
    if(!(await exists(`src${asset}`)))fail(`v2 ${name} references missing asset src${asset}`);
  }
}

if((legacy.grandfatheredPatchStyleFiles||[]).length!==0)fail("R10 must leave no grandfathered patch-style source files");
const retired=[...(legacy.removedDeadFiles||[])];
for(const file of retired)if(await exists(file))fail(`R10 retired source returned: ${file}`);
for(const file of [
  "src/assets/js/admin.js","src/assets/js/admin-audio.js","src/assets/js/admin-preflight.js","src/assets/js/admin-batch-safety.js","src/assets/js/admin-maintenance.js",
  "src/assets/js/admin-bootstrap.js","src/assets/js/admin-security.js","src/assets/js/admin-series-status.js","src/assets/js/admin-series-banner.js","src/assets/js/admin-series-editor-polish.js",
  "src/assets/js/admin-overhaul.js","src/assets/js/admin-abuse.js","src/assets/js/admin-backup-history.js","src/assets/js/admin-upload-polish.js",
  "src/assets/css/admin-series-editor-polish.css","src/assets/css/admin-overhaul.css"
])if(await exists(file))fail(`known obsolete R10 path must stay removed: ${file}`);

const patchPattern=/(?:-polish|-fix|-patch|-hotfix|-current|-v\d+(?:\.\d+)+)\.(?:js|css)$/i;
for(const file of [...await walk("src/assets/js",file=>file.endsWith(".js")),...await walk("src/assets/css",file=>file.endsWith(".css"))]){
  if(patchPattern.test(path.posix.basename(file)))fail(`v2 source still has release-history/patch owner: ${file}`);
}

const authoredText=await Promise.all((await walk("src",file=>/\.(?:html|js|css)$/.test(file))).map(async file=>[file,await read(file)]));
const localVersion=/\/assets\/[A-Za-z0-9_./-]+\.(?:js|css)\?v=/;
for(const [file,source] of authoredText)if(localVersion.test(source))fail(`v2 authored source still contains local ?v= cache history: ${file}`);

for(const marker of ["/assets/css/admin-series-editor.css","/assets/css/admin-layout.css"]){if(!adminHtml.includes(marker))fail(`Garden Keeper direct semantic CSS is missing ${marker}`)}
for(const retiredName of ["admin-series-editor-polish.css","admin-overhaul.css"]){if(adminHtml.includes(retiredName))fail(`Garden Keeper HTML still uses retired CSS alias ${retiredName}`)}
if(!adminApp.includes("/assets/js/admin-upload-presentation.js"))fail("Garden Keeper app must load semantic admin-upload-presentation.js");
if(adminApp.includes("admin-upload-polish.js"))fail("Garden Keeper app still loads the retired upload-polish path");

for(const marker of [
  "Shadow Garden v2 Baseline","Baseline release:** v2.0.0","Ownership model","Responsive navigation","Garden Keeper","Pages Functions","Security invariants",
  "Persistence invariants","Build and deployment","Regression architecture","Legacy cutover rule","v2 acceptance"
])if(!baseline.includes(marker))fail(`V2_BASELINE.md is missing ${marker}`);
if(!docsIndex.includes("V2_BASELINE.md")||!docsIndex.includes("v2-entrypoints.json")||!docsIndex.includes("releases/v2.0.0.md"))fail("docs index must expose the v2 baseline, manifest and release notes");
if(!architectureIndex.includes("V2_BASELINE.md")||!architectureIndex.includes("v2-entrypoints.json")||!architectureIndex.includes("R10 final cutover and release gate"))fail("architecture index must record the final v2 baseline/cutover");

for(const marker of [
  "R0–R10 complete","Current refactor release:** v2.0.0","R10. Final cutover and legacy removal | ✅ Done","**Release:** v2.0.0",
  "Every behavior has a documented owner","Production smoke test passes on `pages.dev`","Refactored architecture becomes the next major-version baseline"
])if(!roadmap.includes(marker))fail(`refactor roadmap is missing final R10 marker: ${marker}`);
if(!changelog.includes("## 2.0.0 — R10 Final Cutover & v2 Baseline"))fail("CHANGELOG.md must include the v2.0.0 R10 release entry");
for(const marker of ["Shadow Garden v2.0.0","R0–R10","Security","Upgrade and data compatibility","Verification"]){if(!releaseNotes.includes(marker))fail(`v2 release notes are missing ${marker}`)}

for(const marker of [
  "workflow_run:","Verify Shadow Garden","conclusion == 'success'","head_branch == 'main'","contents: write","github.event.workflow_run.head_sha",
  "https://shadowgarden-bon.pages.dev","/data/version.json","deployed_commit","/nsfw.html","/series.html","/reader.html","gh release create","docs/releases/v2.0.0.md"
])if(!releaseWorkflow.includes(marker))fail(`v2 release workflow is missing ${marker}`);

if(failures.length){
  console.error(`Shadow Garden R10 final-cutover check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden R10 v2 baseline, legacy removal, semantic entrypoints, source cache ownership, docs, and verified release gate passed.");
}
