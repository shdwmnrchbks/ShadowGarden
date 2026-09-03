import test from "node:test";
import assert from "node:assert/strict";

import { readerFailureCopy } from "../../src/assets/js/reader/error-presentation.js";

test("Reader failure copy distinguishes damaged EPUB packages without exposing raw parser text",()=>{
  const parserMessage="Can't find end of central directory : is this a zip file?";
  const copy=readerFailureCopy(new Error(parserMessage));
  assert.equal(copy.title,"This EPUB appears incomplete or damaged.");
  assert.match(copy.detail,/Re-upload or replace the EPUB/);
  assert.equal(copy.title.includes(parserMessage),false);
  assert.equal(copy.detail.includes(parserMessage),false);
});

test("Reader failure copy distinguishes unreadable spine/content structures",()=>{
  const copy=readerFailureCopy(new Error("No Section Found"));
  assert.equal(copy.title,"This EPUB has no readable content Shadow Garden can open.");
  assert.match(copy.detail,/reading order or content/);
});

test("Reader failure copy keeps authorization failures separate from EPUB parsing failures",()=>{
  const missing=readerFailureCopy(new Error("No EPUB file was selected."),{phase:"authorization"});
  assert.equal(missing.title,"No EPUB was selected.");

  const access=readerFailureCopy(new Error("upstream ticket failure"),{phase:"authorization"});
  assert.equal(access.title,"Shadow Garden could not authorize this EPUB.");
});
