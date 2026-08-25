import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Series Editor uses Save series as the only series-level translation save action",async()=>{
  const [translations,library,catalog]=await Promise.all([
    read("src/assets/js/admin/translation-workflow.js"),
    read("src/assets/js/admin/library-workflow.js"),
    read("functions/services/catalog.js")
  ]);

  assert.equal(translations.includes("Save translation credits"),false);
  assert.equal(translations.includes("saveTranslationCredits"),false);
  assert.match(translations,/Changes are saved with <strong>Save series<\/strong>/);
  assert.match(translations,/function seriesPayload\(\)/);
  assert.match(translations,/return\{sync,seriesPayload\}/);

  assert.match(library,/keeper\.workflows\.get\("translations"\)\?\.instance\?\.seriesPayload\?\.\(\)/);
  assert.match(library,/\.\.\.translationPayload/);

  assert.match(catalog,/hasTranslationMetadata/);
  assert.match(catalog,/validateTranslationCredits\(input\.translations\)/);
  assert.match(catalog,/series\.translationStatus=translationStatus/);
  assert.match(catalog,/series\.translations=translationCredits\.value/);
});
