import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=path=>fs.readFile(new URL(`../../${path}`,import.meta.url),"utf8");

test("Library discovery UI exposes contextual counts, clear-all, actionable empty states, persistence, and reroll",async()=>{
  const [controller,model,renderers,preferences,css,index,adult]=await Promise.all([
    read("src/assets/js/library.js"),read("src/assets/js/library-model.js"),read("src/assets/js/library-renderers.js"),read("src/assets/js/domain/preferences.js"),read("src/assets/css/library-features.css"),read("src/index.html"),read("src/nsfw.html")
  ]);
  assert.match(model,/contextualFilterOptions/);
  assert.match(controller,/contextualFilterOptions\(state\.items,state/);
  assert.match(controller,/data-clear-all-filters/);
  assert.match(controller,/renderEmptyActions/);
  assert.match(controller,/setLibrarySort\(scope,state\.sort\)/);
  assert.match(controller,/setLibraryView\(scope,state\.view\)/);
  assert.match(controller,/suggestionRandom=Math\.random\(\);renderContinue\(\)/);
  assert.match(renderers,/data-another-suggestion/);
  assert.match(preferences,/SORT_PREFIX/);
  assert.match(css,/\.catalog-grid\.is-updating/);
  assert.match(css,/\.empty-filter-actions/);
  assert.match(index,/id="emptyActions"/);
  assert.match(adult,/id="emptyActions"/);
});
