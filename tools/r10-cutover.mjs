import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const SRC=path.join(ROOT,"src");
const VERSION="2.0.0";

async function walk(dir){
  const out=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(file));
    else if(entry.isFile()&&/\.(?:html|js|css)$/.test(entry.name))out.push(file);
  }
  return out;
}
async function replaceExact(relative,before,after){
  const file=path.join(ROOT,relative),source=await fs.readFile(file,"utf8");
  if(!source.includes(before))throw new Error(`R10 expected marker missing in ${relative}: ${before}`);
  await fs.writeFile(file,source.replace(before,after));
}

const adminPath=path.join(SRC,"admin.html");
let admin=await fs.readFile(adminPath,"utf8");
for(const [before,after] of [
  ["/assets/css/admin-series-editor-polish.css?v=1.2.2","/assets/css/admin-series-editor.css"],
  ["/assets/css/admin-overhaul.css?v=1.8.0","/assets/css/admin-layout.css"]
]){
  if(!admin.includes(before))throw new Error(`R10 expected admin entrypoint marker missing: ${before}`);
  admin=admin.replace(before,after);
}
await fs.writeFile(adminPath,admin);

const localVersion=/(\/assets\/[A-Za-z0-9_./-]+\.(?:js|css))\?v=[^"'`\s&#)]*/g;
let filesChanged=0,referencesRemoved=0;
for(const file of await walk(SRC)){
  const before=await fs.readFile(file,"utf8");
  let count=0;
  const after=before.replace(localVersion,(_match,asset)=>{count++;return asset});
  if(after===before)continue;
  await fs.writeFile(file,after);
  filesChanged++;
  referencesRemoved+=count;
}

await replaceExact(
  "tools/check-r9.mjs",
  'if (!roadmap.includes("R10. Final cutover and legacy removal | ⬜ Planned")) fail("R10 must remain the next planned refactor milestone");',
  'if (!roadmap.includes("R10. Final cutover and legacy removal |")) fail("R10 milestone must remain present after R9");'
);
await replaceExact(
  "tools/check-reading-status.mjs",
  'read("src/assets/js/admin-bootstrap.js")',
  'read("src/assets/js/admin/version.js")'
);

const lockPath=path.join(ROOT,"package-lock.json");
const lock=JSON.parse(await fs.readFile(lockPath,"utf8"));
lock.version=VERSION;
if(!lock.packages?.[""])throw new Error("package-lock packages[''] root is missing");
lock.packages[""].version=VERSION;
await fs.writeFile(lockPath,`${JSON.stringify(lock,null,2)}\n`);

console.log(`R10 source cutover removed ${referencesRemoved} authored asset-version quer${referencesRemoved===1?"y":"ies"} across ${filesChanged} files.`);
console.log("R10 advanced older guards to the accepted v2 owners.");
console.log(`R10 synchronized package-lock.json to v${VERSION}.`);
