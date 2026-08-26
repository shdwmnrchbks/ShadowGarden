import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("all entrypoints ship canonical deterministic first-paint shells before deferred hydration", async () => {
  const [main, adult, series, reader, admin, lost, adminApp] = await Promise.all([
    read("src/index.html"),
    read("src/nsfw.html"),
    read("src/series.html"),
    read("src/reader.html"),
    read("src/admin.html"),
    read("src/404.html"),
    read("src/assets/js/admin/app.js")
  ]);

  assert.match(main, /A moonlit archive of stories, cultivated beneath quiet shadows\./);
  assert.doesNotMatch(main, /A quiet archive of EPUBs, arranged beneath the shadows\./);
  assert.match(main, /id="translatorSelect"/);
  assert.match(main, /id="genreSelect"/);
  assert.match(main, /id="readingStatusChips"/);
  assert.match(main, /Follow any thread—title, author, tag, or volume\./);

  assert.match(adult, /class="adult-library adult-locked"/);
  assert.match(adult, /id="adultGate" class="adult-gate"/);
  assert.match(adult, /sg-adult-acknowledged/);
  assert.match(adult, /A secluded wing for mature works, sheltered beyond the main Garden\./);
  assert.match(adult, /id="translatorSelect"/);
  assert.match(adult, /id="genreSelect"/);
  assert.match(adult, /id="readingStatusChips"/);
  assert.doesNotMatch(adult, /A separate shelf for NSFW and adult EPUBs, kept out of the main archive\./);

  assert.match(series, /Preparing this series and its volumes…/);
  assert.match(series, /window\.__SG_SERIES_ROUTE_ADULT__=adult/);

  assert.match(reader, /Opening the volume…/);
  assert.match(reader, /Authorizing the book…/);
  assert.match(reader, /This volume rests complete\. Another path waits beyond its final page\./);
  assert.doesNotMatch(reader, /Opening EPUB…|Opening the book…/);

  for (const stylesheet of [
    "motion.css",
    "admin-components.css",
    "admin-version.css",
    "admin-presentation.css",
    "admin-motion.css"
  ]) assert.match(admin, new RegExp(`href="/assets/css/${stylesheet.replace(".", "\\.")}"`));
  assert.match(admin, /KEEPER'S GATE/);
  assert.match(admin, /Open the Keeper's Gate/);
  assert.match(admin, /placeholder="Keeper token"/);
  assert.match(admin, /Tend the Garden/);
  assert.match(admin, /Walking the rows…/);
  assert.doesNotMatch(admin, /PRIVATE STORAGE CONSOLE|Unlock the Garden|Manage Library|Loading the Garden…|Choose EPUBs from phone/);
  assert.doesNotMatch(adminApp, /loadStyle|createElement\(["']link["']\)/);

  assert.match(lost, /404 · LOST PATH/);
  assert.match(lost, /The path fades into shadow\./);
  assert.match(lost, /No shelf, gate, or footpath answers this address\./);
});

test("Garden Keeper presentation styles are document-owned rather than appended after paint", async () => {
  const [admin, adminApp] = await Promise.all([
    read("src/admin.html"),
    read("src/assets/js/admin/app.js")
  ]);

  const firstScript = admin.indexOf('<script src="/assets/vendor/jszip.min.js"');
  assert.ok(firstScript > 0, "Keeper bootstrap script should remain present");
  for (const stylesheet of [
    "/assets/css/motion.css",
    "/assets/css/admin-components.css",
    "/assets/css/admin-version.css",
    "/assets/css/admin-presentation.css",
    "/assets/css/admin-motion.css"
  ]) {
    const offset = admin.indexOf(`href="${stylesheet}"`);
    assert.ok(offset > 0 && offset < firstScript, `${stylesheet} must load before Keeper bootstrap scripts`);
  }
  assert.doesNotMatch(adminApp, /appendChild\(link\)|loadStyle/);
});
