import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");

const [media,bookAccess,humanAccess,adminAccess,b2,routes,headers,readerBootstrap,readerHtml,indexHtml,adultHtml,seriesHtml,status,roadmap]=await Promise.all([
  read("functions/media/[[path]].js"),
  read("functions/book-access.js"),
  read("functions/human-access.js"),
  read("functions/admin-access.js"),
  read("functions/_lib/b2.js"),
  read("src/_routes.json"),
  read("src/_headers"),
  read("src/assets/js/reader-bootstrap.js"),
  read("src/reader.html"),
  read("src/index.html"),
  read("src/nsfw.html"),
  read("src/series.html"),
  read("src/assets/js/reading-status.js"),
  read("SECURITY_ROADMAP.md")
]);

if(!media.includes("incomingRange")||!media.includes("authorizedEpub"))fail("media proxy must preserve Range handling and signed-ticket authorization");
if(media.includes("checkPublicAbuseCooldown"))fail("Milestone 8 cooldown enforcement must remain outside /media/*");
if(!bookAccess.includes("checkPublicAbuseCooldown")||!humanAccess.includes("checkPublicAbuseCooldown"))fail("public abuse cooldown must remain on /book-access and /human-access");
if(!adminAccess.includes("adminCooldown(env, request)"))fail("Garden Keeper must retain server-side cooldown enforcement");
if(!b2.includes("verifyAdminSession")||!b2.includes("adminTokenMatches"))fail("admin API authorization must retain token + signed session checks");
const routeConfig=JSON.parse(routes);
for(const route of ["/media/*","/book-access","/human-access","/admin-access","/admin-api/*"]){
  if(!routeConfig.include?.includes(route))fail(`Pages Functions routing is missing ${route}`);
}
for(const marker of ["/admin.html","/reader.html","/data/version.json","Cache-Control: no-store"]){
  if(!headers.includes(marker))fail(`security/cache headers are missing ${marker}`);
}
if(!readerBootstrap.includes("ShadowGardenBookAccess")||!readerBootstrap.includes("BOOK_ID"))fail("Reader startup must retain opaque book authorization handoff");
for(const html of [readerHtml,indexHtml,adultHtml,seriesHtml]){
  if(/s3\.us-east-005\.backblazeb2\.com|backblazeb2\.com\/shadow-garden-books-01/i.test(html))fail("public HTML must not expose direct private B2 delivery URLs");
}
if(status.includes("fetch("))fail("finished-reading state must remain local-only and outside security/network boundaries");
if(!roadmap.includes("9. Final security audit | 🟨 In progress"))fail("Milestone 9 must be recorded as in progress");

if(failures.length){
  console.error(`Shadow Garden Milestone 9 baseline check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else console.log("Shadow Garden Milestone 9 final-audit baseline checks passed.");
