import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Recently Added keeps volume, series, and added date independently scannable",async()=>{
  const [renderer,css]=await Promise.all([
    read("src/assets/js/library-renderers.js"),
    read("src/assets/css/library-features.css")
  ]);
  assert.match(renderer,/function recentCopy\(series, title, added, esc, format\)/);
  assert.match(renderer,/class="recent-volume-series"/);
  assert.match(renderer,/class="recent-volume-added">Added /);
  assert.equal(renderer.includes('${esc(series?.title)} · ${esc(formatDate(volume?.added, format))}'),false,"series and added date must not collapse back into one ellipsized line");
  assert.match(css,/\.recent-volume-copy\{[^}]*display:grid;gap:3px/);
  assert.match(css,/\.recent-volume-copy strong\{[^}]*-webkit-line-clamp:2/);
  assert.match(css,/\.recent-volume-series\{[^}]*color:var\(--muted\)/);
  assert.match(css,/\.recent-volume-added\{[^}]*font-variant-numeric:tabular-nums/);
});

test("Library cards expose whole-card hover and keyboard focus without reserving blank grid-title rows",async()=>{
  const [features,layout]=await Promise.all([
    read("src/assets/css/library-features.css"),
    read("src/assets/css/library-layout.css")
  ]);
  assert.match(features,/\.recent-volume:focus-visible\{outline:2px solid/);
  assert.match(features,/\.catalog-grid:not\(\.compact\) \.series-card:focus-visible\{outline:2px solid/);
  assert.match(features,/\.catalog-grid\.compact \.series-card:hover,\.catalog-grid\.compact \.series-card:focus-visible\{/);
  assert.match(features,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.recent-volume/);
  assert.match(features,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.catalog-grid\.compact \.series-card/);
  assert.match(layout,/\.catalog-grid:not\(\.compact\) \.series-card>\.card-copy h2\{\s*min-height:0!important/);
});

test("mobile navigation documentation matches the no-layout-shift implementation",async()=>{
  const [contract,design,navCss]=await Promise.all([
    read("docs/architecture/MOBILE_NAVIGATION.md"),
    read("docs/architecture/DESIGN_SYSTEM.md"),
    read("src/assets/css/nav.css")
  ]);
  assert.match(contract,/site header remains `position: sticky` and stays in normal document flow/);
  assert.match(contract,/must not change the header to `position: fixed`/);
  assert.match(contract,/must not add compensating top padding/);
  assert.match(design,/site header remains sticky and in normal document flow/);
  assert.match(design,/No `body\.site-nav-open` top-padding compensation is used/);
  assert.equal(navCss.includes("body.site-nav-open{padding-top:"),false);
  assert.equal(navCss.includes(".site-nav-open .site-header{position:fixed"),false);
});

test("v2.4 release reconciliation records the duration metadata boundary explicitly",async()=>{
  const release=await read("docs/releases/v2.4.0.md");
  assert.match(release,/Plan-completion slices after the initial release/);
  assert.match(release,/#134 — Library navigation, filters, and sorting/);
  assert.match(release,/#135 — Series hierarchy and volume interaction polish/);
  assert.match(release,/#136 — Reader toolbar and progress polish/);
  assert.match(release,/no canonical duration, reading-time, or word-count metadata/);
  assert.match(release,/does \*\*not\*\* substitute file size or another misleading proxy/);
});
