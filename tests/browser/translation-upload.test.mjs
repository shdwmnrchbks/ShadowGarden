import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("New Books seeds simplified translation metadata and scans EPUB contributor translator roles",async()=>{
  const [fields,batch,validation,catalog]=await Promise.all([
    read("src/assets/js/admin/upload-fields.js"),
    read("src/assets/js/admin-batch.js"),
    read("functions/services/validation.js"),
    read("functions/services/catalog.js")
  ]);
  for(const id of ["translationStatusInput","translatorNameInput","translatorUrlInput","translatorCoverageInput"])assert.match(fields,new RegExp(id));
  assert.equal(fields.includes("translatorGroupInput"),false);
  assert.match(batch,/function epubTranslatorNames\(opf\)/);
  assert.match(batch,/meta\.getAttribute\("refines"\)/);
  assert.match(batch,/meta\.getAttribute\("property"\)/);
  assert.match(batch,/node\.getAttribute\("opf:role"\)/);
  assert.match(batch,/translatorNames\.slice\(0,1\)\.map\(name=>\(\{name\}\)\)/);
  assert.match(batch,/translations:arr\(meta\.translations\)/);
  assert.equal(batch.includes("translatorGroupInput"),false);
  assert.match(batch,/translationStatus:item\.translationStatus/);
  assert.match(batch,/translations:item\.translations/);
  assert.match(validation,/validateTranslationCredits/);
  assert.match(validation,/Unknown translation status/);
  assert.match(catalog,/translationStatus: input\.translationStatus/);
  assert.match(catalog,/translations: input\.translations/);
  assert.match(catalog,/previous\?\.translations/);
});
