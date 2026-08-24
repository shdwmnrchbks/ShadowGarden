import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const read=file=>fs.readFile(path.join(ROOT,file),"utf8");
const failures=[];
const fail=message=>failures.push(message);

const [flavor,siteA11y,readerA11y,adminBootstrap,readAgain,notFound,headers,pkg]=await Promise.all([
  read("src/assets/js/site-flavor.js"),
  read("src/assets/js/site-a11y.js"),
  read("src/assets/js/reader-a11y.js"),
  read("src/assets/js/admin-bootstrap.js"),
  read("src/assets/js/series-read-again.js"),
  read("src/404.html"),
  read("src/_headers"),
  read("package.json")
]);

for(const marker of [
  "A moonlit archive of stories",
  "A secluded wing for mature works",
  "Pass the Garden Gate",
  "KEEPER'S GATE",
  "Tend the Garden",
  "private vault",
  "Uproot",
  "The gate has been quiet",
  "the Finished mark lifted",
  "window.confirm",
  "window.alert",
  "MutationObserver"
])if(!flavor.includes(marker))fail(`shared site voice is missing ${marker}`);

if(!flavor.includes("can be restored from Garden Maintenance"))fail("series/volume removal warning must say Trash is recoverable");
if(!flavor.includes("This cannot be undone"))fail("permanent purge warning must retain explicit irreversible language");
if(!siteA11y.includes("site-flavor.js?v=1.15.13"))fail("public Library/Series surfaces must load the shared voice layer");
if(!readerA11y.includes("site-flavor.js?v=1.15.13"))fail("Reader must load the shared voice layer");
if(!adminBootstrap.includes("site-flavor.js?v=1.15.13"))fail("Garden Keeper must load the shared voice layer before dynamic admin modules");
for(const marker of ["RETURN TO THE FIRST PAGE","Walk this volume from the beginning?","Keep My Place","Begin Again","bookmarks remain untouched"]){
  if(!readAgain.includes(marker))fail(`Read Again dialog is missing themed copy: ${marker}`);
}
for(const marker of ["The path fades into shadow.","No shelf, gate, or footpath answers this address.","Return to the Garden"]){
  if(!notFound.includes(marker))fail(`404 page is missing themed copy: ${marker}`);
}
if(!headers.includes("/assets/js/site-flavor.js"))fail("shared voice layer must be served no-store during the audit");
if(JSON.parse(pkg).version!=="1.15.13")fail("package version must be 1.15.13");

if(failures.length){
  console.error(`Shadow Garden site-voice check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else console.log("Shadow Garden site voice and confirmation-copy checks passed.");
