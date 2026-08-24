import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=file=>fs.readFile(path.join(ROOT,file),"utf8");
const exists=async file=>{try{await fs.access(path.join(ROOT,file));return true}catch{return false}};

class MemoryStorage{
  constructor(){this.values=new Map()}
  get length(){return this.values.size}
  key(index){return [...this.values.keys()][index]??null}
  getItem(key){return this.values.has(String(key))?this.values.get(String(key)):null}
  setItem(key,value){this.values.set(String(key),String(value))}
  removeItem(key){this.values.delete(String(key))}
  clear(){this.values.clear()}
}
globalThis.localStorage=new MemoryStorage();
globalThis.location={href:"https://shadowgarden-bon.pages.dev/reader.html?book=bk_1234567890123456789012&series=example",origin:"https://shadowgarden-bon.pages.dev"};
globalThis.dispatchEvent=()=>true;
globalThis.CustomEvent=class{constructor(type,init={}){this.type=type;this.detail=init.detail}};

const [pkgText,roadmap,readerDoc,readerHtml,bootstrap,session,app,storage,settings,progress,bookmarks,completion,pageInput,imageFocus,rendition,paginated,continuous,pageMap,visualCache,continuousCore,focusCss,headers,legacyText,manifestText]=await Promise.all([
  read("package.json"),read("docs/roadmaps/REFACTOR_ROADMAP.md"),read("docs/architecture/READER_LAYER.md"),read("src/reader.html"),read("src/assets/js/reader-bootstrap.js"),read("src/assets/js/reader/book-session.js"),read("src/assets/js/reader/app.js"),read("src/assets/js/reader/storage.js"),read("src/assets/js/reader/settings.js"),read("src/assets/js/reader/progress-controller.js"),read("src/assets/js/reader/bookmarks-controller.js"),read("src/assets/js/reader/completion.js"),read("src/assets/js/reader/page-navigation-input.js"),read("src/assets/js/reader/image-focus.js"),read("src/assets/js/reader/rendition.js"),read("src/assets/js/reader/paginated.js"),read("src/assets/js/reader/continuous.js"),read("src/assets/js/reader/page-map.js"),read("src/assets/js/reader-visual-cache.js"),read("src/assets/js/reader-continuous-core.js"),read("src/assets/css/reader-image-focus.css"),read("src/_headers"),read("docs/architecture/r1-legacy-source-exceptions.json"),read("docs/architecture/v1-entrypoints.json")
]);
const pkg=JSON.parse(pkgText),legacy=JSON.parse(legacyText),manifest=JSON.parse(manifestText);

const retired=["src/assets/js/reader.js","src/assets/js/reader-polish.js","src/assets/js/reader-v1.10.1.js","src/assets/js/reader-gesture-hook.js","src/assets/js/reader-wheel-pages.js","src/assets/js/reader-finished.js"];
for(const file of retired){if(await exists(file))fail(`retired R4 Reader owner returned: ${file}`);if(!(legacy.removedDeadFiles||[]).includes(file))fail(`R1 dead-file manifest must remember R4 retirement: ${file}`)}

for(const marker of ['from "./reader/book-session.js"','from "./reader/app.js"','createAuthorizedBookSession','startReader','finalizeBookSession'])if(!bootstrap.includes(marker))fail(`Reader bootstrap is missing ${marker}`);
for(const retiredMarker of ["ReaderURLSearchParams","__sgReaderPublicBookId","__sgReaderSourcePath","window.ePub="]){if(bootstrap.includes(retiredMarker)||session.includes(retiredMarker))fail(`Reader bootstrap/session must not restore ${retiredMarker}`)}
for(const marker of ["access?.initial","publicBookId","sourcePath","restartRequested","resetReadAgain","preferences.adultAcknowledged","readingState.clearProgressAliases","finalizeBookSession"])if(!session.includes(marker))fail(`authorized Reader session is missing ${marker}`);

for(const marker of ["createReaderStorage","createThemeController","createTocController","createPageMapController","createSettingsController","createProgressController","createBookmarksController","createPageNavigationInput","createImageFocusController","createCompletionController","createPaginatedController","createContinuousController","createRendition","window.ePub(session.sourcePath)","session.publicBookId||session.storageIdentity","switchFlow"]){if(!app.includes(marker))fail(`Reader app orchestrator is missing ${marker}`)}
if(app.includes("localStorage."))fail("Reader app must not bypass canonical storage/domain owners");
if(!app.includes("bookUrl:session.publicBookId||session.storageIdentity"))fail("Page Map must prefer the opaque public book identity rather than the private media path");
if(!app.includes("wire:wireRendition"))fail("Reader rendition creation must pass the declared wireRendition callback explicitly");
if(/createRendition\(\{[^}]*\bwire\s*,/s.test(app))fail("Reader rendition creation must not reference an undeclared shorthand wire variable");

for(const marker of ['../domain/progress.js','../domain/bookmarks.js','publicIdentity','canonicalIdentity','READER_SETTINGS_KEY = "sg-reader-settings"','LEGACY_GESTURE_SETTINGS_KEY = "sg-reader-polish-settings"'])if(!storage.includes(marker))fail(`Reader storage is missing ${marker}`);
if(storage.includes("__sgReaderPublicBookId")||storage.includes("localStorage."))fail("Reader storage must receive explicit identities and delegate persistence to R2 services");
for(const marker of ["READER_DEFAULTS","swipeTurns:true","textWidthSetting","setFlow","storage.saveSettings","scrolled-doc"])if(!settings.includes(marker))fail(`Reader settings controller is missing ${marker}`);
if(settings.includes("MutationObserver")||settings.includes("localStorage."))fail("Reader settings must directly own its UI/persistence without observation or raw localStorage");
for(const marker of ["storage.saveProgress","canonicalIdentity","pageMap","targetForPercentage","locations.generate","restoreSaved","currentPosition"]){if(!progress.includes(marker))fail(`Reader progress controller is missing ${marker}`)}
for(const marker of ["storage.loadBookmarks","storage.saveBookmarks","pageMapFingerprint","targetForPosition","bookmarkButton"]){if(!bookmarks.includes(marker))fail(`Reader bookmark controller is missing ${marker}`)}
for(const marker of ["readingState.volumeAliases","readingState.setAliasesFinished","volume-finished-toggle","volume-complete-next","persist(true,{quiet:true})","volume-end-page-continuous"]){if(!completion.includes(marker))fail(`Reader completion controller is missing ${marker}`)}

for(const marker of ["createPageNavigationInput","pageSwipeDirection","touchstart","touchend","wheel"]){if(!pageInput.includes(marker))fail(`Pages input owner is missing ${marker}`)}
for(const marker of ["createImageFocusController","openImageFocus","closeImageFocus",'mode:"pinch"','mode:"pan"',"reader-image-focus-zoomed"]){if(!imageFocus.includes(marker))fail(`image-focus owner is missing ${marker}`)}
for(const marker of [".reader-image-focus",".reader-image-focus-viewport",".reader-image-focus-image",".reader-image-focus-zoomed"]){if(!focusCss.includes(marker))fail(`image-focus CSS is missing ${marker}`)}

for(const marker of ["paginatedNeedsSinglePage","pageMapLayoutMetrics","captureRenditionPosition","destroyRendition"]){if(!rendition.includes(marker))fail(`Reader rendition adapter is missing ${marker}`)}
if(!paginated.includes("rendition.next")||!paginated.includes("rendition.prev"))fail("Paginated adapter must own next/previous rendition commands");
for(const marker of ["resolveHrefTarget","cfiFromElement","nextPaint","rendition.display"]){if(!continuous.includes(marker))fail(`Continuous application adapter is missing ${marker}`)}
if(!continuousCore.includes("BUFFER_EACH_SIDE")||!continuousCore.includes("cloneNode(true)")||!continuousCore.includes("volume-end-page-continuous"))fail("low-level bounded Continuous manager/end-page compatibility must remain intact during R4");
if(!pageMap.includes('DB_NAME = "shadow-garden-reader"')||!pageMap.includes('STORE_NAME = "page-maps"'))fail("canonical Page Map IndexedDB contract drifted during R4");
if(!visualCache.includes('CACHE_DB="shadow-garden-visual-pages"')||!visualCache.includes('body.dataset.sgSyntheticVisual="1"'))fail("Visual Page Cache/synthetic visual marker contract drifted during R4");

for(const retiredName of ["reader-polish.js","reader-v1.10.1.js","reader-gesture-hook.js","reader-wheel-pages.js","reader-finished.js"]){if(readerHtml.includes(retiredName))fail(`Reader HTML still loads retired R4 owner ${retiredName}`)}
for(const marker of ["/assets/js/reader-bootstrap.js","/assets/js/reader-a11y.js","/assets/js/reader-continuous-core.js","/assets/js/reader-visual-cache.js","/assets/css/reader-image-focus.css","/assets/css/reading-status.css"]){if(!readerHtml.includes(marker))fail(`Reader HTML is missing retained R4 asset ${marker}`)}
for(const marker of ["/assets/js/reader/*","/assets/js/reader-bootstrap.js","/assets/css/reader-image-focus.css","Cache-Control: no-store"]){if(!headers.includes(marker))fail(`fresh-cache contract is missing ${marker}`)}

const readerManifest=manifest.pages?.reader;
for(const marker of ["/assets/js/reader/app.js","/assets/js/reader/book-session.js","/assets/js/reader/page-navigation-input.js","/assets/js/reader/image-focus.js"]){if(!readerManifest?.runtimeLoaded?.includes(marker))fail(`R0 entrypoint manifest must record Reader runtime owner ${marker}`)}
for(const retiredName of ["/assets/js/reader.js","/assets/js/reader-polish.js","/assets/js/reader-gesture-hook.js","/assets/js/reader-wheel-pages.js","/assets/js/reader-finished.js"]){if(readerManifest?.scripts?.includes(retiredName)||readerManifest?.runtimeLoaded?.includes(retiredName))fail(`entrypoint manifest still includes retired Reader owner ${retiredName}`)}

for(const marker of ["Reader Application Layer","Authorized book session","Reader state invariants","Security invariants"]){if(!readerDoc.includes(marker))fail(`Reader architecture document is missing ${marker}`)}
if(!roadmap.includes("R4. Reader architecture refactor | ✅ Done"))fail("Refactor roadmap must retain R4 complete");

try{
  const readerStorage=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/reader/storage.js")).href}?r4=${Date.now()}`);
  const settingsModule=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/reader/settings.js")).href}?r4=${Date.now()}`);
  localStorage.clear();
  const publicId="bk_1234567890123456789012",source="/media/shadow-garden/books/example/volume-1.epub";
  const store=readerStorage.createReaderStorage({sourceIdentity:source,publicIdentity:publicId});
  if(store.canonicalIdentity!==publicId||!store.identities.includes(source)||!store.identities.includes(publicId))fail("Reader storage must expose one canonical public identity with private-source compatibility alias");
  store.saveProgress({page:7,percentage:.35,updatedAt:1});
  for(const alias of [source,publicId]){const item=JSON.parse(localStorage.getItem(`sg-progress:${alias}`)||"null");if(item?.file!==publicId||item?.page!==7)fail(`Reader progress alias write failed for ${alias}`)}
  store.saveSettings({...settingsModule.READER_DEFAULTS,swipeTurns:false});
  const primary=JSON.parse(localStorage.getItem("sg-reader-settings")||"null"),legacySwipe=JSON.parse(localStorage.getItem("sg-reader-polish-settings")||"null");
  if(primary?.swipeTurns!==false||legacySwipe?.swipeTurns!==false)fail("R4 settings must preserve the legacy swipe preference while making sg-reader-settings authoritative");
}catch(error){fail(`R4 Reader storage/settings regression threw: ${error.message}`)}

const [major=0,minor=0]=String(pkg.version||"").split(".").map(value=>Number.parseInt(value,10)||0);
if(major<1||(major===1&&minor<18))fail(`R4 Reader architecture requires v1.18.0 or newer, found ${pkg.version}`);
if(!String(pkg.scripts?.check||"").includes("check-r4.mjs"))fail("tools/check-r4.mjs must remain in npm run check");

if(failures.length){console.error(`Shadow Garden R4 Reader architecture check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);failures.forEach(message=>console.error(`- ${message}`));process.exitCode=1}
else console.log("Shadow Garden R4 Reader session, state, rendition, and application ownership contracts passed.");
