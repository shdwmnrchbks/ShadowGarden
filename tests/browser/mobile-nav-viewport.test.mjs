import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("mobile navigation keeps viewport drawer ownership without shifting the sticky header", async () => {
  const [css, siteCss, navScript] = await Promise.all([
    read("src/assets/css/nav.css"),
    read("src/assets/css/site.css"),
    read("src/assets/js/nav.js")
  ]);

  assert.match(navScript, /nav\.classList\.add\(['"]site-nav-drawer['"]\)/);
  assert.match(navScript, /document\.body\.appendChild\(nav\)/);
  assert.match(navScript, /document\.documentElement\.classList\.toggle\(['"]site-nav-open['"],open\)/);
  assert.match(navScript, /document\.body\.classList\.toggle\(['"]site-nav-open['"],open\)/);

  assert.match(siteCss, /\.site-header\{[^}]*position:sticky;top:0/);
  assert.match(css, /html\{scrollbar-gutter:stable\}/);
  assert.match(css, /\.site-nav-open \.site-header\{[^}]*z-index:70[^}]*box-shadow:/);
  assert.equal(css.includes(".site-nav-open .site-header{position:fixed"), false, "opening nav must not take the sticky header out of document flow");
  assert.equal(css.includes("body.site-nav-open{padding-top:"), false, "opening nav must not compensate with layout-shifting body padding");

  assert.match(css, /\.site-nav-drawer\{[^}]*position:fixed!important/);
  assert.match(css, /\.site-nav-drawer\{[^}]*top:72px;bottom:0/);
  assert.match(css, /\.site-nav-drawer\{[^}]*height:auto/);
  assert.match(css, /\.site-nav-drawer\{[^}]*overflow-y:auto/);
  assert.match(css, /\.site-nav-drawer\{[^}]*overscroll-behavior:contain/);
  assert.match(css, /\.site-nav-drawer\{[^}]*touch-action:pan-y/);
  assert.match(css, /@media\(max-width:720px\)\{\.site-nav-drawer\{[^}]*top:62px;bottom:0;height:auto/);
  assert.match(css, /padding:18px 14px max\(18px,env\(safe-area-inset-bottom\)\)/);

  assert.match(css, /\.site-nav-drawer a,\.site-nav-drawer \.nav-button\{[^}]*transition:color/);
  assert.match(css, /\.site-nav-drawer a\[aria-current="page"\]::before/);
  assert.match(css, /\.site-nav-drawer a:focus-visible,[^{]+\.brand-mark:focus-visible\{[^}]*outline:2px solid/);
  assert.match(css, /\.site-nav-backdrop\{[^}]*touch-action:none;overscroll-behavior:none/);
  assert.match(css, /\.site-nav-open\{overflow:hidden!important;overscroll-behavior:none\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);

  assert.equal(css.includes(".site-header nav{position:fixed"), false);
  assert.equal(css.includes("height:calc(100dvh - 72px)"), false);
  assert.equal(css.includes("height:calc(100dvh - 62px)"), false);
  assert.equal(css.includes("position:absolute!important;top:100%"), false);
});
