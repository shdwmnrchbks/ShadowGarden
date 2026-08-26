import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("post-v2.5 package and lock metadata remain promoted together",async()=>{
  const [pkgText,lockText]=await Promise.all([read("package.json"),read("package-lock.json")]);
  const pkg=JSON.parse(pkgText),lock=JSON.parse(lockText);
  assert.match(pkg.version,/^2\.\d+\.\d+$/,"historical v2.5 release guard should allow later v2 releases");
  assert.ok(Number(pkg.version.split(".")[1])>=5,"current v2 package must not regress below the v2.5 milestone");
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages?.[""]?.version,pkg.version);
});

test("verified v2 publisher resolves the current package release dynamically",async()=>{
  const workflow=await read(".github/workflows/release-v2.yml");
  assert.match(workflow,/NOTES="docs\/releases\/v\$\{VERSION\}\.md"/);
  assert.match(workflow,/Missing release notes:/);
  assert.match(workflow,/gh release view "\$TAG"/);
  assert.match(workflow,/steps\.existing\.outputs\.exists != 'true'/);
  assert.match(workflow,/Require matching Real Browser E2E/);
  assert.match(workflow,/actions\/workflows\/e2e\.yml\/runs/);
  assert.match(workflow,/\/data\/version\.json/);
  assert.match(workflow,/deployed_version/);
  assert.match(workflow,/deployed_commit/);
  assert.match(workflow,/gh release create "\$TAG"/);
  assert.match(workflow,/--notes-file "\$NOTES"/);
  assert.equal(workflow.includes('if [ "$VERSION" != "2.0.0" ]'),false,"publisher must not remain pinned to v2.0.0");
});

test("v2.5 release notes remain a complete historical four-slice record",async()=>{
  const notes=await read("docs/releases/v2.5.0.md");
  for(const marker of [
    "Shadow Garden v2.5.0 — Motion & Continuity",
    "Slice 1 — Motion foundation",
    "Slice 2 — Library continuity",
    "Slice 3 — Series + Reader continuity",
    "Slice 4 — Garden Keeper + navigation continuity",
    "prefers-reduced-motion",
    "Security and compatibility",
    "Cloudflare production `/data/version.json`",
    "version `2.5.0`",
    "exact commit"
  ])assert.ok(notes.includes(marker),marker);
});
