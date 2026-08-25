import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("New Books can seed a series fan-translation credit and translation status",async()=>{
  const [fields,batch,validation,catalog]=await Promise.all([
    read("src/assets/js/admin/upload-fields.js"),
    read("src/assets/js/admin-batch.js"),
    read("functions/services/validation.js"),
    read("functions/services/catalog.js")
  ]);
  for(const id of ["translationStatusInput","translatorNameInput","translatorGroupInput","translatorUrlInput","translatorCoverageInput"])assert.match(fields,new RegExp(id));
  assert.match(batch,/translationStatus:item\.translationStatus/);
  assert.match(batch,/translations:item\.translations/);
  assert.match(validation,/validateTranslationCredits/);
  assert.match(validation,/Unknown translation status/);
  assert.match(catalog,/translationStatus: input\.translationStatus/);
  assert.match(catalog,/translations: input\.translations/);
  assert.match(catalog,/previous\?\.translations/);
});
