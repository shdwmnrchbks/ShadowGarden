import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");

class MemoryStorage {
  constructor(){this.values=new Map()}
  get length(){return this.values.size}
  key(index){return [...this.values.keys()][index]??null}
  getItem(key){return this.values.has(String(key))?this.values.get(String(key)):null}
  setItem(key,value){this.values.set(String(key),String(value))}
  removeItem(key){this.values.delete(String(key))}
  clear(){this.values.clear()}
}

globalThis.localStorage=new MemoryStorage();
globalThis.location={href:"https://shadowgarden-bon.pages.dev/series.html",origin:"https://shadowgarden-bon.pages.dev"};
const events=[];
globalThis.dispatchEvent=event=>{events.push(event);return true};
globalThis.CustomEvent=class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}};

const importFresh=relative=>import(`${pathToFileURL(path.join(ROOT,relative)).href}?r2=${Date.now()}-${Math.random()}`);

const [pkgText,roadmap,headers,facade,dataSource,readerStorageSource,library,series,mobileFilter,navPinned,publicPolish,readerBootstrap,readAgain]=await Promise.all([
  read("package.json"),
  read("docs/roadmaps/REFACTOR_ROADMAP.md"),
  read("src/_headers"),
  read("src/assets/js/reading-status.js"),
  read("src/assets/js/data-source.js"),
  read("src/assets/js/reader/storage.js"),
  read("src/assets/js/library.js"),
  read("src/assets/js/series.js"),
  read("src/assets/js/library-mobile-filter.js"),
  read("src/assets/js/nav-pinned.js"),
  read("src/assets/js/library-series-polish.js"),
  read("src/assets/js/reader-bootstrap.js"),
  read("src/assets/js/series-read-again.js")
]);

for(const file of [
  "src/assets/js/domain/index.js",
  "src/assets/js/domain/storage.js",
  "src/assets/js/domain/book-identity.js",
  "src/assets/js/domain/catalog.js",
  "src/assets/js/domain/progress.js",
  "src/assets/js/domain/bookmarks.js",
  "src/assets/js/domain/preferences.js",
  "src/assets/js/domain/reading-state.js",
  "src/assets/js/domain/urls.js",
  "src/assets/js/domain/format.js"
]){
  try{await fs.access(path.join(ROOT,file))}catch{fail(`R2 domain module is missing: ${file}`)}
}

const domain=await importFresh("src/assets/js/domain/index.js");
const {readingState,progress,bookmarks,preferences,catalog,identity,urls,format}=domain;

const seriesId="r2-example";
const publicId="bk_1234567890123456789012";
const sourcePath="/media/shadow-garden/books/r2-example/volume-1.epub";
const volume={bookId:publicId,file:publicId,number:1,title:"Volume 1"};

if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.UNREAD||readingState.actionLabelForState(readingState.STATES.UNREAD)!=="Read")fail("R2 state machine must map a never-opened volume to Unread / Read");
progress.writeProgress(publicId,{page:1,totalPages:100,percentage:.17,updatedAt:10},{canonicalIdentity:publicId});
if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.UNREAD)fail("page 1 / cover must remain Unread even when EPUB percentage is nonzero");
progress.writeProgress(publicId,{page:2,totalPages:100,percentage:.02,updatedAt:20},{canonicalIdentity:publicId});
if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.IN_PROGRESS||readingState.actionLabelForState(readingState.STATES.IN_PROGRESS)!=="Continue")fail("page 2+ must map to In Progress / Continue");
if(!readingState.setVolumeFinished(seriesId,volume,true,0))fail("Finished state must persist through the canonical reading-state service");
if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.FINISHED||readingState.actionLabelForState(readingState.STATES.FINISHED)!=="Read Again")fail("Finished must override progress and map to Read Again");
if(!readingState.setVolumeFinished(seriesId,volume,false,0)||!readingState.clearVolumeProgress(seriesId,volume,0))fail("Read Again reset must clear Finished and progress through the domain service");
if(readingState.volumeState(seriesId,volume,0)!==readingState.STATES.UNREAD)fail("Read Again reset must return a volume to Unread");

progress.writeProgressAliases([sourcePath,publicId],{page:8,percentage:.4,updatedAt:30},{canonicalIdentity:publicId});
for(const alias of [sourcePath,publicId]){
  const item=progress.readProgress(alias);
  if(item?.file!==publicId||item?.page!==8)fail(`canonical progress alias write failed for ${alias}`);
}
bookmarks.writeBookmarksAliases([sourcePath,publicId],[{cfi:"epubcfi(/6/2)",label:"Test"}]);
for(const alias of [sourcePath,publicId])if(bookmarks.readBookmarks(alias)[0]?.label!=="Test")fail(`canonical bookmark alias write failed for ${alias}`);

preferences.setPinned(seriesId,true);
if(!preferences.isPinned(seriesId))fail("pinned series must be owned by the R2 preference service");
preferences.setLibraryView("main","compact");
if(preferences.libraryView("main")!=="compact")fail("Library view must be owned by the R2 preference service");
preferences.setMobileFiltersCollapsed("main",false);
if(preferences.mobileFiltersCollapsed("main")!==false)fail("mobile filter state must be owned by the R2 preference service");
preferences.setAdultAcknowledged(true);
if(!preferences.adultAcknowledged())fail("Adult acknowledgement must be owned by the R2 preference service");
preferences.setAdultAcknowledged(false);
if(preferences.adultAcknowledged())fail("Adult acknowledgement removal failed");

const normalized=catalog.normalizeCatalogShape({series:[{id:"demo",status:"completed",tags:["Fantasy","ongoing"],volumes:[{bookId:publicId,title:"One"}]}]}).catalog;
const normalizedSeries=catalog.seriesById(normalized,"demo");
if(normalizedSeries?.status!=="Complete"||!normalizedSeries?.tags?.includes("Complete")||normalizedSeries?.tags?.includes("ongoing"))fail("catalog status/tag normalization must be canonical in R2");
if(normalizedSeries?.volumes?.[0]?.file!==publicId)fail("catalog normalization must expose the opaque bookId as the public volume file identity");
if(catalog.findVolumeEntry(normalized,"demo",publicId)?.index!==0)fail("catalog volume lookup must resolve canonical book identity");

if(!identity.isBookId(publicId)||identity.stableVolumeId(seriesId,volume,0)!==`series:${seriesId}:volume:1`)fail("book identity helpers must retain opaque and stable volume identities");
if(urls.readerUrl(publicId,seriesId)!==`/reader.html?book=${encodeURIComponent(publicId)}&series=${encodeURIComponent(seriesId)}`)fail("Reader URL builder drifted");
if(urls.readerUrl(publicId,seriesId,{restart:true}).includes("restart=1")!==true)fail("Read Again URL builder must support restart=1");
if(format.formatBytes(1048576)!=="1.0 MB"||format.escapeHtml("<x>")!=="&lt;x&gt;")fail("shared format helpers drifted");

if(!facade.includes('./domain/reading-state.js')||!facade.includes('window.ShadowGardenReadingStatus'))fail("reading-status.js must remain a compatibility facade over the R2 state service");
if(!dataSource.includes('domain.catalog.normalizeCatalog')||dataSource.includes('for(let i=0;i<localStorage.length'))fail("data-source.js must delegate catalog/state migration to the R2 domain layer");
for(const marker of ['../domain/progress.js','../domain/bookmarks.js','canonicalIdentity'])if(!readerStorageSource.includes(marker))fail(`Reader storage must use R2 service marker ${marker}`);
if(readerStorageSource.includes('localStorage.'))fail("Reader storage must not write progress/bookmarks directly to localStorage");

for(const [name,source] of [["Library",library],["Series",series],["mobile filter",mobileFilter],["pinned navigation",navPinned],["public Library/Series compatibility layer",publicPolish],["Reader bootstrap",readerBootstrap]]){
  if(source.includes('localStorage.'))fail(`${name} must consume owned R2 persistence services instead of direct localStorage access`);
}
for(const marker of ['latestActiveEntry','preferences.libraryView','preferences.setLibraryView','isReadingStorageKey'])if(!library.includes(marker))fail(`Library is missing shared R2 state marker ${marker}`);
for(const marker of ['reading.volumeEntries','reading.preferredSeriesEntry','preferences.setPinned','catalog.seriesById'])if(!series.includes(marker))fail(`Series is missing shared R2 state marker ${marker}`);
if(!mobileFilter.includes('preferences.mobileFiltersCollapsed')||!navPinned.includes('preferences.pinnedIds'))fail("Library preference consumers must use the shared R2 service");
for(const marker of ['domain.urls','readingState.clearProgressAliases','catalog.findVolumeEntry'])if(!readerBootstrap.includes(marker))fail(`Reader bootstrap is missing R2 domain marker ${marker}`);
if(readerBootstrap.includes('installCanonicalReaderMirror')||readerBootstrap.includes('setInterval(sync,500)'))fail("R2 canonical Reader writes make the old polling progress mirror obsolete");
if(!readAgain.includes('catalog.findVolumeEntry')||!readAgain.includes('reading.clearVolumeProgress'))fail("Read Again must reset through the shared R2 catalog/reading-state services");
if(!headers.includes('/assets/js/domain/*')||!headers.includes('Cache-Control: no-store'))fail("R2 browser modules must retain fresh-cache headers");

const pkg=JSON.parse(pkgText);
if(pkg.version!=="1.16.0")fail(`R2 release version must be 1.16.0, found ${pkg.version}`);
if(!String(pkg.scripts?.check||"").includes("check-r2.mjs"))fail("tools/check-r2.mjs must remain in npm run check");
if(!roadmap.includes("R2. Shared domain and state layer | ✅ Done"))fail("refactor roadmap must record R2 as done after acceptance");

if(failures.length){
  console.error(`Shadow Garden R2 shared domain/state check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden R2 catalog, identity, reading-state, progress, bookmark, preference, URL, and formatting contracts passed.");
}
