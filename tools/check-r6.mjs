import fs from "node:fs/promises";
import path from "node:path";
import { validObjectKey } from "../functions/services/storage.js";
import { validateUploadTarget } from "../functions/services/validation.js";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=file=>fs.readFile(path.join(ROOT,file),"utf8");
const semverAtLeast=(current,minimum)=>{
  const parse=value=>String(value||"").split(".").slice(0,3).map(item=>Number.parseInt(item,10)||0),a=parse(current),b=parse(minimum);
  for(let i=0;i<3;i++){if(a[i]>b[i])return true;if(a[i]<b[i])return false}return true;
};

const serviceFiles={
  http:"functions/services/http.js",storage:"functions/services/storage.js",auth:"functions/services/auth.js",media:"functions/services/media.js",
  catalog:"functions/services/catalog.js",validation:"functions/services/validation.js",abuse:"functions/services/abuse.js",admin:"functions/services/admin.js"
};
const routeFiles=[
  "functions/admin-access.js","functions/human-access.js","functions/book-access.js","functions/media/[[path]].js",
  "functions/admin-api/status.js","functions/admin-api/library.js","functions/admin-api/catalog.js","functions/admin-api/upload.js",
  "functions/admin-api/backup.js","functions/admin-api/maintenance.js","functions/admin-api/series-banner.js","functions/admin-api/abuse.js"
];
const serviceEntries=Object.fromEntries(await Promise.all(Object.entries(serviceFiles).map(async([name,file])=>[name,await read(file)])));
const [b2Facade,maintenanceFacade,roadmap,architecture,pkgText]=await Promise.all([
  read("functions/_lib/b2.js"),read("functions/_lib/garden-maintenance.js"),read("docs/roadmaps/REFACTOR_ROADMAP.md"),read("docs/architecture/FUNCTIONS_LAYER.md"),read("package.json")
]);
const pkg=JSON.parse(pkgText);

for(const file of routeFiles){
  const source=await read(file);
  if(!source.includes("services/"))fail(`${file} must delegate to the R6 service layer`);
  if(source.includes("_lib/"))fail(`${file} must not reach through the R6 service layer into _lib`);
  for(const forbidden of ["AwsClient","verifyMediaTicket(","verifyTurnstileToken(","adminAuthorized(","putObject(","getTextObject(","caches.default"]){if(source.includes(forbidden))fail(`${file} regained route-owned behavior: ${forbidden}`)}
  if(source.length>900)fail(`${file} is no longer a thin route adapter (${source.length} bytes)`);
}

for(const marker of ["json(","jsonWithCookies","sameOriginBrowserRequest","defer(","parseJson"]){if(!serviceEntries.http.includes(marker))fail(`HTTP service is missing ${marker}`)}
for(const marker of ["AwsClient","B2_BUCKET","B2_ENDPOINT","ROOT_PREFIX","validObjectKey","readClient","writeClient","getTextObject","headObject","putObject","deleteObject"]){if(!serviceEntries.storage.includes(marker))fail(`storage service is missing ${marker}`)}
for(const marker of ["adminTokenMatches","verifyAdminSession","adminAuthorized","handleAdminAccess","handleHumanAccess","verifyTurnstileToken","adminCooldown","registerAdminFailure","issueAdminSession"]){if(!serviceEntries.auth.includes(marker))fail(`auth service is missing ${marker}`)}
for(const marker of ["handleBookAccess","handleMediaRequest","incomingRange","verifyMediaTicket","verifyMediaTicketCookie","publicCatalogShape","Cross-Origin-Resource-Policy","!incomingRange","canonicalMediaCacheUrl"]){if(!serviceEntries.media.includes(marker))fail(`media service is missing ${marker}`)}
for(const marker of ["loadCatalogPair","saveCatalogPair","invalidateCatalogCache","snapshotCatalogs","appendTrashItem","handleCatalogPost","handleLibraryGet","handleLibraryPost","handleMaintenanceGet","handleMaintenancePost","handleSeriesBannerGet","handleSeriesBannerPost","handleBackupPost"]){if(!serviceEntries.catalog.includes(marker))fail(`catalog service is missing ${marker}`)}
for(const marker of ["MAX_UPLOAD_BYTES","OPAQUE_COVER_KEY","normalizeCatalogVolumeInput","validateUploadTarget","catalogHealth","checkObjectBatch"]){if(!serviceEntries.validation.includes(marker))fail(`validation service is missing ${marker}`)}
for(const marker of ["safeAbuseCooldown","recordAbuseSignal","handleAbuseAdmin","loadAbuseOverview","releaseAbuseClient"]){if(!serviceEntries.abuse.includes(marker))fail(`abuse service is missing ${marker}`)}
for(const marker of ["handleAdminStatus","handleAdminUpload","storageConfiguration","validateUploadTarget"]){if(!serviceEntries.admin.includes(marker))fail(`admin service is missing ${marker}`)}

const proxy=serviceEntries.media.slice(serviceEntries.media.indexOf("export async function handleMediaRequest"));
if(proxy.includes("safeAbuseCooldown("))fail("R6 must preserve the M8 rule that public cooldown enforcement stays outside /media/*");
if(!proxy.includes("!incomingRange"))fail("R6 must preserve stale Range recovery without persistent invalid-ticket scoring");
if(!serviceEntries.auth.includes("verifyAdminSession")||!serviceEntries.auth.includes("adminTokenMatches"))fail("R6 admin API authorization must still require signed session plus bearer token");

if(b2Facade.includes("new AwsClient")||b2Facade.includes("crypto.subtle.digest")||b2Facade.includes("function json"))fail("legacy b2.js must remain a compatibility facade, not a second implementation");
for(const marker of ["../services/storage.js","../services/auth.js","../services/http.js"]){if(!b2Facade.includes(marker))fail(`b2 compatibility facade is missing ${marker}`)}
if(maintenanceFacade.includes("putObject(")||maintenanceFacade.includes("loadJson("))fail("legacy garden-maintenance.js must remain a facade, not a second catalog implementation");
for(const marker of ["../services/catalog.js","../services/validation.js"]){if(!maintenanceFacade.includes(marker))fail(`garden-maintenance compatibility facade is missing ${marker}`)}

if(!validObjectKey("shadow-garden/books/example/book.epub",["shadow-garden/books/"]))fail("storage validObjectKey rejected a valid book key");
for(const bad of ["../secret","shadow-garden/../secret","shadow-garden/books/../../secret","shadow-garden\\books\\secret"]){if(validObjectKey(bad))fail(`storage validObjectKey accepted traversal/invalid key ${bad}`)}
const goodCover="shadow-garden/covers/cv_1234567890abcdefghijk-detail.webp";
if(!validateUploadTarget(goodCover,"image/webp").ok)fail("opaque cover validation rejected a valid cv_ key");
if(validateUploadTarget("shadow-garden/covers/series-1-detail.webp","image/webp").ok)fail("opaque cover validation accepted a descriptive cover key");
if(validateUploadTarget("shadow-garden/books/example.epub","text/plain").ok)fail("EPUB validation accepted an invalid content type");

for(const marker of ["Pages Functions Service Layer","Thin route adapters","Authentication service","Media service","Catalog service","Storage service","Validation service","Abuse service","Security invariants"]){if(!architecture.includes(marker))fail(`FUNCTIONS_LAYER.md is missing ${marker}`)}
if(!roadmap.includes("R6. Pages Functions service layer | ✅ Done"))fail("Refactor roadmap must record R6 complete");
if(!roadmap.includes("R7. CSS and design-system consolidation |"))fail("R6 roadmap must retain the R7 CSS/design-system milestone");
if(!semverAtLeast(pkg.version,"1.21.0"))fail(`R6 requires v1.21.0 or newer, found ${pkg.version}`);
if(!String(pkg.scripts?.check||"").includes("check-r6.mjs"))fail("tools/check-r6.mjs must remain in npm run check");

if(failures.length){console.error(`Shadow Garden R6 Pages Functions service-layer check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);failures.forEach(message=>console.error(`- ${message}`));process.exitCode=1}
else console.log("Shadow Garden R6 thin routes, service ownership, validation, storage, and security boundaries passed.");
