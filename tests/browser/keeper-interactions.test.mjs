import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=path=>fs.readFile(new URL(`../../${path}`,import.meta.url),"utf8");

test("Keeper interaction layer owns dirty saves, canonical genre chips, upload review, destructive hierarchy, and focus return",async()=>{
  const [app,controller,presentation,taxonomy]=await Promise.all([
    read("src/assets/js/admin/app.js"),
    read("src/assets/js/admin/editor-interactions.js"),
    read("src/assets/css/admin-presentation.css"),
    read("src/assets/js/domain/catalog-taxonomy.js")
  ]);

  assert.match(app,/\/assets\/js\/admin\/editor-interactions\.js/);
  assert.match(controller,/beforeunload/);
  assert.match(controller,/Discard unsaved series changes\?/);
  assert.match(controller,/series-editor-dirty/);
  assert.match(controller,/seriesSaveState/);
  assert.match(controller,/Saving…/);
  assert.match(controller,/latest\.textContent=`✓ \$\{latest\.textContent\}`/);
  assert.match(controller,/CANONICAL_GENRES/);
  assert.match(controller,/keeper-genre-picker/);
  assert.match(controller,/normalizeGenres/);
  assert.match(controller,/uploadReviewSummary/);
  assert.match(controller,/Upload summary/);
  assert.match(controller,/returnTargets/);
  assert.match(controller,/focus\(\{preventScroll:true\}\)/);
  assert.match(controller,/manageBanner/,"auto-saved banner selection must stay outside Series dirty state");

  assert.match(taxonomy,/export const CANONICAL_GENRES/);
  assert.match(presentation,/#seriesEditor \.dialog-actions/);
  assert.match(presentation,/#seriesEditor \.dialog-actions #deleteSeries/);
  assert.match(presentation,/\.keeper-genre-chip-grid/);
  assert.match(presentation,/\.upload-review-summary/);
  assert.match(presentation,/@media\(prefers-reduced-motion:reduce\)/);
});
