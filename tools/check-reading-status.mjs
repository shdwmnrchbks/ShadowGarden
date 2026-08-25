import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT=process.cwd(),failures=[];
const fail=message=>failures.push(message),read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");
const [facade,stateSource,progressSource,readerStorage,readerCompletion,readerSession,readerApp,pageInput,imageFocus,readerBootstrap,continuousCore,series,seriesRenderers,volumeActions,volumeActionsStyle,library,libraryRenderers,style,compactStyle,footerVersion,writeSource,buildContext,adminBootstrap,adminVersion,headers,pkg,readerHtml,indexHtml,adultHtml,seriesHtml]=await Promise.all([
  read("src/assets/js/reading-status.js"),read("src/assets/js/domain/reading-state.js"),read("src/assets/js/domain/progress.js"),read("src/assets/js/reader/storage.js"),read("src/assets/js/reader/completion.js"),read("src/assets/js/reader/book-session.js"),read("src/assets/js/reader/app.js"),read("src/assets/js/reader/page-navigation-input.js"),read("src/assets/js/reader/image-focus.js"),read("src/assets/js/reader-bootstrap.js"),read("src/assets/js/reader-continuous-core.js"),read("src/assets/js/series.js"),read("src/assets/js/series-renderers.js"),read("src/assets/js/public/volume-actions.js"),read("src/assets/css/volume-actions.css"),read("src/assets/js/library.js"),read("src/assets/js/library-renderers.js"),read("src/assets/css/reading-status.css"),read("src/assets/css/library-layout.css"),read("src/assets/js/library-footer-version.js"),read("tools/write-source.mjs"),read("tools/lib/build-context.mjs"),read("src/assets/js/admin-bootstrap.js"),read("src/assets/css/admin-version.css"),read("src/_headers"),read("package.json"),read("src/reader.html"),read("src/index.html"),read("src/nsfw.html"),read("src/series.html")
]);

if(!facade.includes('./domain/reading-state.js')||!facade.includes('window.ShadowGardenReadingStatus'))fail("reading-status.js must remain the R2 compatibility facade for public UI");
for(const marker of ['KEY = "sg-finished-books"','MARKER_PREFIX = "sg-finished:"','UNREAD: "unread"','IN_PROGRESS: "in-progress"','FINISHED: "finished"','setVolumeFinished','progressAtBeginning','volumeState','actionLabelForState','clearVolumeProgress','seriesFinished','latestActiveEntry'])if(!stateSource.includes(marker))fail(`canonical reading-state service is missing ${marker}`);
if(stateSource.includes("fetch(")||progressSource.includes("fetch("))fail("reading state/progress must remain browser-local");
for(const marker of ['../domain/progress.js','../domain/bookmarks.js','canonicalIdentity','writeProgressAliases','publicIdentity'])if(!readerStorage.includes(marker))fail(`Reader storage is missing ${marker}`);
if(readerStorage.includes('localStorage.')||readerStorage.includes('__sgReaderPublicBookId'))fail("Reader storage must use explicit R4 session identities through R2 services");

for(const marker of ["volume-finished-toggle","data-sg-finished-toggle","Mark as Finished","readingState.volumeAliases","readingState.setAliasesFinished","document.addEventListener(\"change\"","document.addEventListener(\"click\"","volume-complete-next","persist(true,{quiet:true})","volume-end-page-continuous"])if(!readerCompletion.includes(marker))fail(`Reader completion controller is missing ${marker}`);
if(!continuousCore.includes("cloneNode(true)")||!continuousCore.includes("volume-end-page-continuous"))fail("Continuous Reader must retain cloned end-page behavior");
if(readerCompletion.includes('toggle.addEventListener("change"'))fail("Finished persistence must remain delegated for the Continuous clone");
for(const marker of ["restartRequested","resetReadAgain","readingState.clearProgressAliases","catalog.findVolumeEntry","publicBookId","sourcePath","finalizeBookSession"])if(!readerSession.includes(marker))fail(`Reader book-session boundary is missing ${marker}`);
for(const marker of ["createAuthorizedBookSession","startReader","finalizeBookSession"])if(!readerBootstrap.includes(marker))fail(`Reader bootstrap is missing ${marker}`);
for(const retired of ["ReaderURLSearchParams","__sgReaderPublicBookId","__sgReaderSourcePath","setInterval(sync,500)"])if(readerBootstrap.includes(retired)||readerSession.includes(retired))fail(`retired Reader bootstrap workaround returned: ${retired}`);
for(const marker of ["createReaderStorage","createProgressController","createBookmarksController","createPageNavigationInput","createImageFocusController","createCompletionController","createPageMapController","session.sourcePath","session.publicBookId||session.storageIdentity","wire:wireRendition"])if(!readerApp.includes(marker))fail(`Reader app orchestrator is missing ${marker}`);
for(const marker of ["pageSwipeDirection","touchstart","touchend","wheel"]){if(!pageInput.includes(marker))fail(`Reader Pages input owner is missing ${marker}`)}
if(pageInput.includes('addEventListener("touchmove"')||pageInput.includes("touch-action"))fail("Pages input must not intercept Continuous vertical touch movement");
for(const marker of ["openImageFocus","closeImageFocus",'mode:"pinch"','mode:"pan"',"reader-image-focus-zoomed"]){if(!imageFocus.includes(marker))fail(`Reader image-focus owner is missing ${marker}`)}
if(imageFocus.includes('doc.addEventListener("touchmove"')||imageFocus.includes("zoomViewport"))fail("image focus must not restore page-wide touchmove/zoom interception");
if(!readerHtml.includes("reader-bootstrap.js")||!readerHtml.includes("reader-image-focus.css")||!readerHtml.includes('id="imageFocus"')||!readerHtml.includes('id="imageFocusViewport"')||!readerHtml.includes('<div id="viewer" class="viewer"></div>'))fail("Reader HTML must load the R4.1 app plus isolated image-focus surface");
for(const retired of ["reader-polish.js","reader-v1.10.1.js","reader-gesture-hook.js","reader-wheel-pages.js","reader-finished.js","reader/gestures.js","reader-zoom.css"])if(readerHtml.includes(retired))fail(`retired Reader controller/style is still loaded: ${retired}`);

for(const marker of ["series-renderers.js","readingState.EVENT","pageshow","preferences.setPinned"])if(!series.includes(marker))fail(`Series controller is missing ${marker}`);
for(const marker of ["finished-volume-badge","data-volume-state","data-reading-state","readingState.volumeEntries","readingState.preferredSeriesEntry","volume-cover-link","volumeActionFor"])if(!seriesRenderers.includes(marker))fail(`Series renderer is missing three-state marker ${marker}`);
for(const marker of ["RETURN TO THE FIRST PAGE","Walk this volume from the beginning?","restart: true","clearVolumeProgress","setVolumeFinished","data-volume-action","Keep My Place","Begin Again","bookmarks remain untouched"])if(!volumeActions.includes(marker))fail(`shared Read Again flow is missing ${marker}`);
for(const marker of [".read-again-dialog",".read-again-actions",".read-again-confirm","::backdrop"])if(!volumeActionsStyle.includes(marker))fail(`shared Read Again styling is missing ${marker}`);

for(const marker of ["data-reading-status=\"finished\"","data-reading-status=\"unfinished\"","params.set(\"reading\"","readingStatus.latestActiveEntry","preserveCount:true","pageshow"])if(!library.includes(marker))fail(`Library controller is missing ${marker}`);
for(const marker of ["finished-series-badge","compact-card-badge finished","renderReadingBanner","renderRecentlyAdded","data-volume-action","CONTINUE ·","✓ FINISHED"])if(!libraryRenderers.includes(marker))fail(`Library renderer is missing ${marker}`);
for(const marker of ["finished-volume-badge","finished-series-badge","reading-status-chips","compact-card-badge.finished",".catalog-grid.compact .finished-series-badge"])if(!style.includes(marker))fail(`reading-status.css is missing ${marker}`);
for(const marker of ["--sg-compact-cover-width:68px","--sg-compact-cover-width:74px","grid-template-columns:var(--sg-compact-cover-width) minmax(0,1fr) auto!important","grid-template-rows:1fr!important","min-height:0!important","grid-column:3!important","justify-self:end!important"])if(!compactStyle.includes(marker))fail(`compact Library layout CSS is missing ${marker}`);
if(compactStyle.includes("grid-template-rows:2.5em 1.2em 1.2em"))fail("Compact cards must not reserve a fake two-line title row");

for(const marker of ["libraryVersion","/data/version.json","v${version}","shortCommit"])if(!footerVersion.includes(marker))fail(`Library footer version client is missing ${marker}`);
for(const html of [indexHtml,adultHtml,seriesHtml]){
  if(!html.includes("reading-status.css")||!html.includes("volume-actions.css"))fail("Library/Series surfaces must load canonical reading/action presentation");
  for(const retired of ["library-finished-polish.js","library-series-polish.js","series-read-again.js","series-cover-links.js"])if(html.includes(retired))fail(`retired reading-state UI layer still loaded: ${retired}`);
}
for(const marker of ["version.json","loadBuildContext","shortCommit"])if(!writeSource.includes(marker))fail(`deployment version writer is missing ${marker}`);
for(const marker of ["CF_PAGES_COMMIT_SHA","shortCommit","builtAt","SOURCE_DATE_EPOCH"])if(!buildContext.includes(marker))fail(`deployment build-context owner is missing ${marker}`);
for(const marker of ["adminVersion","/data/version.json","shortCommit","admin-version-footer","document.body.appendChild(footer)"])if(!adminBootstrap.includes(marker))fail(`Keeper footer version UI is missing ${marker}`);
if(!adminVersion.includes(".admin-version-footer")||!adminVersion.includes("text-align:center"))fail("Keeper version styling must remain centered");
for(const marker of ["/assets/js/domain/*","/assets/js/reader/*","/assets/js/reader-bootstrap.js","/assets/js/series.js","/assets/js/series-renderers.js","/assets/js/library-renderers.js","/assets/js/public/volume-actions.js","/assets/css/reader-image-focus.css"])if(!headers.includes(marker))fail(`fresh-cache headers are missing ${marker}`);

const parsed=JSON.parse(pkg),[major,minor]=String(parsed.version||"").split(".").map(value=>Number.parseInt(value,10)||0);
if(major<1||(major===1&&minor<16))fail("canonical reading state requires v1.16.0 or newer");

class MemoryStorage{constructor(){this.values=new Map()}get length(){return this.values.size}key(i){return [...this.values.keys()][i]??null}getItem(k){return this.values.has(String(k))?this.values.get(String(k)):null}setItem(k,v){this.values.set(String(k),String(v))}removeItem(k){this.values.delete(String(k))}}
globalThis.localStorage=new MemoryStorage();globalThis.location={href:"https://shadowgarden-bon.pages.dev/",origin:"https://shadowgarden-bon.pages.dev"};globalThis.dispatchEvent=()=>true;globalThis.CustomEvent=class{constructor(type,init={}){this.type=type;this.detail=init.detail}};
try{
  const api=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/domain/reading-state.js")).href}?check=${Date.now()}`),progress=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/domain/progress.js")).href}?check=${Date.now()}`);
  const seriesId="example-series",volume={file:"bk_1234567890123456789012",bookId:"bk_1234567890123456789012",number:2,title:"Volume 2"},aliases=api.volumeAliases(seriesId,volume,1);
  if(api.volumeState(seriesId,volume,1)!==api.STATES.UNREAD||api.actionLabelForState(api.STATES.UNREAD)!=="Read")fail("never-opened volume must be Unread / Read");
  progress.writeProgress(volume.file,{file:volume.file,page:1,totalPages:120,percentage:.08,updatedAt:100});if(api.volumeState(seriesId,volume,1)!==api.STATES.UNREAD)fail("page 1 must remain Unread");
  progress.writeProgress(volume.file,{file:volume.file,page:2,totalPages:120,percentage:.02,updatedAt:200});if(api.volumeState(seriesId,volume,1)!==api.STATES.IN_PROGRESS||api.actionLabelForState(api.STATES.IN_PROGRESS)!=="Continue")fail("page 2+ must be In Progress / Continue");
  if(!api.setVolumeFinished(seriesId,volume,true,1))fail("Finished state must save across aliases");if(api.volumeState(seriesId,volume,1)!==api.STATES.FINISHED||api.actionLabelForState(api.STATES.FINISHED)!=="Read Again")fail("Finished must expose Read Again");
  if(!api.setVolumeFinished(seriesId,volume,false,1)||!api.clearVolumeProgress(seriesId,volume,1))fail("Read Again reset must clear Finished + progress");if(api.volumeState(seriesId,volume,1)!==api.STATES.UNREAD||api.volumeProgress(seriesId,volume,1)!==null)fail("Read Again reset must return Unread");if(aliases.some(id=>api.isFinished(id)))fail("Read Again reset must clear all Finished aliases");
}catch(error){fail(`three-state reading regression threw: ${error.message}`)}

if(failures.length){console.error(`Shadow Garden reading-status check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);failures.forEach(message=>console.error(`- ${message}`));process.exitCode=1}else console.log("Shadow Garden canonical Unread/In Progress/Finished state checks passed across R4.1 Reader and R3 public UI owners.");
