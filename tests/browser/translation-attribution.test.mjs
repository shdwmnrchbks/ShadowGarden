import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Library and Series expose fan translators as first-class filterable provenance",async()=>{
  const [library,model,cards,series,css]=await Promise.all([
    read("src/assets/js/library.js"),
    read("src/assets/js/library-model.js"),
    read("src/assets/js/library-renderers.js"),
    read("src/assets/js/series-renderers.js"),
    read("src/assets/css/series-extra.css")
  ]);
  assert.match(library,/translator:""/);
  assert.match(library,/id="translatorSelect"/);
  assert.match(library,/params\.get\("translator"\)/);
  assert.match(library,/Translator: \$\{state\.translator\}/);
  assert.match(model,/translatorNames\(series\)/);
  assert.match(cards,/card-translator/);
  assert.match(series,/Translation Credits/);
  assert.match(series,/translator=\$\{encodeURIComponent/);
  assert.match(series,/translation-source/);
  assert.match(series,/volume-translator/);
  assert.match(css,/translation-panel/);
});

test("Garden Keeper owns editable series credits, translation status and per-volume overrides",async()=>{
  const [app,workflow,route,service]=await Promise.all([
    read("src/assets/js/admin/app.js"),
    read("src/assets/js/admin/translation-workflow.js"),
    read("functions/admin-api/translations.js"),
    read("functions/services/translations.js")
  ]);
  assert.match(app,/admin\/translation-workflow\.js/);
  assert.match(app,/"translations"/);
  assert.match(workflow,/Translation provenance/);
  assert.match(workflow,/Translation override/);
  assert.match(workflow,/translationStatus/);
  assert.match(workflow,/\/admin-api\/translations/);
  assert.match(route,/handleTranslationsPost/);
  assert.match(service,/snapshotCatalogs/);
  assert.match(service,/update-volume-translation-override/);
});
