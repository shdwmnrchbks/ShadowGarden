import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=path=>fs.readFile(new URL(`../../${path}`,import.meta.url),"utf8");

test("Library and Series first paint uses stable themed skeletons with compact preference and reduced-motion support",async()=>{
  const [main,adult,series,libraryCss,seriesCss]=await Promise.all([
    read("src/index.html"),read("src/nsfw.html"),read("src/series.html"),
    read("src/assets/css/library-layout.css"),read("src/assets/css/series-extra.css")
  ]);
  assert.match(main,/sg-view:main/);
  assert.match(adult,/sg-view:nsfw/);
  assert.ok((main.match(/catalog-skeleton-card/g)||[]).length>=6);
  assert.ok((adult.match(/catalog-skeleton-card/g)||[]).length>=6);
  assert.match(adult,/class="adult-library adult-locked"/);
  assert.match(adult,/sg-adult-acknowledged/);
  assert.match(series,/window\.__SG_SERIES_ROUTE_ADULT__=adult/);
  assert.match(series,/series-loading-skeleton/);
  assert.ok((series.match(/series-loading-volume-cover/g)||[]).length>=6);
  assert.equal(series.includes("Parting the leaves…"),false);
  assert.match(libraryCss,/html\.sg-library-initial-compact/);
  assert.match(libraryCss,/\.adult-library \.catalog-skeleton-card/);
  assert.match(libraryCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(seriesCss,/\.series-loading-hero/);
  assert.match(seriesCss,/\.adult-library \.series-loading-hero/);
  assert.match(seriesCss,/@media\(prefers-reduced-motion:reduce\)/);
});
