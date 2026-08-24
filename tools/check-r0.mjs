import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");
const exists=async relative=>{try{await fs.access(path.join(ROOT,relative));return true}catch{return false}};

function normalizeAsset(value){
  const raw=String(value||"").trim();
  if(!raw.startsWith("/"))return raw;
  return raw.split("#")[0].split("?")[0];
}
function htmlAssets(html,tag){
  const values=[];
  if(tag==="style"){
    const regex=/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*>/gi;
    for(const match of html.matchAll(regex))values.push(normalizeAsset(match[1]||match[2]));
  }else{
    const regex=/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    for(const match of html.matchAll(regex))values.push(normalizeAsset(match[1]));
  }
  return values;
}
function sameArray(a,b){return a.length===b.length&&a.every((value,index)=>value===b[index])}
function semverAtLeast(current,minimum){
  const parse=value=>String(value||"").split(".").slice(0,3).map(item=>Number.parseInt(item,10)||0);
  const a=parse(current),b=parse(minimum);
  for(let i=0;i<3;i++){if(a[i]>b[i])return true;if(a[i]<b[i])return false}
  return true;
}

const manifest=JSON.parse(await read("docs/architecture/v1-entrypoints.json"));
for(const [name,page] of Object.entries(manifest.pages||{})){
  if(!(await exists(page.html))){fail(`${name} HTML entrypoint is missing: ${page.html}`);continue}
  const html=await read(page.html);
  const actualStyles=htmlAssets(html,"style");
  const actualScripts=htmlAssets(html,"script");
  if(!sameArray(actualStyles,page.styles||[])){
    fail(`${name} direct stylesheet order drifted from the frozen R0 manifest\n  expected: ${(page.styles||[]).join(", ")}\n  actual:   ${actualStyles.join(", ")}`);
  }
  if(!sameArray(actualScripts,page.scripts||[])){
    fail(`${name} direct script order drifted from the frozen R0 manifest\n  expected: ${(page.scripts||[]).join(", ")}\n  actual:   ${actualScripts.join(", ")}`);
  }
  for(const asset of [...(page.styles||[]),...(page.scripts||[]),...(page.runtimeLoaded||[])]){
    if(!asset.startsWith("/assets/"))continue;
    const sourcePath=`src${asset}`;
    if(!(await exists(sourcePath)))fail(`${name} references a missing frozen asset: ${sourcePath}`);
  }
}

const [pkg,roadmap,baseline,persistence,httpStorage,routes,media,bookAccess,humanAccess,adminAccess,b2,bookId,upload,readingStatus,readerStorage,readerVisual,pageMap,library,mobileFilter,navPinned]=await Promise.all([
  read("package.json"),
  read("docs/roadmaps/REFACTOR_ROADMAP.md"),
  read("docs/architecture/V1_BASELINE.md"),
  read("docs/architecture/PERSISTENCE_CONTRACTS.md"),
  read("docs/architecture/HTTP_STORAGE_CONTRACTS.md"),
  read("src/_routes.json"),
  read("functions/media/[[path]].js"),
  read("functions/book-access.js"),
  read("functions/human-access.js"),
  read("functions/admin-access.js"),
  read("functions/_lib/b2.js"),
  read("functions/_lib/book-id.js"),
  read("functions/admin-api/upload.js"),
  read("src/assets/js/reading-status.js"),
  read("src/assets/js/reader/storage.js"),
  read("src/assets/js/reader-visual-cache.js"),
  read("src/assets/js/reader/page-map.js"),
  read("src/assets/js/library.js"),
  read("src/assets/js/library-mobile-filter.js"),
  read("src/assets/js/nav-pinned.js")
]);

const packageData=JSON.parse(pkg);
if(!semverAtLeast(packageData.version,manifest.baselineVersion))fail(`package version ${packageData.version} is older than the frozen ${manifest.baselineVersion} baseline`);
const checkCommand=String(packageData.scripts?.check||"");
for(const required of ["check-security.mjs","check-m5.mjs","check-m6.mjs","check-m7.mjs","check-m8.mjs","check-reading-status.mjs","check-m9.mjs","check-r0.mjs"]){
  if(!checkCommand.includes(required))fail(`npm run check must retain permanent contract guardrail ${required}`);
}

if(!roadmap.includes("R0. Freeze the v1 baseline | ✅ Done"))fail("Refactor roadmap must record R0 as done after baseline acceptance");
for(const marker of ["v1.15.14","Known duplicate/competing ownership","Reader invariants","Garden Keeper"]){if(!baseline.includes(marker))fail(`V1_BASELINE.md is missing ${marker}`)}
for(const marker of ["sg-progress:<identity>","sg-bookmarks:<identity>","sg-reader-settings","sg-reader-polish-settings","sg-finished-books","sg-finished:<alias>","sg-pinned","sg-pinned-nav-collapsed","sg-view:<scope>","sg-mobile-filters-collapsed:<scope>","sg-adult-ack","shadow-garden-reader","shadow-garden-visual-pages"]){if(!persistence.includes(marker))fail(`persistence contract is missing ${marker}`)}
for(const marker of ["/media/*","/book-access","/human-access","/admin-access","/admin-api/*","shadow-garden/data/catalog.json","shadow-garden/data/adult-catalog.json","shadow-garden/data/trash.json","shadow-garden/backups/catalogs/","shadow-garden/security/admin-throttle/","shadow-garden/security/abuse-state/","shadow-garden/security/abuse-ledger.json","bk_","cv_"]){if(!httpStorage.includes(marker))fail(`HTTP/storage contract is missing ${marker}`)}

const routeConfig=JSON.parse(routes);
for(const route of ["/media/*","/book-access","/human-access","/admin-access","/admin-api/*"]){if(!routeConfig.include?.includes(route))fail(`Pages Functions route contract drifted: ${route}`)}

for(const marker of ["incomingRange","authorizedEpub","verifyMediaTicket","verifyMediaTicketCookie","publicCatalogShape","Cross-Origin-Resource-Policy"]){if(!media.includes(marker))fail(`media contract lost ${marker}`)}
if(media.includes("abuseCooldown(env"))fail("M8 cooldown enforcement must remain outside /media/* during refactor");
for(const marker of ["issueMediaTicket","verifyHumanSession","evaluateAcquisition","abuseCooldown","classifyAutomatedClient","resolveBookReference"]){if(!bookAccess.includes(marker))fail(`book-access contract lost ${marker}`)}
for(const marker of ["verifyTurnstileToken","issueHumanSession","registerAbuseSignal"]){if(!humanAccess.includes(marker))fail(`human-access contract lost ${marker}`)}
for(const marker of ["adminTokenMatches","adminCooldown","issueAdminSession","registerAdminFailure"]){if(!adminAccess.includes(marker))fail(`admin-access contract lost ${marker}`)}
for(const marker of ["verifyAdminSession","adminTokenMatches","readClient","writeClient","validObjectKey"]){if(!b2.includes(marker))fail(`B2/admin authorization contract lost ${marker}`)}
for(const marker of ["/^bk_[A-Za-z0-9_-]{22}$/","shadow-garden-book-id-v1","publicCatalogShape","originalFilename"]){if(!bookId.includes(marker))fail(`book identity contract lost ${marker}`)}
for(const marker of ["OPAQUE_COVER_KEY","opaque cv_ identifier"]){if(!upload.includes(marker))fail(`opaque cover enforcement lost ${marker}`)}

for(const marker of ["UNREAD:\"unread\"","IN_PROGRESS:\"in-progress\"","FINISHED:\"finished\"","progressAtBeginning","actionLabelForState","clearVolumeProgress"]){if(!readingStatus.includes(marker))fail(`three-state reading contract lost ${marker}`)}
for(const marker of ["sg-progress:${bookUrl}","sg-bookmarks:${bookUrl}","sg-reader-settings"]){if(!readerStorage.includes(marker))fail(`Reader storage contract lost ${marker}`)}
if(!readerVisual.includes('CACHE_DB="shadow-garden-visual-pages"')||!readerVisual.includes('CACHE_STORE="books"'))fail("Visual Page Cache IndexedDB contract drifted");
if(!pageMap.includes('DB_NAME = "shadow-garden-reader"')||!pageMap.includes('STORE_NAME = "page-maps"'))fail("Page Map IndexedDB contract drifted");
for(const marker of ["sg-view:${scope}","sg-pinned","sg-adult-ack","sg-progress:"]){if(!library.includes(marker))fail(`Library persistence contract lost ${marker}`)}
if(!mobileFilter.includes("sg-mobile-filters-collapsed:${scope}"))fail("mobile filter persistence contract drifted");
for(const marker of ["sg-pinned","sg-pinned-nav-collapsed"]){if(!navPinned.includes(marker))fail(`pinned navigation persistence contract lost ${marker}`)}

if(failures.length){
  console.error(`Shadow Garden R0 refactor baseline check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden R0 v1 architecture, persistence, entrypoint, security, and storage contracts are frozen and intact.");
}
