import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");

const [facade,stateSource,progressSource,readerStorage,readerFinished,readerBootstrap,continuousCore,series,readAgain,coverLinks,readAgainStyle,library,polish,finishedPolish,style,compactStyle,footerVersion,writeSource,adminBootstrap,adminVersion,headers,pkg,readerHtml,indexHtml,adultHtml,seriesHtml]=await Promise.all([
  read("src/assets/js/reading-status.js"),
  read("src/assets/js/domain/reading-state.js"),
  read("src/assets/js/domain/progress.js"),
  read("src/assets/js/reader/storage.js"),
  read("src/assets/js/reader-finished.js"),
  read("src/assets/js/reader-bootstrap.js"),
  read("src/assets/js/reader-continuous-core.js"),
  read("src/assets/js/series.js"),
  read("src/assets/js/series-read-again.js"),
  read("src/assets/js/series-cover-links.js"),
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

if(!facade.includes('./domain/reading-state.js')||!facade.includes('window.ShadowGardenReadingStatus'))fail("reading-status.js must remain the compatibility facade over the canonical domain state service");
for(const marker of ['KEY = "sg-finished-books"','MARKER_PREFIX = "sg-finished:"','STATES','UNREAD: "unread"','IN_PROGRESS: "in-progress"','FINISHED: "finished"','isFinished','setAliasesFinished','volumeAliases','isVolumeFinished','setVolumeFinished','progressForIdentity','progressForAliases','volumeProgress','progressAtBeginning','volumeState','actionLabelForState','clearProgressAliases','clearVolumeProgress','seriesFinished','finishedCount','volumeEntries','preferredSeriesEntry','latestActiveEntry']){
  if(!stateSource.includes(marker))fail(`canonical reading-state service is missing ${marker}`);
}
if(stateSource.includes("fetch(")||progressSource.includes("fetch("))fail("reading state/progress must remain browser-local and must not call a server API");
for(const marker of ['../domain/progress.js','../domain/bookmarks.js','canonicalIdentity','writeProgressAliases'])if(!readerStorage.includes(marker))fail(`Reader storage is missing canonical R2 persistence marker ${marker}`);
if(readerStorage.includes('localStorage.'))fail("Reader progress/bookmark writes must not bypass the canonical R2 service");

for(const marker of ["volume-finished-toggle","data-sg-finished-toggle","Mark as Finished","ShadowGardenBookAccess?.initial","ShadowGardenData?.loadCatalog","status.volumeAliases","setAliasesFinished","document.addEventListener(\"change\"","document.addEventListener(\"click\"","volume-complete-next","persist(true,{quiet:true})","volume-end-page-continuous"]){
  if(!readerFinished.includes(marker))fail(`Reader finished control is missing ${marker}`);
}
if(!continuousCore.includes("cloneNode(true)")||!continuousCore.includes("volume-end-page-continuous"))fail("Continuous Reader must retain its cloned end-page architecture");
if(readerFinished.includes('toggle.addEventListener("change"'))fail("finished persistence must remain delegated because Continuous mode clones the end page");
for(const marker of ["window.__sgReaderPublicBookId","window.__sgReaderSourcePath","restartRequested","resetForReadAgain","readingState.clearProgressAliases","catalog.findVolumeEntry","clearRestartFlag"]){
  if(!readerBootstrap.includes(marker))fail(`Reader bootstrap is missing ${marker}`);
}
if(readerBootstrap.includes("installCanonicalReaderMirror")||readerBootstrap.includes("setInterval(sync,500)"))fail("Reader bootstrap must not restore the obsolete polling progress mirror after R2");
if(!readerHtml.includes("reader-bootstrap.js"))fail("Reader HTML must load the Reader bootstrap");

for(const marker of ["finished-volume-badge","data-volume-state","data-reading-state","reading.volumeEntries","reading.preferredSeriesEntry","actionLabelForState","reading.STATES.FINISHED","reading.STATES.IN_PROGRESS","Unread"]){
  if(!series.includes(marker))fail(`Series three-state UI is missing ${marker}`);
}
for(const marker of ["RETURN TO THE FIRST PAGE","Walk this volume from the beginning?","restart:true","clearVolumeProgress","dataset.volumeState",".volume-cover-link","Keep My Place","Begin Again"]){
  if(!readAgain.includes(marker))fail(`Read Again reset flow is missing ${marker}`);
}
for(const marker of ["volume-cover-link","dataset.volumeState","dataset.volumeTitle","action=read.textContent"]){
  if(!coverLinks.includes(marker))fail(`volume cover action mirroring is missing ${marker}`);
}
for(const marker of [".read-again-dialog",".read-again-actions",".read-again-confirm","::backdrop"]){
  if(!readAgainStyle.includes(marker))fail(`Read Again dialog styling is missing ${marker}`);
}
if(!seriesHtml.includes("series-read-again.js")||!seriesHtml.includes("series-cover-links.js"))fail("Series page must load Read Again and cover-action clients");

for(const marker of ["finished-series-badge","data-reading-status=\"finished\"","data-reading-status=\"unfinished\"","params.set(\"reading\"","seriesFinished"]){
  if(!library.includes(marker))fail(`Library completion/filter UI is missing ${marker}`);
}
if(!library.includes("latestActiveEntry"))fail("Library Continue/Read banner selection must consume the canonical state service");
if(!polish.includes("✓ Finished")||!polish.includes("readingState.latestActiveEntry"))fail("Library/Series compatibility layer must use canonical Finished/progress state");
for(const marker of ["continuePanel","volumeState","volumeProgress","actionLabelForState","candidate.state","intro-banner-art","data-volume-state"]){
  if(!finishedPolish.includes(marker))fail(`Library authoritative Read/Continue renderer is missing ${marker}`);
}
for(const marker of ["finished-volume-badge","finished-series-badge","reading-status-chips","compact-card-badge.finished",".catalog-grid.compact .finished-series-badge"]){
  if(!style.includes(marker))fail(`reading-status.css is missing ${marker}`);
}
for(const marker of ["--sg-compact-cover-width:68px","--sg-compact-cover-width:74px","grid-template-columns:var(--sg-compact-cover-width) minmax(0,1fr) auto!important","grid-template-rows:1fr!important","min-height:0!important","grid-column:3!important","justify-self:end!important"]){
  if(!compactStyle.includes(marker))fail(`compact Library alignment CSS is missing ${marker}`);
}
if(compactStyle.includes("grid-template-rows:2.5em 1.2em 1.2em"))fail("Compact cards must not reserve a fake two-line title row");

for(const marker of ["libraryVersion","/data/version.json","v${version}","shortCommit"]){if(!footerVersion.includes(marker))fail(`Library footer version client is missing ${marker}`)}
if(!indexHtml.includes("library-finished-polish.js")||!adultHtml.includes("library-finished-polish.js"))fail("Main and Adult Libraries must load completion-aware Read/Continue rendering");
if(indexHtml.includes("library-continue-meta.js")||adultHtml.includes("library-continue-meta.js"))fail("retired Continue metadata enrichment must not return");
for(const marker of ["version.json","CF_PAGES_COMMIT_SHA","shortCommit","builtAt"]){if(!writeSource.includes(marker))fail(`deployment version generation is missing ${marker}`)}
for(const marker of ["adminVersion","/data/version.json","shortCommit","admin-version-footer","document.body.appendChild(footer)"]){if(!adminBootstrap.includes(marker))fail(`Garden Keeper footer version UI is missing ${marker}`)}
if(adminBootstrap.includes("brandMeta")||adminBootstrap.includes("header.insertBefore(label,back)"))fail("Garden Keeper version must not be mounted in the header");
if(!adminVersion.includes(".admin-version-footer")||!adminVersion.includes("text-align:center")||adminVersion.includes(".admin-header"))fail("Garden Keeper version styling must remain centered in the footer");
for(const marker of ["/assets/js/domain/*","/assets/js/reading-status.js","/assets/js/reader.js","/assets/js/reader-bootstrap.js","/assets/js/series.js","/assets/js/series-read-again.js","/assets/js/series-cover-links.js","/assets/js/library-finished-polish.js"]){if(!headers.includes(marker))fail(`fresh-cache headers are missing ${marker}`)}

const parsed=JSON.parse(pkg);
const [major,minor]=String(parsed.version||"").split(".").map(value=>Number.parseInt(value,10)||0);
if(major<1||(major===1&&minor<16))fail("canonical R2 reading state requires v1.16.0 or newer");

class MemoryStorage{
  constructor(){this.values=new Map()}
  get length(){return this.values.size}
  key(index){return [...this.values.keys()][index]??null}
  getItem(key){return this.values.has(String(key))?this.values.get(String(key)):null}
  setItem(key,value){this.values.set(String(key),String(value))}
  removeItem(key){this.values.delete(String(key))}
}
globalThis.localStorage=new MemoryStorage();
globalThis.location={href:"https://shadowgarden-bon.pages.dev/",origin:"https://shadowgarden-bon.pages.dev"};
globalThis.dispatchEvent=()=>true;
globalThis.CustomEvent=class{constructor(type,init={}){this.type=type;this.detail=init.detail}};

try{
  const api=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/domain/reading-state.js")).href}?check=${Date.now()}`);
  const progress=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/domain/progress.js")).href}?check=${Date.now()}`);
  const seriesId="example-series";
  const volume={file:"bk_1234567890123456789012",bookId:"bk_1234567890123456789012",number:2,title:"Volume 2"};
  const aliases=api.volumeAliases(seriesId,volume,1);
  if(api.volumeState(seriesId,volume,1)!==api.STATES.UNREAD||api.actionLabelForState(api.STATES.UNREAD)!=="Read")fail("a never-opened volume must be Unread with a Read action");
  progress.writeProgress(volume.file,{file:volume.file,page:1,totalPages:120,percentage:.08,updatedAt:100});
  if(api.volumeState(seriesId,volume,1)!==api.STATES.UNREAD)fail("page 1/cover must remain Unread even when EPUB percentage is nonzero");
  progress.writeProgress(volume.file,{file:volume.file,page:2,totalPages:120,percentage:.02,updatedAt:200});
  if(api.volumeState(seriesId,volume,1)!==api.STATES.IN_PROGRESS||api.actionLabelForState(api.STATES.IN_PROGRESS)!=="Continue")fail("progress beyond page 1 must be In Progress with a Continue action");
  if(!api.setVolumeFinished(seriesId,volume,true,1))fail("Finished state must save across volume aliases");
  if(api.volumeState(seriesId,volume,1)!==api.STATES.FINISHED||api.actionLabelForState(api.STATES.FINISHED)!=="Read Again")fail("Finished must override saved progress and expose Read Again");
  if(!api.setVolumeFinished(seriesId,volume,false,1)||!api.clearVolumeProgress(seriesId,volume,1))fail("Read Again reset must clear Finished and progress");
  if(api.volumeState(seriesId,volume,1)!==api.STATES.UNREAD||api.volumeProgress(seriesId,volume,1)!==null)fail("Read Again reset must return the volume to Unread at page 1");
  if(aliases.some(id=>api.isFinished(id)))fail("Read Again reset must clear every canonical Finished alias");
}catch(error){fail(`three-state reading regression threw: ${error.message}`)}

if(failures.length){
  console.error(`Shadow Garden reading-status check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else console.log("Shadow Garden canonical Unread/In Progress/Finished state checks passed.");
