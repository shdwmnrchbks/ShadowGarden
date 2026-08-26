import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("Pages wheel and swipe input stay owned by the EPUB child window", async () => {
  const [input, e2e] = await Promise.all([
    read("src/assets/js/reader/page-navigation-input.js"),
    read("tests/e2e/specs/reader-pages.spec.mjs")
  ]);

  assert.match(input, /const desktop=window\.matchMedia\?\.\("\(min-width:900px\)"\)/);
  assert.match(input, /getFlow\?\.\(\)!=="paginated"\|\|desktop\?\.matches===false/);
  assert.doesNotMatch(input, /pointer:fine|finePointer/);
  assert.match(input, /doc\.defaultView\?\.addEventListener\("wheel",handleWheel,\{capture:true,passive:false\}\)/);
  assert.doesNotMatch(input, /doc\.addEventListener\("wheel",handleWheel/);

  assert.match(input, /typeof win\?\.PointerEvent==="function"/);
  assert.match(input, /doc\.addEventListener\("pointerdown",event=>beginPointer\(event,doc\),\{capture:true,passive:true\}\)/);
  assert.match(input, /doc\.addEventListener\("pointerup",event=>finishPointer\(event,doc\),\{capture:true,passive:false\}\)/);
  assert.match(input, /finishGesture\(event,event,doc,`pointer:\$\{Number\(event\.pointerId\)\|\|1\}`\)/);
  assert.match(input, /const direction=pageSwipeDirection\(/);
  assert.match(input, /turn\?\.\(direction\)/);
  assert.match(input, /getFlow\?\.\(\)!=="paginated"/);

  assert.match(e2e, /trustedWheel\(page, 120\)/);
  assert.match(e2e, /page\.mouse\.wheel\(0, deltaY\)/);
  assert.match(e2e, /intersectBoxes\(box, shellBox\)/);
  assert.doesNotMatch(e2e, /childWindowWheel|new win\.WheelEvent/);
  assert.match(e2e, /testInfo\.project\.name\.includes\('webkit'\)/);
  assert.match(e2e, /if \(!webkit\)/);
  assert.match(e2e, /supported trusted wheel turn the live rendition/);

  assert.match(e2e, /const webkitMobile = testInfo\.project\.name === 'webkit-mobile'/);
  assert.match(e2e, /if \(webkitMobile\)/);
  assert.match(e2e, /clickVisibleControl\(page, \['#nextPage', '#nextBottom'\]\)/);
  assert.match(e2e, /WebKit's Playwright driver does not expose a trusted swipe gesture/);
});
