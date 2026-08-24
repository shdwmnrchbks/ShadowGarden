import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("mobile navigation stays anchored to the visible viewport after document scroll", async () => {
  const css = await read("src/assets/css/nav.css");

  assert.match(css, /\.site-header nav\{[^}]*position:fixed!important/);
  assert.match(css, /\.site-header nav\{[^}]*top:72px;bottom:0/);
  assert.match(css, /\.site-header nav\{[^}]*height:auto/);
  assert.match(css, /\.site-header nav\{[^}]*overflow-y:auto/);
  assert.match(css, /\.site-header nav\{[^}]*overscroll-behavior:contain/);
  assert.match(css, /@media\(max-width:720px\)\{\.site-header nav\{[^}]*top:62px;bottom:0;height:auto/);
  assert.match(css, /padding:18px 14px max\(18px,env\(safe-area-inset-bottom\)\)/);

  assert.equal(css.includes("height:calc(100dvh - 72px)"), false);
  assert.equal(css.includes("height:calc(100dvh - 62px)"), false);
  assert.equal(css.includes("position:absolute!important;top:100%"), false);
});
