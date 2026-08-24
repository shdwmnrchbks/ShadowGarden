import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = relative => fs.readFile(new URL(relative, root), "utf8");
const json = relative => read(relative).then(JSON.parse);

test("Main, Adult, Series, Reader, and Keeper entrypoints expose critical browser surfaces", async () => {
  const [main, adult, series, reader, admin] = await Promise.all([
    read("src/index.html"), read("src/nsfw.html"), read("src/series.html"), read("src/reader.html"), read("src/admin.html")
  ]);

  for (const html of [main, adult]) {
    assert.match(html, /id="catalogGrid"/);
    assert.match(html, /id="continuePanel"/);
    assert.match(html, /library-features\.css/);
    assert.match(html, /public-components\.css/);
    assert.match(html, /public-artwork\.css/);
    assert.match(html, /library-layout\.css/);
    assert.match(html, /reading-status\.css/);
  }
  assert.match(adult, /data-library-scope="nsfw"/);
  assert.match(adult, /id="adultGate"/);
  assert.match(series, /id="seriesRoot"/);
  assert.match(series, /volume-actions\.css/);

  for (const marker of ["id=\"viewer\"", "id=\"tocDrawer\"", "id=\"settingsDrawer\"", "id=\"progressRange\"", "id=\"imageFocus\"", "reader-bootstrap.js", "reader-image-focus.css"]) {
    assert.match(reader, new RegExp(marker));
  }
  assert.match(reader, /reader-flow-paginated/);
  assert.match(reader, /scrolled-doc/);

  assert.match(admin, /id="lockedView"/);
  assert.match(admin, /id="dashboardView"/);
  assert.match(admin, /id="seriesEditor"/);
  assert.match(admin, /admin\/core\.js/);
  assert.match(admin, /admin\/app\.js/);
});

test("visual EPUB fixture remains covered by Visual Page Cache and paginated contain-fit owners", async () => {
  const [fixture, visualCache, visualFit, cover, map, illustration, chapter] = await Promise.all([
    json("tests/fixtures/visual-pages.json"),
    read("src/assets/js/reader-visual-cache.js"),
    read("src/assets/js/reader-paginated-visual-fit.js"),
    read("tests/fixtures/epub/cover.xhtml"),
    read("tests/fixtures/epub/map.xhtml"),
    read("tests/fixtures/epub/illustration.xhtml"),
    read("tests/fixtures/epub/chapter.xhtml")
  ]);
  const visual = fixture.spine.filter(item => item.visualOnly);
  const text = fixture.spine.filter(item => !item.visualOnly);
  assert.deepEqual(visual.map(item => item.kind), ["cover", "map", "illustration"]);
  assert.deepEqual(text.map(item => item.kind), ["chapter"]);
  for (const xhtml of [cover, map, illustration]) assert.equal((xhtml.match(/<img\b/g) || []).length, 1);
  assert.match(cover, /cover-page/);
  assert.match(map, /map-page/);
  assert.match(map, /Map of the Western Continent/);
  assert.match(illustration, /illustration-page/);
  assert.match(chapter, /normal reflowable chapter text/);
  assert.equal((chapter.match(/<p\b/g) || []).length >= 2, true);
  assert.match(visualCache, /shadow-garden-visual-pages/);
  assert.match(visualCache, /cover\|illustration\|illustrated/);
  assert.match(visualCache, /\|map\)/);
  assert.match(visualFit, /sg-synthetic-visual-page/);
  assert.match(visualFit, /"object-fit","contain"/);
  assert.match(visualFit, /EDGE_INSET=18/);
});

test("production HTML does not reintroduce retired Reader/public patch entrypoints", async () => {
  const html = (await Promise.all([read("src/index.html"), read("src/nsfw.html"), read("src/series.html"), read("src/reader.html")])).join("\n");
  for (const retired of ["site-current.css", "site-v1.9.4.css", "library-scale.css", "library-compact-alignment.css", "reader-polish.css", "reader-v1.10.1.css", "reader-zoom.css"]) {
    assert.equal(html.includes(retired), false, retired);
  }
});
