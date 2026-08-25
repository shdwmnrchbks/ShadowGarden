import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Reader toolbar keeps book/chapter hierarchy and clear keyboard affordances",async()=>{
  const [css,html]=await Promise.all([
    read("src/assets/css/reader-presentation.css"),
    read("src/reader.html")
  ]);
  assert.match(html,/class="reader-title"[\s\S]*?id="bookTitle"[\s\S]*?id="chapterTitle"/);
  assert.match(css,/\.reader-title\{display:grid;align-content:center;gap:2px;line-height:1\.2\}/);
  assert.match(css,/\.reader-title strong\{font-size:\.8rem;font-weight:680/);
  assert.match(css,/\.reader-title span\{[^}]*font-size:\.64rem/);
  assert.match(css,/\.reader-actions \.reader-return\{[^}]*border-left-color:var\(--line\)/);
  assert.match(css,/\.reader-icon:focus-visible,\.reader-bottombar>button:focus-visible,\.progress-wrap input:focus-visible,\.continuous-seek:focus-visible\{outline:2px solid var\(--leaf\)/);
});

test("Reader progress is more scannable in Pages and Continuous modes without changing progress controls",async()=>{
  const [css,html]=await Promise.all([
    read("src/assets/css/reader-presentation.css"),
    read("src/reader.html")
  ]);
  assert.match(html,/id="progressRange" type="range" min="0" max="1000" value="0"/);
  assert.match(html,/id="progressText">0%<\/span>/);
  assert.match(html,/id="continuousSeek" class="continuous-seek" role="slider"/);
  assert.match(css,/\.progress-wrap\{grid-template-columns:minmax\(120px,1fr\) auto;gap:12px/);
  assert.match(css,/\.progress-wrap span\{min-width:48px;padding:4px 7px;border:1px solid var\(--line\);border-radius:999px/);
  assert.match(css,/body\.reader-flow-scrolled \.continuous-seek-text\{font-weight:700;font-variant-numeric:tabular-nums\}/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*?\.progress-wrap\{grid-template-columns:minmax\(0,1fr\) 44px;gap:7px\}/);
});

test("Reader hierarchy polish does not override EPUB typography preferences and respects reduced motion",async()=>{
  const css=await read("src/assets/css/reader-presentation.css");
  assert.equal(/\.viewer iframe[^}]*font-(?:family|size)|\.epub-container[^}]*line-height/.test(css),false,"outer Reader polish must not override the book typography controlled by Reader settings");
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.reader-brand\{transition:none\}/);
});
