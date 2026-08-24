import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("Keeper composition root registers isolated first-class workflows", async () => {
  const app = await read("src/assets/js/admin/app.js");
  for (const owner of [
    "admin/auth-session.js",
    "admin/library-workflow.js",
    "admin/maintenance-workflow.js",
    "admin/history-workflow.js",
    "admin/trash-workflow.js",
    "admin/abuse-workflow.js",
    "admin/version.js",
    "admin/shell.js"
  ]) assert.ok(app.includes(owner), owner);
  for (const workflow of ["version", "session", "library", "maintenance", "history", "trash", "abuse", "shell"]) {
    assert.ok(app.includes(`initializeWorkflow(name)`) || app.includes(`initializeWorkflow("${workflow}")`));
  }
  assert.match(app, /admin-components\.css/);
  assert.match(app, /admin-presentation\.css/);
  assert.equal(app.includes("admin-current.css"), false);
});

test("Keeper unlock verifies a protected API request before opening the client", async () => {
  const [core, session] = await Promise.all([
    read("src/assets/js/admin/core.js"),
    read("src/assets/js/admin/auth-session.js")
  ]);
  assert.match(core, /class AdminClient/);
  assert.match(core, /#authorized/);
  assert.match(session, /\/admin-access/);
  assert.match(session, /\/admin-api\/status/);
  assert.match(session, /setAuthorized|authorize|authorized/i);
  assert.match(session, /DELETE/);
});

test("Keeper public entrypoint exposes only R5 composition roots directly", async () => {
  const html = await read("src/admin.html");
  assert.match(html, /admin\/core\.js/);
  assert.match(html, /admin\/app\.js/);
  for (const retiredDirect of ["admin-bootstrap.js", "admin-security.js", "admin-abuse.js", "admin-backup-history.js"]) {
    assert.equal(html.includes(retiredDirect), false, retiredDirect);
  }
});
