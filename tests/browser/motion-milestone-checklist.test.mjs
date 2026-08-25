import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("motion milestone stays explicitly four-slice",async()=>{
  const doc=await read("docs/releases/v2.5-motion.md");
  assert.match(doc,/1\. Motion foundation/);
  assert.match(doc,/2\. Library motion/);
  assert.match(doc,/3\. Series \+ Reader motion/);
  assert.match(doc,/4\. Keeper \+ navigation continuity/);
  assert.match(doc,/does not become a state owner/);
});
