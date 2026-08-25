import fs from "node:fs/promises";

const pkg=JSON.parse(await fs.readFile("package.json","utf8"));
const lock=JSON.parse(await fs.readFile("package-lock.json","utf8"));
pkg.version="2.1.0";
lock.version="2.1.0";
if(lock.packages?.[""])lock.packages[""].version="2.1.0";
await fs.writeFile("package.json",JSON.stringify(pkg,null,2)+"\n");
await fs.writeFile("package-lock.json",JSON.stringify(lock,null,2)+"\n");

const changelogPath="CHANGELOG.md",changelog=await fs.readFile(changelogPath,"utf8");
const entry=`## 2.1.0 — Fan Translation Provenance
- Added structured fan translator/group attribution with optional source URLs, coverage notes, multiple hand-offs, and distinct translation status.
- Added Translator/Group Library filtering, translator-aware search, active-filter pills, catalog-card attribution, and Series Translation Credits with Main/Adult deep links.
- Added series-level translation defaults with per-volume overrides and explicit inheritance semantics.
- Added Garden Keeper translation management plus New Books seeding for a primary translator and translation status.
- Added authenticated translation metadata mutations with validation, catalog snapshots, cache invalidation, and unchanged public EPUB redaction/security boundaries.
- Added unit, service, and browser regression coverage plus the TRANSLATION_METADATA architecture contract.
`;
if(!changelog.includes("## 2.1.0 — Fan Translation Provenance")){
  const title="# Shadow Garden Changelog\n";
  if(!changelog.startsWith(title))throw new Error("Unexpected changelog header");
  await fs.writeFile(changelogPath,title+"\n"+entry+"\n"+changelog.slice(title.length).replace(/^\n+/,""));
}
