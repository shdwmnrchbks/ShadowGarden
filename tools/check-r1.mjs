import fs from "node:fs/promises";
import path from "node:path";
import { versionLocalAssets } from "./lib/asset-versioning.mjs";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");
const exists=async relative=>{try{await fs.access(path.join(ROOT,relative));return true}catch{return false}};

async function walk(root){
  const out=[];
  for(const entry of await fs.readdir(path.join(ROOT,root),{withFileTypes:true})){
    const relative=path.posix.join(root,entry.name);
    if(entry.isDirectory())out.push(...await walk(relative));
    else if(entry.isFile())out.push(relative);
  }
  return out;
}

const [pkgText,roadmap,docsIndex,conventions,buildContract,workflow,nvmrc,buildSource,legacyText]=await Promise.all([
  read("package.json"),
  read("docs/roadmaps/REFACTOR_ROADMAP.md"),
  read("docs/README.md"),
  read("docs/architecture/MODULE_CONVENTIONS.md"),
  read("docs/architecture/BUILD_CONTRACT.md"),
  read(".github/workflows/verify.yml"),
  read(".nvmrc"),
  read("tools/build.mjs"),
  read("docs/architecture/r1-legacy-source-exceptions.json")
]);
const pkg=JSON.parse(pkgText);
const legacy=JSON.parse(legacyText);

const allowedRoot=new Set([".env.b2.example",".github",".gitignore",".nvmrc","CHANGELOG.md","README.md","docs","functions","library","package.json","package-lock.json","src","tools"]);
for(const entry of await fs.readdir(ROOT,{withFileTypes:true})){
  if(entry.name===".git"||entry.name==="node_modules"||entry.name==="dist")continue;
  if(!allowedRoot.has(entry.name))fail(`unexpected repository-root entry: ${entry.name}`);
}

if(nvmrc.trim()!=="22")fail(".nvmrc must pin Node 22");
if(!workflow.includes("node-version: 22"))fail("GitHub Actions must use Node 22");
for(const marker of [
  "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
])if(!workflow.includes(marker))fail(`CI action is not pinned to the R1 immutable revision: ${marker}`);
if(!workflow.includes("run: npm run build"))fail("GitHub Actions must verify the production build after repository checks");

for(const marker of ["MODULE_CONVENTIONS.md","BUILD_CONTRACT.md","r1-legacy-source-exceptions.json"]){
  if(!docsIndex.includes(marker))fail(`docs/README.md must index ${marker}`);
}
for(const marker of ["One owner per responsibility","Forbidden names for new permanent source","DOM ownership","State ownership","CSS ownership"]){
  if(!conventions.includes(marker))fail(`module conventions are missing ${marker}`);
}
for(const marker of ["Authored vs generated","dist/","Node 22","Asset cache-busting","package.json#version","deferred to R9"]){
  if(!buildContract.includes(marker))fail(`build contract is missing ${marker}`);
}

const patchPattern=/(?:-polish|-fix|-patch|-current|-v\d+(?:\.\d+)+)\.(?:js|css)$/i;
const patchFiles=(await Promise.all([walk("src/assets/js"),walk("src/assets/css")])).flat().filter(file=>patchPattern.test(path.posix.basename(file))).sort();
const grandfathered=[...(legacy.grandfatheredPatchStyleFiles||[])].sort();
if(JSON.stringify(patchFiles)!==JSON.stringify(grandfathered)){
  fail(`patch-style source set drifted from the explicit R1 grandfather list\n  expected: ${grandfathered.join(", ")}\n  actual:   ${patchFiles.join(", ")}`);
}
for(const file of legacy.removedDeadFiles||[]){if(await exists(file))fail(`dead R1 source must stay removed: ${file}`)}

const sample=`<script src="/assets/js/app.js?v=old"></script><link href='/assets/css/site.css' rel='stylesheet'><img src="/assets/img/cover.webp"><script src="https://example.com/assets/x.js?v=remote"></script>`;
const stamped=versionLocalAssets(sample,"9.8.7");
if(!stamped.includes('/assets/js/app.js?v=9.8.7'))fail("asset version helper did not replace an existing local JS query");
if(!stamped.includes('/assets/css/site.css?v=9.8.7'))fail("asset version helper did not add a local CSS query");
if(!stamped.includes('/assets/img/cover.webp'))fail("asset version helper must not version images");
if(!stamped.includes('https://example.com/assets/x.js?v=remote'))fail("asset version helper must not rewrite remote asset URLs");
for(const marker of ["stampAssetVersions","ASSET_VERSION","package.json","Stamped ${stampedAssets}"]){
  if(!buildSource.includes(marker))fail(`build must retain centralized asset versioning marker ${marker}`);
}

const checkCommand=String(pkg.scripts?.check||"");
if(!checkCommand.includes("check-r0.mjs"))fail("R0 guardrail must remain in npm run check");
if(!checkCommand.includes("check-r1.mjs"))fail("R1 guardrail must be part of npm run check");
if(!roadmap.includes("R1. Repository and tooling hygiene | ✅ Done"))fail("refactor roadmap must record R1 as done after acceptance");

if(failures.length){
  console.error(`Shadow Garden R1 repository/tooling hygiene check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden R1 repository layout, ownership naming, build boundaries, CI pinning, and asset versioning checks passed.");
}
