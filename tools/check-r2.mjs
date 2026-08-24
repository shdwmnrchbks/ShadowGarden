import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");

class MemoryStorage{constructor(){this.values=new Map()}get length(){return this.values.size}key(i){return [...this.values.keys()][i]??null}getItem(k){return this.values.has(String(k))?this.values.get(String(k)):null}setItem(k,v){this.values.set(String(k),String(v))}removeItem(k){this.values.delete(String(k))}clear(){this.values.clear()}}
globalThis.localStorage=new MemoryStorage();
globalThis.location={href:"https://shadowgarden-bon.pages.dev/series.html",origin:"https://shadowgarden-bon.pages.dev"};
globalThis.dispatchEvent=()=>true;
globalThis.CustomEvent=class{constructor(type,init={}){this.type=type;this.detail=init.detail}};
const importFresh=relative=>import(`${pathToFileURL(path.join(ROOT,relative)).href}?r2=${Date.now()}-${Math.random()}`);

const [pkgText,roadmap,headers,facade,dataSource,readerStorage,library,series,mobileFilter,navPinned,readerBootstrap,volumeActions]=await Promise.all([
  read("package.json"),read("docs/roadmaps/REFACTOR_ROADMAP.md"),read("src/_headers"),read("src/assets/js/reading-status.js"),read("src/assets/js/data-source.js"),read("src/assets/js/reader/storage.js"),read("src/assets/js/library.js"),read("src/assets/js/series.js"),read("src/assets/js/library-mobile-filter.js"),read("src/assets/js/nav-pinned.js"),read("src/assets/js/reader-bootstrap.js"),read("src/assets/js/public/volume-actions.js")
]);

for(const file of ["index.js","storage.js","book-identity.js","catalog.js","progress.js","bookmarks.js","preferences.js","reading-state.js","urls.js","format.js"]){try{await fs.access(path.join(ROOT,"src/assets/js/domain",file))}catch{fail(`R2 domain module is missing: ${file}`)}}
const {readingState,progress,bookmarks,preferences,catalog,identity,urls,format}=await importFresh("src/assets/js/domain/index.js");
const seriesId="r2-example",publicId="bk_1234567890123456789012",sourcePath="/media/shadow-garden/books/r2-example/volume-1.epub";
const volume={bookId:publicId,file:publicId,number:1,title:"Volume 1"};
if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.UNREAD||readingState.actionLabelForState(readingState.STATES.UNREAD)!=="Read")fail("R2 state machine must map a never-opened volume to Unread / Read");
progress.writeProgress(publicId,{page:1,totalPages:100,percentage:.17,updatedAt:10},{canonicalIdentity:publicId});
if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.UNREAD)fail("page 1 / cover must remain Unread");
progress.writeProgress(publicId,{page:2,totalPages:100,percentage:.02,updatedAt:20},{canonicalIdentity:publicId});
if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.IN_PROGRESS)fail("page 2+ must be In Progress");
readingState.setVolumeFinished(seriesId,volume,true,0);
if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.FINISHED||readingState.actionLabelForState(readingState.STATES.FINISHED)!=="Read Again")fail("Finished must override progress");
readingState.setVolumeFinished(seriesId,volume,false,0);readingState.clearVolumeProgress(seriesId,volume,0);
if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.UNREAD)fail("Read Again reset must return Unread");

progress.writeProgressAliases([sourcePath,publicId],{page:8,percentage:.4,updatedAt:30},{canonicalIdentity:publicId});
for(const alias of [sourcePath,publicId]){const item=progress.readProgress(alias);if(item?.file!==publicId||item?.page!==8)fail(`progress alias write failed for ${alias}`)}
bookmarks.writeBookmarksAliases([sourcePath,publicId],[{cfi:"epubcfi(/6/2)",label:"Test"}]);
for(const alias of [sourcePath,publicId])if(bookmarks.readBookmarks(alias)[0]?.label!=="Test")fail(`bookmark alias write failed for ${alias}`);
preferences.setPinned(seriesId,true);if(!preferences.isPinned(seriesId))fail("pinned state must remain R2-owned");
preferences.setLibraryView("main","compact");if(preferences.libraryView("main")!=="compact")fail("Library view must remain R2-owned");
const normalized=catalog.normalizeCatalogShape({series:[{id:"demo",status:"completed",tags:["Fantasy","ongoing"],volumes:[{bookId:publicId,title:"One"}]}]}).catalog;
if(catalog.seriesById(normalized,"demo")?.status!=="Complete"||catalog.findVolumeEntry(normalized,"demo",publicId)?.index!==0)fail("catalog normalization/lookup drifted");
if(!identity.isBookId(publicId)||identity.stableVolumeId(seriesId,volume,0)!==`series:${seriesId}:volume:1`)fail("book identity contract drifted");
if(!urls.readerUrl(publicId,seriesId,{restart:true}).includes("restart=1")||format.formatBytes(1048576)!=="1.0 MB")fail("URL/format helpers drifted");

if(!facade.includes('./domain/reading-state.js')||!facade.includes('window.ShadowGardenReadingStatus'))fail("reading-status compatibility facade drifted");
if(!dataSource.includes('domain.catalog.normalizeCatalog')||dataSource.includes('for(let i=0;i<localStorage.length'))fail("data-source must delegate catalog/state migration to R2");
for(const marker of ['../domain/progress.js','../domain/bookmarks.js','canonicalIdentity'])if(!readerStorage.includes(marker))fail(`Reader storage is missing ${marker}`);
for(const [name,source] of [["Library",library],["Series",series],["mobile filter",mobileFilter],["pinned navigation",navPinned],["Reader bootstrap",readerBootstrap]])if(source.includes('localStorage.'))fail(`${name} must not bypass R2 persistence owners`);
for(const marker of ['preferences.libraryView','preferences.setLibraryView','isReadingStorageKey'])if(!library.includes(marker))fail(`Library is missing R2 marker ${marker}`);
for(const marker of ['readingState.EVENT','preferences.setPinned','catalog.seriesById'])if(!series.includes(marker))fail(`Series is missing R2 marker ${marker}`);
if(!mobileFilter.includes('preferences.mobileFiltersCollapsed')||!navPinned.includes('preferences.pinnedIds'))fail("preference consumers must use R2 services");
for(const marker of ['domain.urls','readingState.clearProgressAliases','catalog.findVolumeEntry'])if(!readerBootstrap.includes(marker))fail(`Reader bootstrap is missing ${marker}`);
if(readerBootstrap.includes('setInterval(sync,500)'))fail("obsolete Reader progress mirror returned");
for(const marker of ['catalog.findVolumeEntry','readingState.clearVolumeProgress','readingState.setVolumeFinished'])if(!volumeActions.includes(marker))fail(`public Read Again pipeline must reset through R2 service: ${marker}`);
if(!headers.includes('/assets/js/domain/*'))fail("R2 domain modules must retain fresh-cache headers");

const pkg=JSON.parse(pkgText);const [major,minor]=pkg.version.split('.').map(Number);
if(major<1||(major===1&&minor<16))fail(`R2 baseline requires v1.16.0 or newer, found ${pkg.version}`);
if(!String(pkg.scripts?.check||"").includes("check-r2.mjs"))fail("R2 guardrail must remain in npm run check");
if(!roadmap.includes("R2. Shared domain and state layer | ✅ Done"))fail("roadmap must retain R2 complete");
if(failures.length){console.error(`Shadow Garden R2 shared domain/state check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);failures.forEach(message=>console.error(`- ${message}`));process.exitCode=1}else console.log("Shadow Garden R2 canonical domain/state contracts passed under current UI owners.");
