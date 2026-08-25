import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=path=>fs.readFile(new URL(`../../${path}`,import.meta.url),"utf8");

test("Library and Series expose quiet reading progress, up-next states, and simple back-to-top navigation",async()=>{
  const [libraryRenderer,seriesRenderer,seriesController,statusCss,seriesCss]=await Promise.all([
    read("src/assets/js/library-renderers.js"),
    read("src/assets/js/series-renderers.js"),
    read("src/assets/js/series.js"),
    read("src/assets/css/reading-status.css"),
    read("src/assets/css/series-extra.css")
  ]);
  assert.match(libraryRenderer,/cover-reading-progress/);
  assert.match(libraryRenderer,/readingState\.STATES\.IN_PROGRESS/);
  assert.match(seriesRenderer,/volume-state-pill/);
  assert.match(seriesRenderer,/Up next/);
  assert.match(seriesRenderer,/is-up-next/);
  assert.match(seriesRenderer,/seriesBackToTop/);
  assert.match(seriesController,/window\.scrollY>Math\.max\(640,window\.innerHeight\*\.8\)/);
  assert.match(seriesController,/window\.scrollTo\(\{top:0,behavior:matchMedia/);
  assert.match(statusCss,/\.cover-reading-progress/);
  assert.match(statusCss,/\.volume-state-pill\.progress,\.volume-state-pill\.up-next/);
  assert.match(seriesCss,/\.series-back-to-top/);
  assert.match(seriesCss,/@media\(prefers-reduced-motion:reduce\)/);
});
