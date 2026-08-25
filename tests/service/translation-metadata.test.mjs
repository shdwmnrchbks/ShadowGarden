import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTranslationStatus, validateTranslationCredits } from "../../functions/_lib/translations.js";
import { publicCatalogShape } from "../../functions/_lib/book-id.js";

test("server translation validation accepts the simplified schema and rejects unsafe URLs",()=>{
  assert.equal(normalizeTranslationStatus("paused"),"Stalled");
  const good=validateTranslationCredits([{name:"Fan TL",group:"Retired Group",note:"Retired note",url:"https://example.com/work",coverage:"Chapters 1–120"}]);
  assert.equal(good.ok,true);
  assert.deepEqual(good.value[0],{name:"Fan TL",url:"https://example.com/work",coverage:"Chapters 1–120"});
  assert.equal(validateTranslationCredits([{name:"Bad",url:"javascript:alert(1)"}]).ok,false);
});

test("public catalog keeps translation attribution, strips retired fields, and redacts EPUB-private fields",async()=>{
  const shaped=await publicCatalogShape({series:[{
    id:"demo",
    translations:[{name:"Fan TL",group:"Retired Group",note:"Retired note",coverage:"Volumes 1–2"}],
    translationStatus:"Ongoing",
    volumes:[{
      title:"Volume 1",
      file:"/media/shadow-garden/books/demo.epub",
      sha256:"secret",
      originalFilename:"secret.epub",
      translations:[{name:"Volume TL",group:"Old Group",note:"Old note"}]
    }]
  }]});
  const series=shaped.series[0],volume=series.volumes[0];
  assert.deepEqual(series.translations[0],{name:"Fan TL",coverage:"Volumes 1–2"});
  assert.equal(series.translationStatus,"Ongoing");
  assert.deepEqual(volume.translations[0],{name:"Volume TL"});
  assert.equal("group" in series.translations[0],false);
  assert.equal("note" in series.translations[0],false);
  assert.equal("file" in volume,false);
  assert.equal("sha256" in volume,false);
  assert.equal("originalFilename" in volume,false);
  assert.match(volume.bookId,/^bk_/);
});
