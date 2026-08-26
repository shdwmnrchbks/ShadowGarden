import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=file=>fs.readFile(path.join(ROOT,file),"utf8");
const exists=async file=>{try{await fs.access(path.join(ROOT,file));return true}catch{return false}};
const semverAtLeast=(current,minimum)=>{
  const parse=value=>String(value||"").split(".").slice(0,3).map(item=>Number.parseInt(item,10)||0),a=parse(current),b=parse(minimum);
  for(let i=0;i<3;i++){if(a[i]>b[i])return true;if(a[i]<b[i])return false}return true;
};
function normalizeAsset(value){return String(value||"").trim().split("#")[0].split("?")[0]}
function styles(html){
  const out=[];
  const regex=/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*>/gi;
  for(const match of html.matchAll(regex))out.push(normalizeAsset(match[1]||match[2]));
  return out;
}
function sameArray(a,b){return a.length===b.length&&a.every((value,index)=>value===b[index])}
function cssBalanced(source,name){
  const clean=source.replace(/\/\*[\s\S]*?\*\//g,"");let depth=0;
  for(const ch of clean){if(ch==="{")depth++;else if(ch==="}"){depth--;if(depth<0){fail(`${name} has an unmatched closing brace`);return}}}
  if(depth!==0)fail(`${name} has ${depth} unmatched CSS block${Math.abs(depth)===1?"":"s"}`);
}

const files={
  main:"src/index.html",adult:"src/nsfw.html",series:"src/series.html",reader:"src/reader.html",admin:"src/admin.html",
  motionFoundation:"src/assets/css/motion.css",libraryMotion:"src/assets/css/library-motion.css",seriesMotion:"src/assets/css/series-motion.css",readerMotion:"src/assets/css/reader-motion.css",
  publicComponents:"src/assets/css/public-components.css",publicArtwork:"src/assets/css/public-artwork.css",
  libraryFeatures:"src/assets/css/library-features.css",libraryLayout:"src/assets/css/library-layout.css",
  readerBase:"src/assets/css/reader.css",readerCompletion:"src/assets/css/reader-completion.css",readerPresentation:"src/assets/css/reader-presentation.css",
  readerA11y:"src/assets/css/reader-a11y.css",readerThemes:"src/assets/css/reader-interface-themes.css",
  adminSeries:"src/assets/css/admin-series-editor.css",adminLayout:"src/assets/css/admin-layout.css",adminComponents:"src/assets/css/admin-components.css",adminPresentation:"src/assets/css/admin-presentation.css",
  app:"src/assets/js/admin/app.js",headers:"src/_headers",manifest:"docs/architecture/v1-entrypoints.json",
  legacy:"docs/architecture/r1-legacy-source-exceptions.json",architecture:"docs/architecture/DESIGN_SYSTEM.md",roadmap:"docs/roadmaps/REFACTOR_ROADMAP.md",pkg:"package.json"
};
const entries=Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,file])=>[key,await read(file)])));
const manifest=JSON.parse(entries.manifest),legacy=JSON.parse(entries.legacy),pkg=JSON.parse(entries.pkg);

const expected={
  main:["/assets/css/site.css","/assets/css/nav.css","/assets/css/motion.css","/assets/css/library-motion.css","/assets/css/library-features.css","/assets/css/public-components.css","/assets/css/public-artwork.css","/assets/css/library-layout.css","/assets/css/reading-status.css","/assets/css/volume-actions.css","/assets/css/ui-symbols.css"],
  adult:["/assets/css/site.css","/assets/css/nav.css","/assets/css/motion.css","/assets/css/library-motion.css","/assets/css/adult.css","/assets/css/library-features.css","/assets/css/public-components.css","/assets/css/public-artwork.css","/assets/css/library-layout.css","/assets/css/reading-status.css","/assets/css/volume-actions.css","/assets/css/ui-symbols.css"],
  series:["/assets/css/site.css","/assets/css/nav.css","/assets/css/motion.css","/assets/css/library-motion.css","/assets/css/adult.css","/assets/css/series-extra.css","/assets/css/series-motion.css","/assets/css/public-components.css","/assets/css/public-artwork.css","/assets/css/reading-status.css","/assets/css/volume-actions.css","/assets/css/ui-symbols.css"],
  reader:["/assets/css/reader.css","/assets/css/motion.css","/assets/css/reader-continuous-rail.css","/assets/css/reader-page-map.css","/assets/css/reader-completion.css","/assets/css/reader-end-page.css","/assets/css/reading-status.css","/assets/css/reader-image-focus.css","/assets/css/reader-a11y.css","/assets/css/reader-interface-themes.css","/assets/css/reader-presentation.css","/assets/css/reader-motion.css","/assets/css/ui-symbols.css"],
  admin:["/assets/css/site.css","/assets/css/nav.css","/assets/css/motion.css","/assets/css/admin.css","/assets/css/admin-preflight.css","/assets/css/admin-batch.css","/assets/css/admin-maintenance.css","/assets/css/admin-series-editor.css","/assets/css/admin-layout.css","/assets/css/admin-components.css","/assets/css/admin-version.css","/assets/css/admin-presentation.css","/assets/css/admin-motion.css","/assets/css/ui-symbols.css"]
};
for(const [name,wanted] of Object.entries(expected)){
  const actual=styles(entries[name]);
  if(!sameArray(actual,wanted))fail(`${name} stylesheet order drifted\n  expected: ${wanted.join(", ")}\n  actual:   ${actual.join(", ")}`);
  const manifestName=name==="main"?"mainLibrary":name==="adult"?"adultLibrary":name==="admin"?"gardenKeeper":name;
  const frozen=manifest.pages?.[manifestName]?.styles||[];
  if(!sameArray(frozen,wanted))fail(`${manifestName} architecture manifest does not match the final semantic stylesheet order`);
}

const retired=[
  "src/assets/css/site-current.css","src/assets/css/site-v1.9.4.css","src/assets/css/library-scale.css","src/assets/css/library-compact-alignment.css",
  "src/assets/css/reader-polish.css","src/assets/css/reader-v1.10.1.css","src/assets/css/admin-current.css","src/assets/css/admin-v1.9.4.css",
  "src/assets/css/admin-series-editor-polish.css","src/assets/css/admin-overhaul.css"
];
for(const file of retired){
  if(await exists(file))fail(`retired R7/R10 stylesheet returned: ${file}`);
  if(!(legacy.removedDeadFiles||[]).includes(file))fail(`R1 dead-file manifest must remember CSS retirement: ${file}`);
}

for(const [name,source] of Object.entries({
  motionFoundation:entries.motionFoundation,libraryMotion:entries.libraryMotion,seriesMotion:entries.seriesMotion,readerMotion:entries.readerMotion,
  publicComponents:entries.publicComponents,publicArtwork:entries.publicArtwork,libraryFeatures:entries.libraryFeatures,libraryLayout:entries.libraryLayout,
  readerCompletion:entries.readerCompletion,readerPresentation:entries.readerPresentation,adminSeries:entries.adminSeries,adminLayout:entries.adminLayout,
  adminComponents:entries.adminComponents,adminPresentation:entries.adminPresentation
}))cssBalanced(source,name);

for(const marker of ["--sg-motion-press","--sg-motion-page","--sg-ease-enter","prefers-reduced-motion:reduce"]){if(!entries.motionFoundation.includes(marker))fail(`motion.css is missing shared motion contract ${marker}`)}
for(const marker of ["@view-transition","series-cover","sg-library-content-in","prefers-reduced-motion:reduce"]){if(!entries.libraryMotion.includes(marker))fail(`library-motion.css is missing ${marker}`)}
for(const marker of ["sg-series-hydrate","sg-reading-state-changed","cover-reading-progress","prefers-reduced-motion:reduce"]){if(!entries.seriesMotion.includes(marker))fail(`series-motion.css is missing ${marker}`)}
for(const marker of ["@view-transition","reader-chrome-hidden","sg-reader-viewer-ready","sg-progress-updated","prefers-reduced-motion:reduce"]){if(!entries.readerMotion.includes(marker))fail(`reader-motion.css is missing ${marker}`)}
for(const marker of [".skip-link",":focus-visible","body.adult-library","mobile-filter-toggle","prefers-contrast:more","forced-colors:active","prefers-reduced-motion:reduce"]){if(!entries.publicComponents.includes(marker))fail(`public-components.css is missing ${marker}`)}
for(const marker of ["intro-banner-art",".series-backdrop","compact-card-badge","series-actions .primary-button","a.tag","prefers-reduced-motion:reduce"]){if(!entries.publicArtwork.includes(marker))fail(`public-artwork.css is missing ${marker}`)}
for(const marker of [".recent-section",".active-filter-tags",".catalog-sentinel",".adult-library","@media(max-width:720px)"]){if(!entries.libraryFeatures.includes(marker))fail(`library-features.css is missing ${marker}`)}
for(const marker of ["--sg-compact-cover-width","grid-template-columns",".compact-card-badges","@media(max-width:430px)"]){if(!entries.libraryLayout.includes(marker))fail(`library-layout.css is missing ${marker}`)}

for(const marker of [":root{--chrome","body.adult-reader","reader-flow-scrolled"]){if(!entries.readerBase.includes(marker))fail(`reader.css token/layout foundation is missing ${marker}`)}
for(const marker of [".reader-toggle-setting",".volume-complete","body.adult-reader","@media(max-width:700px)"]){if(!entries.readerCompletion.includes(marker))fail(`reader-completion.css is missing ${marker}`)}
for(const marker of ["reader-theme-paper","sg-reader-loading-spin","#textWidthSetting[hidden]","prefers-reduced-motion:reduce"]){if(!entries.readerPresentation.includes(marker))fail(`reader-presentation.css is missing ${marker}`)}
for(const marker of ["prefers-reduced-motion","prefers-contrast","forced-colors"]){if(!entries.readerA11y.includes(marker))fail(`reader-a11y.css must preserve ${marker}`)}
for(const marker of ["reader-theme-garden","reader-theme-night","reader-theme-black","reader-theme-paper"]){if(!entries.readerThemes.includes(marker))fail(`Reader interface themes lost ${marker}`)}

for(const marker of ["#seriesEditor",".adult-toggle",`.admin-toast`,"prefers-reduced-motion:reduce"]){if(!entries.adminSeries.includes(marker))fail(`admin-series-editor.css is missing ${marker}`)}
for(const marker of [".manage-home-head",".keeper-dialog",".add-series-target","#maintenanceView.hidden"]){if(!entries.adminLayout.includes(marker))fail(`admin-layout.css is missing ${marker}`)}
for(const marker of [".batch-remove",".preflight-collapse-toggle",".upload-state-card","#backupList","prefers-reduced-motion:reduce"]){if(!entries.adminComponents.includes(marker))fail(`admin-components.css is missing ${marker}`)}
for(const marker of [".manage-banner-field",".manage-banner-preview","data-kind=\"saving\""]){if(!entries.adminPresentation.includes(marker))fail(`admin-presentation.css is missing ${marker}`)}

for(const marker of ["/assets/css/admin-components.css","/assets/css/admin-version.css","/assets/css/admin-presentation.css"]){if(!entries.admin.includes(marker))fail(`Garden Keeper HTML is missing first-paint semantic R7 style ${marker}`)}
if(/loadStyle\s*=|createElement\(["']link["']\)/.test(entries.app))fail("Garden Keeper app must not append deterministic presentation styles after first paint");
for(const retiredName of ["admin-current.css","admin-v1.9.4.css","admin-series-editor-polish.css","admin-overhaul.css"]){if(entries.app.includes(retiredName)||entries.admin.includes(retiredName))fail(`Garden Keeper still references retired ${retiredName}`)}
for(const marker of ["/assets/css/public-components.css","/assets/css/public-artwork.css","/assets/css/library-layout.css","/assets/css/reader-completion.css","/assets/css/reader-presentation.css","/assets/css/admin-components.css","/assets/css/admin-presentation.css","Cache-Control: no-store"]){if(!entries.headers.includes(marker))fail(`cache contract is missing semantic R7 asset ${marker}`)}

for(const marker of ["CSS & Design-System Layer","Public Library + Series ownership","Reader ownership","Garden Keeper ownership","Retired CSS owners","Accessibility and variant contracts","Permanent R7/R10 guard"]){if(!entries.architecture.includes(marker))fail(`DESIGN_SYSTEM.md is missing ${marker}`)}
if(!entries.roadmap.includes("R7. CSS and design-system consolidation | ✅ Done"))fail("Refactor roadmap must record R7 complete");
if(!entries.roadmap.includes("R8. Test architecture and fixtures |"))fail("R8 milestone must remain present after R7");
if(!semverAtLeast(pkg.version,"1.22.0"))fail(`R7 requires v1.22.0 or newer, found ${pkg.version}`);
if(!String(pkg.scripts?.check||"").includes("check-r7.mjs"))fail("tools/check-r7.mjs must remain in npm run check");

if(failures.length){console.error(`Shadow Garden R7/R10 CSS/design-system check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);failures.forEach(message=>console.error(`- ${message}`));process.exitCode=1}
else console.log("Shadow Garden R7/R10 semantic CSS ownership, final Keeper entrypoints, variants, accessibility, and retired-layer checks passed.");
