import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("mobile filter expansion keeps Search as the stable anchor and animates only hydrated controls",async()=>{
  const [script,layout,features]=await Promise.all([
    read("src/assets/js/library-mobile-filter.js"),
    read("src/assets/css/library-layout.css"),
    read("src/assets/css/library-features.css")
  ]);

  assert.match(script,/if\(toggle\.parentElement!==searchField\)searchField\.appendChild\(toggle\)/);
  assert.match(script,/searchStack\.insertAdjacentElement\('afterend',head\)/);
  assert.match(script,/panel\.insertBefore\(head,searchStack\)/);
  assert.equal(script.includes("headActions.appendChild(toggle);\n    placeActiveTags"),false,"mobile sync must not move the toggle into the expanded header");
  assert.match(features,/filters-mobile-initial-collapsed/);
  assert.match(layout,/filters\.filters-collapsed:not\(\.filters-mobile-initial-collapsed\)>\.filter-head\{display:flex!important;max-height:0/);
  assert.match(layout,/filters\.filters-collapsed:not\(\.filters-mobile-initial-collapsed\)>\.filter-group\{display:grid!important;max-height:0/);
  assert.match(layout,/transition:max-height \.22s ease,opacity \.16s ease,transform \.18s ease/);
  assert.match(layout,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?filters:not\(\.filters-mobile-initial-collapsed\)/);
});

test("Main and Adult expose the same expanded sort set without inventing a duration field",async()=>{
  const [main,adult,model,preferences]=await Promise.all([
    read("src/index.html"),
    read("src/nsfw.html"),
    read("src/assets/js/library-model.js"),
    read("src/assets/js/domain/preferences.js")
  ]);
  const expected=["recent","oldest","title","title-desc","author","author-desc","year","year-asc","volumes","volumes-asc"];
  const options=html=>[...html.matchAll(/<option value="([^"]+)">(?:Recently added|Oldest added|Title A–Z|Title Z–A|Author A–Z|Author Z–A|Year newest|Year oldest|Most volumes|Fewest volumes)<\/option>/g)].map(match=>match[1]);
  assert.deepEqual(options(main),expected);
  assert.deepEqual(options(adult),expected);
  for(const key of expected){
    assert.ok(model.includes(`"${key}"`),`model is missing sort ${key}`);
    assert.ok(preferences.includes(`"${key}"`),`preferences are missing sort ${key}`);
  }
  assert.equal(/duration/i.test(main.match(/<select id="sortSelect">[\s\S]*?<\/select>/)?.[0]||""),false);
  assert.equal(/duration/i.test(model),false,"duration must not be fabricated before the catalog defines canonical duration metadata");
});

test("Library interaction focus states are keyboard-visible",async()=>{
  const layout=await read("src/assets/css/library-layout.css");
  assert.match(layout,/\.filters select:focus-visible,\.search-field:focus-within/);
  assert.match(layout,/\.active-filter-tags button:focus-visible/);
  assert.match(layout,/outline:2px solid color-mix/);
});
