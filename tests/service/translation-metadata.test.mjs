import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTranslationStatus, validateTranslationCredits } from "../../functions/_lib/translations.js";
import { publicCatalogShape } from "../../functions/_lib/book-id.js";

test("server translation validation accepts structured provenance and rejects unsafe URLs",()=>{
  assert.equal(normalizeTranslationStatus("paused"),"Stalled");
  const good=validateTranslationCredits([{name:"Fan TL",group:"Group",url:"https://example.com/work",coverage:"Chapters 1–120"}]);
  assert.equal(good.ok,true);
  assert.equal(good.value[0].url,"https://example.com/work");
  assert.equal(validateTranslationCredits([{name:"Bad",url:"javascript:alert(1)"}]).ok,false);
});

test("public catalog keeps translation attribution while EPUB-private fields remain redacted",async()=>{
  const shaped=await publicCatalogShape({series:[{
    id:"demo",
    translations:[{name:"Fan TL",coverage:"Volumes 1–2"}],
    translationStatus:"Ongoing",
    volumes:[{
      title:"Volume 1",
      file:"/media/shadow-garden/books/demo.epub",
      sha256:"secret",
      originalFilename:"secret.epub",
      translations:[{name:"Volume TL"}]
    }]
  }]});
  const series=shaped.series[0],volume=series.volumes[0];
  assert.equal(series.translations[0].name,"Fan TL");
  assert.equal(series.translationStatus,"Ongoing");
  assert.equal(volume.translations[0].name,"Volume TL");
  assert.equal("file" in volume,false);
  assert.equal("sha256" in volume,false);
  assert.equal("originalFilename" in volume,false);
  assert.match(volume.bookId,/^bk_/);
});
