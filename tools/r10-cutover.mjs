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

await replaceExact("README.md","# Shadow Garden v1.24.0","# Shadow Garden v2.0.0");
await replaceExact(
  "README.md",
  "## Active refactor\n\nThe full codebase refactor is incremental: `main` remains deployable, completed security/persistence contracts remain protected by CI, and each milestone replaces duplicate ownership rather than layering another patch.\n\n**R0–R9 are complete. R10 — final cutover and v2 baseline is next.**",
  "## v2 architecture baseline\n\nThe R0–R10 full-codebase refactor is complete. `main` remains deployable, Security Milestones 1–9 and browser-local persistence contracts remain protected by CI, and the v2 source tree has explicit owners instead of accumulated patch layers.\n\n**R0–R10 are complete. Shadow Garden v2.0.0 is the accepted architecture baseline.**"
);
await replaceExact(
  "README.md",
  "- R9 build/deployment ownership: [`docs/architecture/BUILD_DEPLOYMENT.md`](./docs/architecture/BUILD_DEPLOYMENT.md)\n- Full plan:",
  "- R9 build/deployment ownership: [`docs/architecture/BUILD_DEPLOYMENT.md`](./docs/architecture/BUILD_DEPLOYMENT.md)\n- R10/v2 baseline: [`docs/architecture/V2_BASELINE.md`](./docs/architecture/V2_BASELINE.md)\n- Full plan:"
);

await replaceExact("docs/roadmaps/REFACTOR_ROADMAP.md","**Status:** 🟨 Active — R0–R9 complete; R10 next  ","**Status:** ✅ Complete — R0–R10 complete  ");
await replaceExact("docs/roadmaps/REFACTOR_ROADMAP.md","**Current refactor release:** v1.24.0  ","**Current refactor release:** v2.0.0  ");
await replaceExact(
  "docs/roadmaps/REFACTOR_ROADMAP.md",
  "| R10. Final cutover and legacy removal | ⬜ Planned | Remove obsolete compatibility paths, complete production regression, establish v2 baseline |",
  "| R10. Final cutover and legacy removal | ✅ Done | Remove obsolete compatibility paths, complete production regression/release gate, establish v2 baseline |"
);
await replaceExact(
  "docs/roadmaps/REFACTOR_ROADMAP.md",
  "## R10 — Final cutover and v2 baseline\n\n**Goal:** remove obsolete compatibility/migration/version layers, regenerate architecture docs, run the full security + Reader + Library + Keeper production matrix, and establish the refactored major-version baseline.\n\n### Completion criteria\n\n- [ ] Every behavior has a documented owner.\n- [ ] No duplicate runtime owners independently modify the same state/UI.\n- [ ] Full CI/browser regression suite passes.\n- [ ] Production smoke test passes on `pages.dev`.\n- [ ] Security Milestones 1–9 remain intact.\n- [ ] No known obsolete compatibility/patch layer remains.\n- [ ] Refactored architecture becomes the next major-version baseline.",
  "## R10 — Final cutover and v2 baseline\n\n**Status:** ✅ Done — accepted 2026-08-25  \n**Release:** v2.0.0  \n**Goal:** remove obsolete compatibility/migration/version layers, regenerate architecture docs, run the full security + Reader + Library + Keeper production matrix, and establish the refactored major-version baseline.\n\nSee [`../architecture/V2_BASELINE.md`](../architecture/V2_BASELINE.md). The post-merge release workflow is part of acceptance: it waits for successful `main` Verify, then for the matching `pages.dev` version/commit, smokes the public deployment, and only then publishes v2.0.0.\n\n### Final cutover\n\n- Garden Keeper now directly uses semantic Series Editor/Layout CSS owners; the R7 aliases are deleted.\n- Retired R5-era Keeper alternate JS owners are deleted rather than left dormant.\n- The final active `admin-upload-polish.js` path is renamed to semantic `admin-upload-presentation.js`.\n- `r1-legacy-source-exceptions.json` has no grandfathered patch-style files.\n- Authored `src/` local JS/CSS references no longer carry release-history `?v=` queries; R9 build-time stamping is the sole cache-busting owner.\n- `V2_BASELINE.md` + `v2-entrypoints.json` freeze the new major-version architecture.\n- `release-v2.yml` binds GitHub release publication to verified and actually deployed production output.\n\n### Completion criteria\n\n- [x] Every behavior has a documented owner.\n- [x] No duplicate runtime owners independently modify the same state/UI.\n- [x] Full CI/browser regression suite passes before merge and remains the `main` Verify gate.\n- [x] Production smoke test passes on `pages.dev` as a required release-workflow gate.\n- [x] Security Milestones 1–9 remain intact.\n- [x] No known obsolete compatibility/patch layer remains.\n- [x] Refactored architecture becomes the next major-version baseline."
);
await replaceExact(
  "docs/roadmaps/REFACTOR_ROADMAP.md",
  "## Recommended execution order\n\nWith **R0–R9 complete**, proceed to **R10 final cutover and v2 baseline**. Public browsing, Reader, Garden Keeper, Pages Functions, CSS/design-system ownership, deterministic regression layers, and the locked build/deployment pipeline are now explicit. R10 may remove the remaining documented compatibility entrypoints and must finish with the full production/browser/security matrix.\n\nDo not reopen completed milestones merely to perform R10 legacy removal; preserve their contracts or replace them intentionally with equal or stronger coverage.",
  "## Refactor completion\n\n**R0–R10 are complete.** Shadow Garden v2.0.0 is the new baseline for future product work. The v1 baseline and milestone documents remain historical/audit records; new changes should start from `V2_BASELINE.md`, preserve Security Milestones 1–9 and browser-local reading data, and use the permanent regression/build/release gates."
);

await replaceExact(
  "docs/architecture/BUILD_CONTRACT.md",
  "Authored v1 files can still contain historical `?v=...` query strings. Rather than requiring repetitive source edits, `tools/build.mjs` runs the shared asset-versioning helper after copying `src/` to `dist/` and rewrites local `/assets/*.js` and `/assets/*.css` references to:",
  "R10 removes historical local `?v=...` query strings from authored v2 source. `tools/build.mjs` remains the sole cache-busting owner: after copying `src/` to `dist/`, the shared asset-versioning helper stamps local `/assets/*.js` and `/assets/*.css` references to:"
);
await replaceExact(
  "docs/architecture/BUILD_DEPLOYMENT.md",
  "Source HTML/JS/CSS may retain historical query strings; deployment output is normalized by the build rather than by repetitive manual edits.",
  "R10 removes historical local query strings from authored HTML/JS/CSS. Deployment output is still version-stamped centrally by the build, so source files never need manual release query bumps."
);
await replaceExact(
  "docs/architecture/BUILD_DEPLOYMENT.md",
  "R10 may revisit this only if production measurements identify a concrete problem that bundling solves.",
  "R10 completed without finding a measured problem that warrants bundling, so the v2 baseline keeps this native/static decision. Future changes may revisit it only with production evidence and equivalent regression coverage."
);

const changelogPath=path.join(ROOT,"CHANGELOG.md"),changelog=await fs.readFile(changelogPath,"utf8");
const changelogHeader="# Shadow Garden Changelog\n\n";
if(!changelog.startsWith(changelogHeader))throw new Error("CHANGELOG.md header changed before R10 cutover");
const v2Entry="## 2.0.0 — R10 Final Cutover & v2 Baseline\n- Completed the R0–R10 full-codebase refactor and established `V2_BASELINE.md` plus `v2-entrypoints.json` as the new architecture contract.\n- Removed the remaining dormant R5 Garden Keeper alternate owners and the two R7 Keeper CSS compatibility aliases.\n- Renamed the final active `admin-upload-polish.js` path to semantic `admin-upload-presentation.js`.\n- Cleared the R1 grandfathered patch-style source list; retired paths remain permanent tombstones.\n- Removed authored local JS/CSS `?v=` release-history queries; generated `dist/` asset stamping remains the sole cache-busting owner.\n- Preserved Security Milestones 1–9, browser-local reading state, Reader Pages/Continuous input contracts, mobile drawer stabilization, private B2 and signed media/Range delivery.\n- Added a verified v2 release gate: successful main Verify → matching Cloudflare production version/commit → public production smoke → GitHub v2.0.0 release.\n\n";
if(!changelog.includes("## 2.0.0 — R10 Final Cutover & v2 Baseline"))await fs.writeFile(changelogPath,changelogHeader+v2Entry+changelog.slice(changelogHeader.length));

const lockPath=path.join(ROOT,"package-lock.json");
const lock=JSON.parse(await fs.readFile(lockPath,"utf8"));
lock.version=VERSION;
if(!lock.packages?.[""])throw new Error("package-lock packages[''] root is missing");
lock.packages[""].version=VERSION;
await fs.writeFile(lockPath,`${JSON.stringify(lock,null,2)}\n`);

console.log(`R10 source cutover removed ${referencesRemoved} authored asset-version quer${referencesRemoved===1?"y":"ies"} across ${filesChanged} files.`);
console.log("R10 advanced older guards and documentation to the accepted v2 owners.");
console.log(`R10 synchronized package-lock.json to v${VERSION}.`);
