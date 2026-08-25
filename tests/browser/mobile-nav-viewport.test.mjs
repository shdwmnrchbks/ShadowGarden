import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("mobile navigation is portaled outside the filtered sticky header and anchored to the viewport", async () => {
  const [css, navScript] = await Promise.all([
    read("src/assets/css/nav.css"),
    read("src/assets/js/nav.js")
  ]);

  assert.match(navScript, /nav\.classList\.add\(['"]site-nav-drawer['"]\)/);
  assert.match(navScript, /document\.body\.appendChild\(nav\)/);

  assert.match(css, /\.site-nav-drawer\{[^}]*position:fixed!important/);
  assert.match(css, /\.site-nav-drawer\{[^}]*top:72px;bottom:0/);
  assert.match(css, /\.site-nav-drawer\{[^}]*height:auto/);
  assert.match(css, /\.site-nav-drawer\{[^}]*overflow-y:auto/);
  assert.match(css, /\.site-nav-drawer\{[^}]*overscroll-behavior:contain/);
  assert.match(css, /@media\(max-width:720px\)\{\.site-nav-drawer\{[^}]*top:62px;bottom:0;height:auto/);
  assert.match(css, /padding:18px 14px max\(18px,env\(safe-area-inset-bottom\)\)/);

  assert.equal(css.includes(".site-header nav{position:fixed"), false);
  assert.equal(css.includes("height:calc(100dvh - 72px)"), false);
  assert.equal(css.includes("height:calc(100dvh - 62px)"), false);
  assert.equal(css.includes("position:absolute!important;top:100%"), false);
});
