import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("mobile Library and Adult filters enter collapsed with wrapped removable active-filter pills",async()=>{
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

  const queryMarker='filterPill(`Search: ${query}`,"query"';
  const authorMarker='filterPill(`Author: ${state.author}`,"author"';
  for(const marker of [
    queryMarker,
    authorMarker,
    'filterPill(`Year: ${state.year}`,"year"',
    'filterPill(`Volumes: ${labels[state.volumeRange]||state.volumeRange}`,"volumeRange"',
    'filterPill(`Reading: ${state.readingStatus==="finished"?"Finished":"Unfinished"}`,"readingStatus"',
    'filterPill("Pinned only","pinnedOnly"'
  ])assert.ok(controller.includes(marker),`missing active filter pill contract: ${marker}`);

  assert.ok(controller.indexOf(queryMarker)<controller.indexOf(authorMarker),"active search query must be the first filter pill");
  assert.match(controller,/if\(key==="query"\)state\.query=""/);
  assert.match(controller,/addEventListener\("input"[^\n]*renderActiveFilters\(\)[^\n]*syncMobileResultFocus\(\)/);
  assert.match(controller,/active-filter-pill-label/);
  assert.match(controller,/data-remove-tag/);
  assert.match(controller,/clearNamedFilter/);
  assert.match(css,/text-overflow:ellipsis/);
  assert.match(css,/active-filter-pill-label/);
  assert.match(css,/\.active-filter-tags\{width:100%;max-width:100%;flex-wrap:wrap;align-items:flex-start;overflow:visible\}/);
  assert.equal(css.includes(".active-filter-tags{flex-wrap:nowrap"),false,"mobile filter pills must not return to a clipped single-row rail");
});

test("mobile filtering fades Recently Added and removes reserved space before catalog results",async()=>{
  const [controller,css]=await Promise.all([
    read("src/assets/js/library.js"),
    read("src/assets/css/library-features.css")
  ]);

  assert.match(controller,/hasActiveResultFilter/);
  assert.match(controller,/state\.query\.trim\(\)/);
  assert.match(controller,/mobile-results-focus/);
  assert.match(controller,/addEventListener\("input"[^\n]*syncMobileResultFocus\(\)/);
  assert.match(css,/\.recent-section\.mobile-results-focus\{[^}]*max-height:0[^}]*opacity:0/);
  assert.match(css,/\.catalog-main>\.recent-section\.mobile-results-focus\{[^}]*max-height:0[^}]*padding:0[^}]*min-height:0/);
  assert.match(css,/\.catalog-main>\.recent-section\.mobile-results-focus\+\.catalog-bar\{margin-top:0\}/);
  assert.match(css,/\.catalog-layout\{row-gap:14px\}/);
  assert.match(css,/transition:opacity \.18s ease/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
