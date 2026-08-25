import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Series motion reads renderer-owned state and progress without becoming a state owner",async()=>{
  const [html,js,css]=await Promise.all([
    read("src/series.html"),read("src/assets/js/series-motion.js"),read("src/assets/css/series-motion.css")
  ]);
  assert.match(html,/assets\/css\/series-motion\.css/);
  assert.match(html,/assets\/js\/series-motion\.js/);
  assert.match(js,/dataset\?\.readingState/);
  assert.match(js,/\.cover-reading-progress>span/);
  assert.match(js,/new MutationObserver/);
  assert.match(js,/bar\.animate/);
  assert.equal(js.includes("localStorage"),false,"Series motion must not own reading state persistence");
  assert.equal(js.includes("setItem("),false,"Series motion must not write reading state");
  assert.match(css,/sg-reading-state-changed/);
});

test("Series progress interpolation animates from prior rendered width to current rendered width",async()=>{
  const js=await read("src/assets/js/series-motion.js");
  assert.match(js,/before\/after/);
  assert.match(js,/transform:`scaleX\(\$\{Math\.max\(0,fromScale\)\}\)`/);
  assert.match(js,/duration:390/);
  assert.equal(js.includes("progressRange"),false,"Series motion must not derive Reader progress");
});

test("Reader motion refines existing chrome ownership and observes progress presentation only",async()=>{
  const [html,css,js,interaction]=await Promise.all([
    read("src/reader.html"),read("src/assets/css/reader-motion.css"),read("src/assets/js/reader-motion.js"),read("src/assets/js/reader/interaction-controller.js")
  ]);
  assert.match(html,/assets\/css\/motion\.css/);
  assert.match(html,/assets\/css\/reader-motion\.css/);
  assert.match(html,/assets\/js\/motion\.js/);
  assert.match(html,/assets\/js\/reader-motion\.js/);
  assert.match(interaction,/classList\.toggle\("reader-chrome-hidden"/);
  assert.match(css,/reader-chrome-hidden/);
  assert.match(css,/--sg-motion-fast/);
  assert.match(css,/--sg-motion-ui/);
  assert.match(js,/observeText\(document\.getElementById\("progressText"\)\)/);
  assert.match(js,/observeText\(document\.getElementById\("continuousSeekText"\)\)/);
  assert.equal(js.includes("progressRange.value="),false,"Reader motion must not write canonical progress controls");
  assert.equal(js.includes("localStorage"),false,"Reader motion must not persist Reader state");
});

test("Series Reader navigation and optional animation remain progressive and reduced-motion safe",async()=>{
  const [readerCss,seriesCss,motionCss]=await Promise.all([
    read("src/assets/css/reader-motion.css"),read("src/assets/css/series-motion.css"),read("src/assets/css/motion.css")
  ]);
  assert.match(readerCss,/@view-transition\{navigation:auto\}/);
  assert.match(readerCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(seriesCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(motionCss,/::view-transition-old\(root\)/);
  assert.match(motionCss,/::view-transition-new\(root\)/);
});
