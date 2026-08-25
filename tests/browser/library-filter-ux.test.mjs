import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("mobile Library and Adult filters enter collapsed and expose removable active-filter pills",async()=>{
  const [controller,mobile,css,mainHtml,adultHtml]=await Promise.all([
    read("src/assets/js/library.js"),
    read("src/assets/js/library-mobile-filter.js"),
    read("src/assets/css/library-features.css"),
    read("src/index.html"),
    read("src/nsfw.html")
  ]);

  assert.match(mainHtml,/library-mobile-filter\.js/);
  assert.match(adultHtml,/library-mobile-filter\.js/);
  assert.match(mobile,/writeCollapsed\(true\)/);
  assert.match(mobile,/mobileInitialized/);
  assert.match(mobile,/filters-collapsed/);

  for(const key of ["author","year","volumeRange","readingStatus","pinnedOnly"]){
    assert.match(controller,new RegExp(`data-clear-filter=\\"\\$\\{esc\\(key\\)\\}\\"|${key}`));
  }
  assert.match(controller,/active-filter-pill-label/);
  assert.match(controller,/data-remove-tag/);
  assert.match(controller,/clearNamedFilter/);
  assert.match(css,/text-overflow:ellipsis/);
  assert.match(css,/active-filter-pill-label/);
});

test("mobile filtering immediately fades Recently Added so catalog results move into focus",async()=>{
  const [controller,css]=await Promise.all([
    read("src/assets/js/library.js"),
    read("src/assets/css/library-features.css")
  ]);

  assert.match(controller,/hasActiveResultFilter/);
  assert.match(controller,/state\.query\.trim\(\)/);
  assert.match(controller,/mobile-results-focus/);
  assert.match(controller,/addEventListener\("input"[^\n]*syncMobileResultFocus\(\)/);
  assert.match(css,/\.recent-section\.mobile-results-focus\{[^}]*max-height:0[^}]*opacity:0/);
  assert.match(css,/transition:opacity \.18s ease/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
