import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("mobile navigation keeps viewport ownership, pinned header, stable layout, styled links, and background scroll lock", async () => {
  const [css, navScript] = await Promise.all([
    read("src/assets/css/nav.css"),
    read("src/assets/js/nav.js")
  ]);

  assert.match(navScript, /nav\.classList\.add\(['"]site-nav-drawer['"]\)/);
  assert.match(navScript, /document\.body\.appendChild\(nav\)/);
  assert.match(navScript, /document\.documentElement\.classList\.toggle\(['"]site-nav-open['"],open\)/);
  assert.match(navScript, /document\.body\.classList\.toggle\(['"]site-nav-open['"],open\)/);

  assert.match(css, /\.site-nav-open \.site-header\{[^}]*position:fixed!important;top:0;left:0;right:0;width:100%;z-index:70/);
  assert.match(css, /body\.site-nav-open\{padding-top:72px\}/);
  assert.match(css, /@media\(max-width:720px\)\{body\.site-nav-open\{padding-top:62px\}\.site-nav-drawer\{[^}]*top:62px;bottom:0;height:auto/);
  assert.match(css, /\.site-nav-drawer\{[^}]*position:fixed!important/);
  assert.match(css, /\.site-nav-drawer\{[^}]*top:72px;bottom:0/);
  assert.match(css, /\.site-nav-drawer\{[^}]*height:auto/);
  assert.match(css, /\.site-nav-drawer\{[^}]*overflow-y:auto/);
  assert.match(css, /\.site-nav-drawer\{[^}]*overscroll-behavior:contain/);
  assert.match(css, /\.site-nav-drawer\{[^}]*touch-action:pan-y/);
  assert.match(css, /padding:18px 14px max\(18px,env\(safe-area-inset-bottom\)\)/);

  assert.match(css, /\.site-nav-drawer a,\.site-nav-drawer \.nav-button\{[^}]*color:var\(--muted\);text-decoration:none;background:transparent;cursor:pointer/);
  assert.match(css, /\.site-nav-drawer a:hover,\.site-nav-drawer a:focus-visible,[^{]+\{[^}]*color:var\(--text\)/);

  assert.match(css, /\.site-nav-backdrop\{[^}]*touch-action:none;overscroll-behavior:none/);
  assert.match(css, /\.site-nav-open\{overflow:hidden!important;overscroll-behavior:none\}/);

  assert.equal(css.includes(".site-header nav{position:fixed"), false);
  assert.equal(css.includes("height:calc(100dvh - 72px)"), false);
  assert.equal(css.includes("height:calc(100dvh - 62px)"), false);
  assert.equal(css.includes("position:absolute!important;top:100%"), false);
});
