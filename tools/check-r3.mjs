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
globalThis.location={href:"https://shadowgarden-bon.pages.dev/",origin:"https://shadowgarden-bon.pages.dev"};
globalThis.dispatchEvent=()=>true;
globalThis.CustomEvent=class{constructor(type,init={}){this.type=type;this.detail=init.detail}};

const [library,libraryModel,libraryRenderers,series,seriesRenderers,volumeActions,indexHtml,adultHtml,seriesHtml,headers,roadmap,pkgText]=await Promise.all([
  read("src/assets/js/library.js"),read("src/assets/js/library-model.js"),read("src/assets/js/library-renderers.js"),read("src/assets/js/series.js"),read("src/assets/js/series-renderers.js"),read("src/assets/js/public/volume-actions.js"),read("src/index.html"),read("src/nsfw.html"),read("src/series.html"),read("src/_headers"),read("docs/roadmaps/REFACTOR_ROADMAP.md"),read("package.json")
]);

for(const retired of ["src/assets/js/library-series-polish.js","src/assets/js/library-finished-polish.js","src/assets/js/series-read-again.js","src/assets/js/series-cover-links.js","src/assets/css/series-read-again.css"]){
  if(await exists(retired))fail(`R3 retired ownership layer returned: ${retired}`);
}

for(const marker of ["library-model.js","library-renderers.js","public/volume-actions.js","pageshow","preserveCount:true","preferences.libraryView","readingStatus.libraryBannerEntry"]){if(!library.includes(marker))fail(`Library controller is missing ${marker}`)}
if(library.includes("MutationObserver"))fail("Library controller must not use post-render MutationObserver repair");
for(const marker of ["filterAndSort","recentlyAdded","filterOptions","validateFilterState"]){if(!libraryModel.includes(marker))fail(`Library query model is missing ${marker}`)}
for(const marker of ["compact-card-badges","renderRecentlyAdded","renderReadingBanner","recent-volume","data-volume-action","CONTINUE ·","✓ FINISHED"]){if(!libraryRenderers.includes(marker))fail(`Library renderer is missing ${marker}`)}

for(const marker of ["series-renderers.js","public/volume-actions.js","pageshow","readingState.EVENT","preferences.PINNED_KEY"]){if(!series.includes(marker))fail(`Series controller is missing ${marker}`)}
if(series.includes("MutationObserver"))fail("Series controller must not use post-render MutationObserver repair");
for(const marker of ["volume-cover-link","data-volume-action","primary-button","tag-row","bannerBookId","finished-volume-badge"]){if(!seriesRenderers.includes(marker))fail(`Series renderer is missing ${marker}`)}

for(const marker of ["volumeActionFor","installVolumeActionController","confirmReadAgain","resetFinishedVolume","RETURN TO THE FIRST PAGE","Keep My Place","Begin Again","setVolumeFinished","clearVolumeProgress","restart: true","window.alert"]){if(!volumeActions.includes(marker))fail(`shared volume action controller is missing ${marker}`)}
if(!volumeActions.includes('link.dataset.volumeState !== readingState.STATES.FINISHED'))fail("ordinary Read/Continue links must stay native while Finished links enter the confirmation pipeline");

for(const html of [indexHtml,adultHtml,seriesHtml]){
  if(!html.includes("/assets/css/volume-actions.css"))fail("every Library/Series surface must load shared volume-action dialog styling");
  if(!html.includes("/assets/css/reading-status.css"))fail("every Library/Series surface must load reading-status presentation directly after R3");
  for(const retired of ["library-series-polish.js","library-finished-polish.js","series-read-again.js","series-cover-links.js","series-read-again.css"]){if(html.includes(retired))fail(`public HTML still references retired R3 layer ${retired}`)}
}
for(const marker of ["/assets/js/library-model.js","/assets/js/library-renderers.js","/assets/js/public/volume-actions.js","/assets/js/series-renderers.js","/assets/css/volume-actions.css"]){if(!headers.includes(marker))fail(`fresh-cache headers are missing ${marker}`)}

const actionModule=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/public/volume-actions.js")).href}?r3=${Date.now()}`);
const reading=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/domain/reading-state.js")).href}?r3=${Date.now()}`);
const progress=await import(`${pathToFileURL(path.join(ROOT,"src/assets/js/domain/progress.js")).href}?r3=${Date.now()}`);
const seriesFixture={id:"r3-series",volumes:[{file:"bk_1234567890123456789012",bookId:"bk_1234567890123456789012",number:1,title:"Volume 1"}]};
const volume=seriesFixture.volumes[0];
let action=actionModule.volumeActionFor(seriesFixture,volume,0);
if(action.state!==reading.STATES.UNREAD||action.label!=="Read")fail("shared volume action must expose Unread as Read");
progress.writeProgress(volume.file,{page:3,percentage:.1,updatedAt:2});
action=actionModule.volumeActionFor(seriesFixture,volume,0);
if(action.state!==reading.STATES.IN_PROGRESS||action.label!=="Continue")fail("shared volume action must expose In Progress as Continue");
reading.setVolumeFinished(seriesFixture.id,volume,true,0);
action=actionModule.volumeActionFor(seriesFixture,volume,0);
if(action.state!==reading.STATES.FINISHED||action.label!=="Read Again")fail("shared volume action must expose Finished as Read Again");

const pkg=JSON.parse(pkgText),[major,minor]=String(pkg.version||"").split(".").map(value=>Number.parseInt(value,10)||0);
if(major<1||(major===1&&minor<17))fail(`R3 baseline requires v1.17.0 or newer, found ${pkg.version}`);
if(!String(pkg.scripts?.check||"").includes("check-r3.mjs"))fail("R3 guardrail must remain in npm run check");
if(!roadmap.includes("R3. Library + Series decomposition | ✅ Done"))fail("refactor roadmap must record R3 as done after acceptance");

if(failures.length){
  console.error(`Shadow Garden R3 Library/Series decomposition check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else console.log("Shadow Garden R3 single-owner Library/Series rendering and volume-action contracts passed.");
