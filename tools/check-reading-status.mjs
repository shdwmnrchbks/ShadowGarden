import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");

const [status,readerFinished,readerBootstrap,series,library,polish,style,writeSource,adminBootstrap,headers,pkg]=await Promise.all([
  read("src/assets/js/reading-status.js"),
  read("src/assets/js/reader-finished.js"),
  read("src/assets/js/reader-bootstrap.js"),
  read("src/assets/js/series.js"),
  read("src/assets/js/library.js"),
  read("src/assets/js/library-series-polish.js"),
  read("src/assets/css/reading-status.css"),
  read("tools/write-source.mjs"),
  read("src/assets/js/admin-bootstrap.js"),
  read("src/_headers"),
  read("package.json")
]);

for(const marker of ["sg-finished-books","isFinished","setFinished","seriesFinished","finishedCount"]){
  if(!status.includes(marker))fail(`reading-status.js is missing ${marker}`);
}
if(status.includes("fetch("))fail("finished reading state must remain browser-local and must not call a server API");
for(const marker of ["volume-finished-toggle","finishedToggle","Mark as Finished","Marked as unfinished"]){
  if(!readerFinished.includes(marker))fail(`Reader finished control is missing ${marker}`);
}
for(const marker of ["reading-status.js?v=1.15.0","reader-finished.js?v=1.15.0"]){
  if(!readerBootstrap.includes(marker))fail(`Reader bootstrap is missing ${marker}`);
}
for(const marker of ["finished-volume-badge","Read again","finishedCount"]){
  if(!series.includes(marker))fail(`Series completion UI is missing ${marker}`);
}
for(const marker of ["finished-series-badge","data-reading-status=\"finished\"","data-reading-status=\"unfinished\"","params.set(\"reading\"","seriesFinished"]){
  if(!library.includes(marker))fail(`Library completion/filter UI is missing ${marker}`);
}
if(!polish.includes("✓ Finished")||!polish.includes("finished"))fail("Compact Library cards must surface the Finished badge");
for(const marker of ["finished-volume-badge","finished-series-badge","reading-status-chips","compact-card-badge.finished"]){
  if(!style.includes(marker))fail(`reading-status.css is missing ${marker}`);
}
for(const marker of ["version.json","CF_PAGES_COMMIT_SHA","shortCommit","builtAt"]){
  if(!writeSource.includes(marker))fail(`deployment version generation is missing ${marker}`);
}
for(const marker of ["adminVersion","/data/version.json","shortCommit","admin-version.css?v=1.15.0"]){
  if(!adminBootstrap.includes(marker))fail(`Garden Keeper version UI is missing ${marker}`);
}
if(!headers.includes("/data/version.json")||!headers.includes("/assets/js/reading-status.js"))fail("fresh-cache headers must cover version metadata and reading-status.js");
const parsed=JSON.parse(pkg);
if(parsed.version!=="1.15.0")fail("package version must be 1.15.0");

if(failures.length){
  console.error(`Shadow Garden reading-status check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else console.log("Shadow Garden finished-reading and deployed-version checks passed.");
