import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=file=>fs.readFile(path.join(ROOT,file),"utf8");
const exists=async file=>{try{await fs.access(path.join(ROOT,file));return true}catch{return false}};

const [pkgText,roadmap,readerDoc,readerHtml,app,pageInput,imageFocus,focusCss,headers,manifestText,legacyText]=await Promise.all([
  read("package.json"),read("docs/roadmaps/REFACTOR_ROADMAP.md"),read("docs/architecture/READER_LAYER.md"),read("src/reader.html"),read("src/assets/js/reader/app.js"),read("src/assets/js/reader/page-navigation-input.js"),read("src/assets/js/reader/image-focus.js"),read("src/assets/css/reader-image-focus.css"),read("src/_headers"),read("docs/architecture/v1-entrypoints.json"),read("docs/architecture/r1-legacy-source-exceptions.json")
]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText),legacy=JSON.parse(legacyText);

for(const file of ["src/assets/js/reader/gestures.js","src/assets/css/reader-zoom.css"]){
  if(await exists(file))fail(`R4.1 retired hotfix-era Reader owner returned: ${file}`);
  if(!(legacy.removedDeadFiles||[]).includes(file))fail(`R1 dead-file manifest must remember R4.1 retirement: ${file}`);
}

for(const marker of ['from "./page-navigation-input.js"','from "./image-focus.js"','createPageNavigationInput','createImageFocusController','pageInputController.attachRendition','imageFocusController.attachRendition','wire:wireRendition','resetReaderInput','imageFocusController.isFocused'])if(!app.includes(marker))fail(`R4.1 Reader app is missing ${marker}`);
for(const retired of ["createGestureController","gestureController","syncFlow()","zoomViewport","zoomLayer","zoomInButton","zoomOutButton","zoomResetButton"]){if(app.includes(retired))fail(`R4.1 Reader app still contains retired combined/page-wide zoom plumbing: ${retired}`)}
if(/createRendition\(\{[^}]*\bwire\s*,/s.test(app))fail("Reader startup must never regress to an undeclared shorthand wire variable");

for(const marker of ["createPageNavigationInput","pageSwipeDirection",'getFlow?.()!=="paginated"','getSwipeTurns?.()===false','touchstart','touchcancel','touchend','wheel','shouldSuppressClick'])if(!pageInput.includes(marker))fail(`Pages input owner is missing ${marker}`);
for(const forbidden of ['addEventListener("touchmove"',"touch-action",'mode:"pinch"','mode:"pan"',"openImageFocus","reader-image-focus"]){if(pageInput.includes(forbidden))fail(`Pages input owner must not own Continuous/image zoom behavior: ${forbidden}`)}
if(!pageInput.includes('{capture:true,passive:true}'))fail("Pages touchstart must remain passive so Continuous/native scrolling is never blocked at gesture start");

for(const marker of ["createImageFocusController","imagePanBounds","openImageFocus","closeImageFocus",'doc.addEventListener("click"','mode:"pinch"','mode:"pan"','reader-image-focus-zoomed','image.style.transform','image?.clientWidth','image?.clientHeight','document.activeElement===closeButton'])if(!imageFocus.includes(marker))fail(`image-focus owner is missing ${marker}`);
for(const forbidden of ['doc.addEventListener("touchstart"','doc.addEventListener("touchmove"','doc.addEventListener("touchend"',"touch-action:pan-y","rendition.resize","pageMap"]){if(imageFocus.includes(forbidden))fail(`image-focus must not intercept live EPUB touch/layout state: ${forbidden}`)}
if(!imageFocus.includes('viewport?.addEventListener("touchmove"'))fail("pinch/pan touchmove must exist only on the temporary image-focus viewport");

for(const marker of [".reader-image-focus-viewport","touch-action:none",".reader-image-focus-image","transform-origin:center center",".reader-image-focus.reader-image-focus-zoomed",".reader-image-focus-close",".reader-image-focus-hint"]){if(!focusCss.includes(marker))fail(`R4.1 image-focus CSS is missing ${marker}`)}
for(const retired of [":has(","reader-zoomed","reader-zoom-viewport","reader-zoom-layer"]){if(focusCss.includes(retired))fail(`R4.1 image-focus CSS still uses retired page-wide/hotfix detection: ${retired}`)}

for(const marker of ['/assets/css/reader-image-focus.css','id="imageFocus"','tabindex="-1"','id="imageFocusViewport"','id="imageFocusImage"','Pinch to zoom','tap again to return','<div id="viewer" class="viewer"></div>'])if(!readerHtml.includes(marker))fail(`Reader HTML is missing stabilized image-focus contract ${marker}`);
for(const retired of ["/assets/css/reader-zoom.css",'id="zoomViewport"','id="zoomLayer"','id="zoomIn"','id="zoomOut"','id="zoomReset"','reader-zoom-setting'])if(readerHtml.includes(retired))fail(`Reader HTML still contains retired page-wide zoom surface ${retired}`);

if(!headers.includes("/assets/js/reader/*")||!headers.includes("/assets/css/reader-image-focus.css")||!headers.includes("Cache-Control: no-store"))fail("R4.1 Reader input/image-focus assets must remain fresh in the cache contract");
if(headers.includes("/assets/css/reader-zoom.css"))fail("retired reader-zoom.css must not remain in the cache contract");

const readerManifest=manifest.pages?.reader;
for(const marker of ["/assets/js/reader/page-navigation-input.js","/assets/js/reader/image-focus.js"]){if(!readerManifest?.runtimeLoaded?.includes(marker))fail(`R0 entrypoint manifest is missing R4.1 runtime owner ${marker}`)}
if(readerManifest?.runtimeLoaded?.includes("/assets/js/reader/gestures.js"))fail("R0 entrypoint manifest must not retain reader/gestures.js");
if(!readerManifest?.styles?.includes("/assets/css/reader-image-focus.css")||readerManifest.styles.includes("/assets/css/reader-zoom.css"))fail("R0 Reader style manifest must use reader-image-focus.css only");

for(const marker of ["R4 + R4.1 Reader architecture and stabilization","page-navigation-input.js","image-focus.js","Continuous mode receives no page-wide","reader-image-focus-zoomed","Hidden-control focus flaw"]){if(!readerDoc.includes(marker))fail(`Reader architecture document is missing R4.1 marker ${marker}`)}
if(!roadmap.includes("R4.1. Reader stabilization and consolidation | ✅ Done")||!roadmap.includes("**Release:** v1.19.0"))fail("Refactor roadmap must record R4.1 complete as v1.19.0");

try{
  const pageModule=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/reader/page-navigation-input.js")).href}?r41=${Date.now()}`);
  const imageModule=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/reader/image-focus.js")).href}?r41=${Date.now()}`);
  if(pageModule.pageSwipeDirection({dx:-70,dy:8,elapsed:300})!==1)fail("left swipe must request next page");
  if(pageModule.pageSwipeDirection({dx:70,dy:8,elapsed:300})!==-1)fail("right swipe must request previous page");
  if(pageModule.pageSwipeDirection({dx:20,dy:80,elapsed:300})!==0)fail("vertical touch movement must never become a Pages turn");
  if(pageModule.pageSwipeDirection({dx:-70,dy:8,elapsed:1200})!==0)fail("slow drag must not become a Pages turn");
  const bounds=imageModule.imagePanBounds({imageWidth:800,imageHeight:1200,viewportWidth:400,viewportHeight:600,scale:2});
  if(bounds.x!==600||bounds.y!==900)fail(`focused-image pan bounds drifted: ${JSON.stringify(bounds)}`);
  const atOne=imageModule.imagePanBounds({imageWidth:300,imageHeight:300,viewportWidth:600,viewportHeight:600,scale:1});
  if(atOne.x!==0||atOne.y!==0)fail("1x focused image must not expose empty-space pan bounds");
}catch(error){fail(`R4.1 input helper regression threw: ${error.message}`)}

if(pkg.version!=="1.19.0")fail(`R4.1 release version must be 1.19.0, found ${pkg.version}`);
if(!String(pkg.scripts?.check||"").includes("check-r4-1.mjs"))fail("tools/check-r4-1.mjs must remain in npm run check");

if(failures.length){console.error(`Shadow Garden R4.1 Reader stabilization check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);failures.forEach(message=>console.error(`- ${message}`));process.exitCode=1}
else console.log("Shadow Garden R4.1 split input ownership, native Continuous touch, image focus, and startup regression contracts passed.");
