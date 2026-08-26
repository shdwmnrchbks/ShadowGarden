import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("Pages wheel input is owned by desktop layout and the EPUB child window", async () => {
  const [input, e2e] = await Promise.all([
    read("src/assets/js/reader/page-navigation-input.js"),
    read("tests/e2e/specs/reader-pages.spec.mjs")
  ]);

  assert.match(input, /const desktop=window\.matchMedia\?\.\("\(min-width:900px\)"\)/);
  assert.match(input, /getFlow\?\.\(\)!=="paginated"\|\|desktop\?\.matches===false/);
  assert.doesNotMatch(input, /pointer:fine|finePointer/);
  assert.match(input, /doc\.defaultView\?\.addEventListener\("wheel",handleWheel,\{capture:true,passive:false\}\)/);
  assert.doesNotMatch(input, /doc\.addEventListener\("wheel",handleWheel/);

  assert.match(e2e, /trustedWheel\(page, 120\)/);
  assert.match(e2e, /page\.mouse\.wheel\(0, deltaY\)/);
  assert.match(e2e, /intersectBoxes\(box, shellBox\)/);
  assert.match(e2e, /childWindowWheel\(page, 120\)/);
  assert.match(e2e, /new win\.WheelEvent\('wheel'/);
  assert.match(e2e, /testInfo\.project\.name\.includes\('webkit'\)/);
  assert.match(e2e, /Pages controls and TOC navigate everywhere while desktop keyboard and wheel turn the live rendition/);
});
