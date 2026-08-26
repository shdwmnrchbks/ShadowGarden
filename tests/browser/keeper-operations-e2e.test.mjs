import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('v2.6 Keeper operational workflows retain canonical owners and single-submit guards', async () => {
  const [spec, maintenance, history, trash, abuse, core] = await Promise.all([
    read('tests/e2e/specs/keeper-operations.spec.mjs'),
    read('src/assets/js/admin/maintenance-workflow.js'),
    read('src/assets/js/admin/history-workflow.js'),
    read('src/assets/js/admin/trash-workflow.js'),
    read('src/assets/js/admin/abuse-workflow.js'),
    read('src/assets/js/admin/core.js')
  ]);

  for (const marker of [
    'Garden Keeper Maintenance, History, Trash, and Abuse Watch remain single-submit while busy',
    'Abuse Watch exposes a failed load and recovers cleanly on refresh',
    'state.deepCheckCount',
    'state.createBackupCount',
    'state.restoreBackupCount',
    'state.restoreTrashCount',
    'state.purgeTrashCount',
    'state.releaseAbuseCount',
    'button.click(); button.click();',
    "entry.headers.authorization === 'Bearer e2e-keeper-token'",
    'const diagnosticPath = entry =>',
    "new URL(entry.sourceUrl).pathname",
    "diagnosticPath(entry).endsWith('/assets/js/admin/abuse-workflow.js')",
    "diagnosticPath(entry) === '/admin-api/abuse'"
  ]) assert.ok(spec.includes(marker), marker);

  assert.match(maintenance, /deepChecking\|\|!snapshot/, 'Maintenance deep checks must retain their in-flight guard');
  assert.match(maintenance, /button\.disabled=true;button\.textContent="Checking B2…"/, 'Maintenance must visibly own its busy state');
  assert.match(maintenance, /finally\{deepChecking=false;button\.disabled=false/, 'Maintenance deep-check controls must recover in finally');

  assert.match(history, /const restoring=new Set\(\),removing=new Set\(\)/, 'History restore/delete mutations must have per-entry in-flight guards');
  assert.match(history, /if\(!id\|\|restoring\.has\(id\)\|\|removing\.has\(id\)\)return/, 'History restore must reject re-entry');
  assert.match(history, /creating=true;button\.disabled=true;button\.textContent="Creating backup…"/, 'History create must establish busy state before awaiting');
  assert.match(history, /finally\{creating=false;button\.disabled=false/, 'History create controls must recover in finally');

  assert.match(trash, /const restoring=new Set\(\),purging=new Set\(\)/, 'Trash restore/purge mutations must have per-entry in-flight guards');
  assert.match(trash, /purgeAllRunning\|\|restoring\.has\(id\)\|\|purging\.has\(id\)/, 'Trash restore must reject conflicting work');
  assert.match(trash, /if\(all\)purgeAllRunning=true;else ids\.forEach\(id=>purging\.add\(id\)\)/, 'Trash purge must claim ownership before awaiting');
  assert.match(trash, /finally\{purgeAllRunning=false;ids\?\.forEach\(id=>purging\.delete\(id\)\)/, 'Trash purge state must always recover');

  assert.match(abuse, /const releasing=new Set\(\)/, 'Abuse Watch release mutations must have per-client in-flight guards');
  assert.match(abuse, /if\(!clientId\|\|releasing\.has\(clientId\)/, 'Abuse Watch must reject duplicate releases');
  assert.match(abuse, /releasing\.add\(clientId\);if\(snapshot\)render\(snapshot\)/, 'Abuse Watch must expose the release busy state before awaiting');
  assert.match(abuse, /finally\{releasing\.delete\(clientId\);if\(snapshot\)render\(snapshot\)\}/, 'Abuse Watch controls must recover after success or failure');

  assert.match(core, /class AdminClient/, 'all Keeper operation requests must remain under the single AdminClient');
  assert.match(core, /if\(String\(path\)\.startsWith\("\/admin-api\/"\)\)headers\.set\("authorization"/, 'AdminClient must continue to own bearer authorization');
});
