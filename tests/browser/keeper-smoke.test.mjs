import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("Keeper composition root registers isolated first-class workflows", async () => {
  const app = await read("src/assets/js/admin/app.js");
  for (const owner of [
    "admin/auth-session.js",
    "admin/library-workflow.js",
    "admin/translation-workflow.js",
    "admin/maintenance-workflow.js",
    "admin/history-workflow.js",
    "admin/trash-workflow.js",
    "admin/abuse-workflow.js",
    "admin/version.js",
    "admin/shell.js"
  ]) assert.ok(app.includes(owner), owner);
  assert.match(app, /for\(const name of \["version","session","library","translations","maintenance","history","trash","abuse","shell"\]\)await keeper\.initializeWorkflow\(name\)/);
  assert.match(app, /admin-components\.css/);
  assert.match(app, /admin-presentation\.css/);
  assert.equal(app.includes("admin-current.css"), false);
});

test("Keeper unlock verifies the sole AdminClient protected status request before opening", async () => {
  const [core, session] = await Promise.all([
    read("src/assets/js/admin/core.js"),
    read("src/assets/js/admin/auth-session.js")
  ]);
  assert.match(core, /class AdminClient/);
  assert.match(core, /#authorized/);
  assert.match(core, /verifySession\(\)\{return this\.request\("\/admin-api\/status",\{method:"POST"\},\{allowLocked:true\}\)\}/);
  assert.match(session, /\/admin-access/);
  assert.match(session, /await client\.verifySession\(\)/);
  assert.match(session, /client\.markUnlocked\(\)/);
  assert.ok(session.indexOf("await client.verifySession()") < session.indexOf("showUnlocked();return"));
  assert.match(core, /closeSession\(\)/);
  assert.match(core, /method:"DELETE"/);
});

test("Keeper public entrypoint exposes only R5 composition roots directly", async () => {
  const html = await read("src/admin.html");
  assert.match(html, /admin\/core\.js/);
  assert.match(html, /admin\/app\.js/);
  for (const retiredDirect of ["admin-bootstrap.js", "admin-security.js", "admin-abuse.js", "admin-backup-history.js"]) {
    assert.equal(html.includes(retiredDirect), false, retiredDirect);
  }
});

test("R10 Keeper cutover uses semantic CSS and Upload presentation owners only", async () => {
  const [html, app, presentation] = await Promise.all([
    read("src/admin.html"),
    read("src/assets/js/admin/app.js"),
    read("src/assets/js/admin-upload-presentation.js")
  ]);
  assert.match(html, /\/assets\/css\/admin-series-editor\.css/);
  assert.match(html, /\/assets\/css\/admin-layout\.css/);
  assert.equal(html.includes("admin-series-editor-polish.css"), false);
  assert.equal(html.includes("admin-overhaul.css"), false);
  assert.match(app, /\/assets\/js\/admin-upload-presentation\.js/);
  assert.equal(app.includes("admin-upload-polish.js"), false);
  assert.match(presentation, /scheduleEditorRestore/);
  assert.match(presentation, /enhanceSeriesChooser/);
});

test("Keeper Series banner defaults to Random while explicit volume covers remain pinnable", async () => {
  const [workflow, seriesController, seriesRenderer, libraryController] = await Promise.all([
    read("src/assets/js/admin/library-workflow.js"),
    read("src/assets/js/series.js"),
    read("src/assets/js/series-renderers.js"),
    read("src/assets/js/library.js")
  ]);
  assert.match(workflow, /Random — any volume cover/);
  assert.match(workflow, /Random is the default/);
  assert.match(workflow, /bannerRandomChoice/);
  assert.match(workflow, /bannerBookId:next/);
  assert.match(workflow, /Random banner restored/);
  assert.match(seriesController, /const bannerRandom=Math\.random\(\)/);
  assert.match(seriesController, /seriesMarkup\(series,\{\.\.\.domain,bannerRandom\}\)/);
  assert.match(seriesRenderer, /selectBannerVolume\(series, identity, bannerRandom\)/);
  assert.match(seriesRenderer, /identity\?\.isBookId\?\.\(selected\)/);
  assert.match(libraryController, /const suggestionRandom=Math\.random\(\)/);
  assert.match(libraryController, /readingStatus\.libraryBannerEntry\(state\.items,suggestionRandom\)/);
});
