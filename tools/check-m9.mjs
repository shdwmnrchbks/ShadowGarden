import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");

const [mediaRoute,bookRoute,humanRoute,adminRoute,uploadRoute,media,auth,storage,validation,routes,headers,readerBootstrap,readerSession,readerApp,readerHtml,indexHtml,adultHtml,seriesHtml,status,adminCore,roadmap,audit,pkg]=await Promise.all([
  read("functions/media/[[path]].js"),read("functions/book-access.js"),read("functions/human-access.js"),read("functions/admin-access.js"),read("functions/admin-api/upload.js"),read("functions/services/media.js"),read("functions/services/auth.js"),read("functions/services/storage.js"),read("functions/services/validation.js"),read("src/_routes.json"),read("src/_headers"),read("src/assets/js/reader-bootstrap.js"),read("src/assets/js/reader/book-session.js"),read("src/assets/js/reader/app.js"),read("src/reader.html"),read("src/index.html"),read("src/nsfw.html"),read("src/series.html"),read("src/assets/js/reading-status.js"),read("src/assets/js/admin/core.js"),read("docs/roadmaps/SECURITY_ROADMAP.md"),read("docs/security/MILESTONE_9_FINAL_AUDIT.md"),read("package.json")
]);

for(const [name,source,marker] of [["media",mediaRoute,"handleMediaRequest"],["book-access",bookRoute,"handleBookAccess"],["human-access",humanRoute,"handleHumanAccess"],["admin-access",adminRoute,"handleAdminAccess"],["upload",uploadRoute,"handleAdminUpload"]]){
  if(!source.includes(marker)||!source.includes("services/"))fail(`${name} must remain a thin R6 service adapter`);
}
if(!media.includes("incomingRange")||!media.includes("authorizedEpub")||!media.includes("verifyMediaTicket")||!media.includes("verifyMediaTicketCookie"))fail("media service must preserve Range handling and signed-ticket authorization");
const proxy=media.slice(media.indexOf("export async function handleMediaRequest"));
if(proxy.includes("safeAbuseCooldown("))fail("Milestone 8 cooldown enforcement must remain outside /media/*");
if(!media.includes("safeAbuseCooldown")||!auth.includes("abuseCooldown"))fail("public abuse cooldown must remain on /book-access and /human-access");
if(!auth.includes("adminCooldown(env, request)"))fail("Garden Keeper must retain server-side cooldown enforcement");
for(const marker of ["verifyAdminSession","adminTokenMatches","adminAuthorized"]){if(!auth.includes(marker))fail(`admin auth service must retain ${marker}`)}
for(const marker of ["readClient","writeClient","validObjectKey","B2_BUCKET","ROOT_PREFIX"]){if(!storage.includes(marker))fail(`private B2 storage service is missing ${marker}`)}
const routeConfig=JSON.parse(routes);
for(const route of ["/media/*","/book-access","/human-access","/admin-access","/admin-api/*"]){if(!routeConfig.include?.includes(route))fail(`Pages Functions routing is missing ${route}`)}
for(const marker of ["/admin.html","/reader.html","/data/version.json","Cache-Control: no-store"]){if(!headers.includes(marker))fail(`security/cache headers are missing ${marker}`)}
for(const marker of ["createAuthorizedBookSession","startReader"]){if(!readerBootstrap.includes(marker))fail(`Reader bootstrap authorization orchestration is missing ${marker}`)}
for(const marker of ["ShadowGardenBookAccess","identity.isBookId","publicBookId","sourcePath","access?.initial"]){if(!readerSession.includes(marker))fail(`Reader book-session opaque authorization handoff is missing ${marker}`)}
if(!readerApp.includes("window.ePub(session.sourcePath)")||!readerApp.includes("session.publicBookId||session.storageIdentity"))fail("Reader must open the authorized private source while keying browser state/page map to the opaque public identity");
for(const retired of ["window.__sgReaderPublicBookId","ReaderURLSearchParams"]){if(readerBootstrap.includes(retired)||readerSession.includes(retired)||readerApp.includes(retired))fail(`retired Reader authorization workaround returned: ${retired}`)}
for(const html of [readerHtml,indexHtml,adultHtml,seriesHtml])if(/s3\.us-east-005\.backblazeb2\.com|backblazeb2\.com\/shadow-garden-books-01/i.test(html))fail("public HTML must not expose direct private B2 delivery URLs");
if(status.includes("fetch("))fail("finished-reading state must remain local-only and outside security/network boundaries");
for(const marker of ["crypto.getRandomValues","cv_${id}","opaqueCoverKey","coverKey","coverThumbKey"]){if(!adminCore.includes(marker))fail(`Garden Keeper opaque-cover handoff is missing ${marker}`)}
if(!validation.includes("OPAQUE_COVER_KEY")||!validation.includes("opaque cv_ identifier"))fail("cover uploads must be server-enforced to opaque cv_ object keys");
const [major=0,minor=0,patch=0]=String(JSON.parse(pkg).version||"").split(".").map(value=>Number.parseInt(value,10)||0);
if(major<1||(major===1&&minor<15)||(major===1&&minor===15&&patch<10))fail("Milestone 9 opaque-cover baseline requires v1.15.10 or newer");
if(!roadmap.includes("6. Bot and crawler controls | ✅ Done"))fail("Milestone 6 must be recorded as complete with Milestone 9 acceptance");
if(!roadmap.includes("9. Final security audit | ✅ Done"))fail("Milestone 9 must be recorded as complete");
if(!audit.includes("Status:** ✅ Complete")||!audit.includes("Accepted baseline:** Shadow Garden v1.15.14"))fail("Milestone 9 audit record must document production acceptance");

if(failures.length){console.error(`Shadow Garden Milestone 9 baseline check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);failures.forEach(message=>console.error(`- ${message}`));process.exitCode=1}
else console.log("Shadow Garden Milestone 9 completed security baseline checks passed.");
