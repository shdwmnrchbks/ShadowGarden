import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveVolumeTranslations,
  normalizeTranslationStatus,
  normalizeTranslations,
  primaryTranslator,
  translatorNames
} from "../../src/assets/js/domain/translations.js";

test("translation provenance normalizes status, credits, inheritance and filter names",()=>{
  const series={
    translationStatus:"completed",
    translations:[{name:"js06",group:"EroLNs",url:"https://erolns.blogspot.com",coverage:"Volumes 1–3"}],
    volumes:[{}, {translations:[{name:"Second TL",coverage:"Volume 2"}]}]
  };
  assert.equal(normalizeTranslationStatus(series.translationStatus),"Complete");
  assert.equal(normalizeTranslations(series.translations)[0].url,"https://erolns.blogspot.com/");
  assert.equal(effectiveVolumeTranslations(series,series.volumes[0])[0].name,"js06");
  assert.equal(effectiveVolumeTranslations(series,series.volumes[1])[0].name,"Second TL");
  assert.deepEqual(translatorNames(series),["js06","EroLNs","Second TL"]);
  assert.equal(primaryTranslator(series).name,"js06");
});
