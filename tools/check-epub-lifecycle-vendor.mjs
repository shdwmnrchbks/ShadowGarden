import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED_EPUBJS_VERSION="0.3.93";
const manifestPath=path.join(process.cwd(),"node_modules","epubjs","package.json");
const manifest=JSON.parse(await fs.readFile(manifestPath,"utf8"));
const actual=String(manifest?.version||"");

if(actual!==EXPECTED_EPUBJS_VERSION){
  throw new Error(`EPUB.js ${actual||"unknown"} is not covered by the Reader lifecycle compatibility patch. Review src/assets/js/reader/epub-lifecycle.js before changing the vendor from ${EXPECTED_EPUBJS_VERSION}.`);
}

console.log(`EPUB.js lifecycle compatibility guard passed: ${actual}.`);
