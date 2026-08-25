import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Series hierarchy and preferred Continue action remain visually prominent without changing action state",async()=>{
  const [css,renderer]=await Promise.all([
    read("src/assets/css/series-extra.css"),
    read("src/assets/js/series-renderers.js")
  ]);
  assert.match(renderer,/class="primary-button" \$\{attrs\(startAction, esc\)\}/);
  assert.match(css,/\.series-hero-inner\{padding-top:58px;padding-bottom:50px;gap:42px\}/);
  assert.match(css,/\.series-info h1\{max-width:820px;text-wrap:balance\}/);
  assert.match(css,/\.series-actions \.primary-button\[data-volume-state="in_progress"\]\{[^}]*min-height:50px/);
  assert.match(css,/\.series-actions \.primary-button\[data-volume-state="in_progress"\]::before\{content:"▶"/);
  assert.equal(renderer.includes("data-volume-state=\"in_progress\""),false,"renderer must continue deriving state through the shared attrs/action pipeline rather than hard-coding Continue state");
});

test("Series volume cards provide whole-card hover/focus rhythm and aligned metadata",async()=>{
  const css=await read("src/assets/css/series-extra.css");
  assert.match(css,/\.volume-card\{[^}]*height:100%;display:flex;flex-direction:column[^}]*border:1px solid transparent/);
  assert.match(css,/\.volume-card:hover,\.volume-card:focus-within\{[^}]*border-color:var\(--line\)[^}]*box-shadow:/);
  assert.match(css,/\.volume-card\.is-in-progress\{[^}]*background:/);
  assert.match(css,/\.volume-title-row\{margin-top:10px;min-height:2\.55em/);
  assert.match(css,/\.volume-meta\{min-height:1\.35em[^}]*font-variant-numeric:tabular-nums/);
  assert.match(css,/\.volume-actions\{margin-top:auto;padding-top:10px\}/);
  assert.match(css,/\.volume-cover-link:focus-visible\{outline:2px solid var\(--leaf2\)/);
});

test("Series interaction polish respects reduced motion",async()=>{
  const css=await read("src/assets/css/series-extra.css");
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.series-actions \.primary-button,\.volume-card,\.volume-actions a\{transition:none\}/);
  assert.match(css,/\.volume-card:hover,\.volume-card:focus-within,.volume-actions a:hover,.volume-actions a:focus-visible\{transform:none\}/);
});
