import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");

const [status,readerFinished,readerBootstrap,continuousCore,series,readAgain,readAgainStyle,library,polish,finishedPolish,style,compactStyle,footerVersion,writeSource,adminBootstrap,adminVersion,headers,pkg,readerHtml,indexHtml,adultHtml,seriesHtml]=await Promise.all([
  read("src/assets/js/reading-status.js"),
  read("src/assets/js/reader-finished.js"),
  read("src/assets/js/reader-bootstrap.js"),
  read("src/assets/js/reader-continuous-core.js"),
  read("src/assets/js/series.js"),
  read("src/assets/js/series-read-again.js"),
  read("src/assets/css/series-read-again.css"),
  read("src/assets/js/library.js"),
  read("src/assets/js/library-series-polish.js"),
  read("src/assets/js/library-finished-polish.js"),
  read("src/assets/css/reading-status.css"),
  read("src/assets/css/library-compact-alignment.css"),
  read("src/assets/js/library-footer-version.js"),
  read("tools/write-source.mjs"),
  read("src/assets/js/admin-bootstrap.js"),
  read("src/assets/css/admin-version.css"),
  read("src/_headers"),
  read("package.json"),
  read("src/reader.html"),
  read("src/index.html"),
  read("src/nsfw.html"),
  read("src/series.html")
]);

for(const marker of ["sg-finished-books","sg-finished:","isFinished","setFinished","setAliasesFinished","isAnyFinished","volumeAliases","stableVolumeId","isVolumeFinished","setVolumeFinished","seriesFinished","finishedCount"]){
  if(!status.includes(marker))fail(`reading-status.js is missing ${marker}`);
}
if(status.includes("fetch("))fail("finished reading state must remain browser-local and must not call a server API");
for(const marker of ["volume-finished-toggle","data-sg-finished-toggle","Mark as Finished","Marked as unfinished","ShadowGardenBookAccess?.initial","ShadowGardenData?.loadCatalog","volume?.file","status.volumeAliases","setAliasesFinished","Could not save reading status","document.addEventListener(\"change\"","document.addEventListener(\"click\"","volume-complete-next","persist(true,{quiet:true})","MutationObserver","volume-end-page-continuous"]){
  if(!readerFinished.includes(marker))fail(`Reader finished control is missing ${marker}`);
}
if(!continuousCore.includes("cloneNode(true)")||!continuousCore.includes("volume-end-page-continuous"))fail("Continuous Reader must retain its cloned end-page architecture for the delegated completion regression to be meaningful");
if(readerFinished.includes('toggle.addEventListener("change"'))fail("finished-state persistence must not be attached only to the master checkbox because Continuous mode clones the end page without listeners");
for(const marker of ["window.__sgReaderPublicBookId","window.__sgReaderSourcePath","ticket?.bookId||ticket?.identity","canonicalizeLegacyUrl","reading-status.js?v=1.15.6","reader-finished.js?v=1.15.7","restartRequested","resetForReadAgain","localStorage.removeItem(`sg-progress:${identity}`)","clearRestartFlag"]){
  if(!readerBootstrap.includes(marker))fail(`Reader bootstrap is missing ${marker}`);
}
if(!readerHtml.includes("reader-bootstrap.js?v=1.15.7"))fail("Reader HTML must retain the no-store Reader bootstrap client");
for(const marker of ["finished-volume-badge","Read again","finishedCount"]){
  if(!series.includes(marker))fail(`Series completion UI is missing ${marker}`);
}
for(const marker of ["Walk this volume from the beginning?","Begin Again","restart","setVolumeFinished","localStorage.removeItem(`sg-progress:${bookId}`)","bookmarks remain untouched","read again"]){
  if(!readAgain.includes(marker))fail(`Read Again reset flow is missing ${marker}`);
}
for(const marker of [".read-again-dialog",".read-again-actions",".read-again-confirm","::backdrop"]){
  if(!readAgainStyle.includes(marker))fail(`Read Again dialog styling is missing ${marker}`);
}
if(!seriesHtml.includes("series-read-again.css?v=1.15.12")||!seriesHtml.includes("series-read-again.js?v=1.15.13"))fail("Series page must load the current Read Again warning/reset clients");
for(const marker of ["finished-series-badge","data-reading-status=\"finished\"","data-reading-status=\"unfinished\"","params.set(\"reading\"","seriesFinished"]){
  if(!library.includes(marker))fail(`Library completion/filter UI is missing ${marker}`);
}
if(!polish.includes("✓ Finished")||!polish.includes("finished"))fail("Compact Library cards must surface the Finished badge");
for(const marker of ["continuePanel","canonicalBookId","crypto.subtle.digest","progressEntries","isVolumeFinished","if(finished)continue","continueSignature","sg-progress:","intro-banner-art","isAtBeginning","page<=1","percentage<=0.01","actionLabel","?\"Read\":\"Continue\""]){
  if(!finishedPolish.includes(marker))fail(`Library authoritative Continue renderer is missing ${marker}`);
}
for(const marker of ["finished-volume-badge","finished-series-badge","reading-status-chips","compact-card-badge.finished",".catalog-grid.compact .finished-series-badge"]){
  if(!style.includes(marker))fail(`reading-status.css is missing ${marker}`);
}
for(const marker of ["--sg-compact-cover-width:68px","--sg-compact-cover-width:74px","grid-template-columns:var(--sg-compact-cover-width) minmax(0,1fr) auto!important","grid-template-rows:1fr!important","min-height:0!important","grid-column:3!important","justify-self:end!important"]){
  if(!compactStyle.includes(marker))fail(`compact Library alignment CSS is missing ${marker}`);
}
if(compactStyle.includes("grid-template-rows:2.5em 1.2em 1.2em"))fail("Compact cards must not reserve a fake two-line title row that separates one-line titles from authors");
for(const marker of ["libraryVersion","/data/version.json","v${version}","shortCommit"]){
  if(!footerVersion.includes(marker))fail(`Library footer version client is missing ${marker}`);
}
if(!indexHtml.includes("library-finished-polish.js?v=1.15.7")||!adultHtml.includes("library-finished-polish.js?v=1.15.7"))fail("Main and Adult Libraries must load the v1.15.7 completion-aware Continue renderer");
if(!indexHtml.includes("library-compact-alignment.css?v=1.15.11")||!adultHtml.includes("library-compact-alignment.css?v=1.15.11"))fail("Main and Adult Libraries must load the v1.15.11 compact-card alignment stylesheet");
if(!indexHtml.includes("library-footer-version.js?v=1.15.9")||!adultHtml.includes("library-footer-version.js?v=1.15.9")||!indexHtml.includes('id="libraryVersion"')||!adultHtml.includes('id="libraryVersion"'))fail("Main and Adult Library footers must load and mount the deployed version client");
if(indexHtml.includes("library-continue-meta.js")||adultHtml.includes("library-continue-meta.js"))fail("Legacy Continue metadata enrichment must not compete with the authoritative completion-aware renderer");
for(const marker of ["version.json","CF_PAGES_COMMIT_SHA","shortCommit","builtAt"]){
  if(!writeSource.includes(marker))fail(`deployment version generation is missing ${marker}`);
}
for(const marker of ["adminVersion","/data/version.json","shortCommit","admin-version-footer","document.body.appendChild(footer)"]){
  if(!adminBootstrap.includes(marker))fail(`Garden Keeper footer version UI is missing ${marker}`);
}
if(adminBootstrap.includes("brandMeta")||adminBootstrap.includes("header.insertBefore(label,back)"))fail("Garden Keeper version must not be mounted in the header");
if(!adminVersion.includes(".admin-version-footer")||!adminVersion.includes("text-align:center")||adminVersion.includes(".admin-header"))fail("Garden Keeper version styling must be centered in the footer and must not alter the header grid");
for(const marker of ["/data/version.json","/assets/js/reading-status.js","/assets/js/library.js","/assets/js/library-series-polish.js","/assets/js/library-finished-polish.js","/assets/js/library-footer-version.js","/assets/js/series-read-again.js","/assets/css/library-compact-alignment.css","/assets/css/series-read-again.css"]){
  if(!headers.includes(marker))fail(`fresh-cache headers are missing ${marker}`);
}
const parsed=JSON.parse(pkg);
if(parsed.version!=="1.15.13")fail("package version must be 1.15.13");

/* Behavioral regression: one finished volume must be readable through every alias used
   by Reader, Series and Library, survive a fresh API instance, and clear atomically. */
{
  const values=new Map();
  const localStorage={
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key)
  };
  const events=[];
  const window={dispatchEvent:event=>events.push(event)};
  const context={
    window,
    localStorage,
    document:{querySelector:()=>({})},
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
    Date,
    console
  };
  try{
    vm.runInNewContext(status,context,{filename:"reading-status.js"});
    let api=window.ShadowGardenReadingStatus;
    const seriesId="example-series";
    const volume={file:"bk_1234567890123456789012",bookId:"bk_1234567890123456789012",number:2,title:"Volume 2"};
    const privatePath="/media/shadow-garden/books/example/volume-2.epub";
    const aliases=api.volumeAliases(seriesId,volume,1,[privatePath]);
    if(!aliases.includes(volume.file)||!aliases.some(id=>id.startsWith(`series:${seriesId}:volume:`)))fail("volume aliases must include both the public catalog id and stable series-volume id");
    if(!api.setAliasesFinished(aliases,true))fail("alias-safe completion write must succeed");
    if(!aliases.every(id=>api.isFinished(id)))fail("all aliases must read as finished immediately after saving");

    delete window.ShadowGardenReadingStatus;
    vm.runInNewContext(status,context,{filename:"reading-status-reload.js"});
    api=window.ShadowGardenReadingStatus;
    if(!api.isFinished(volume.file)||!api.isVolumeFinished(seriesId,volume,1))fail("finished state must survive a fresh Reader/Series page load");
    const sample={id:seriesId,volumes:[volume,{file:"bk_abcdefghijklmnopqrstuv",number:3,title:"Volume 3"}]};
    if(api.finishedCount(sample)!==1||api.seriesFinished(sample))fail("series completion must count only the finished volume");
    if(!api.setVolumeFinished(seriesId,sample.volumes[1],true,1))fail("second volume completion write must succeed");
    if(!api.seriesFinished(sample))fail("series must become finished when every current volume is marked finished");
    if(!api.setAliasesFinished(aliases,false)||aliases.some(id=>api.isFinished(id)))fail("unfinishing must clear every alias atomically");
  }catch(error){fail(`reading-status behavioral regression threw: ${error.message}`)}
}

if(failures.length){
  console.error(`Shadow Garden reading-status check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else console.log("Shadow Garden finished-reading, Read Again, Library alignment, and deployed-version checks passed.");
