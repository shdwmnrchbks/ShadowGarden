import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('v2.9 Keeper operational workflows retain canonical owners and serialize long maintenance work', async () => {
  const [spec, queueSpec, maintenance, history, trash, abuse, core] = await Promise.all([
    read('tests/e2e/specs/keeper-operations.spec.mjs'),
    read('tests/e2e/specs/keeper-maintenance-operation-queue.spec.mjs'),
    read('src/assets/js/admin/maintenance-workflow.js'),
    read('src/assets/js/admin/history-workflow.js'),
    read('src/assets/js/admin/trash-workflow.js'),
    read('src/assets/js/admin/abuse-workflow.js'),
    read('src/assets/js/admin/core.js')
  ]);

  for (const marker of [
    'Garden Keeper Maintenance, History, Trash, and Abuse Watch remain single-submit while busy',
    'Abuse Watch exposes a failed load and recovers cleanly on refresh',
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

  for (const marker of [
    'long Keeper maintenance work is explicit, removable while queued, and serialized in one tab',
    "Reloading this page does not create background jobs.",
    "state.order.slice(0, 3)).toEqual(['deep-start', 'deep-end', 'taxonomy-start'])",
    'expect(state.maxConcurrent).toBe(1)',
    "[data-remove-maintenance-operation]",
    "state.order).toEqual(['deep-start', 'deep-end', 'taxonomy-start', 'taxonomy-end'])"
  ]) assert.ok(queueSpec.includes(marker), marker);

  assert.match(maintenance, /const operationQueue=\[\],operationHistory=\[\]/, 'Maintenance must own one tab-local long-operation queue');
  assert.match(maintenance, /if\(operationState\(kind\)\)return false/, 'Maintenance must reject duplicate queued or running work of the same kind');
  assert.match(maintenance, /if\(activeOperation\|\|!operationQueue\.length\)return/, 'Maintenance must never drain a second long operation while one is active');
  assert.match(maintenance, /const operation=operationQueue\.shift\(\);activeOperation=operation;operation\.status="running"/, 'Maintenance must claim the next queued operation before awaiting it');
  assert.match(maintenance, /finally\{delete operation\.run;operationHistory\.unshift\(operation\);operationHistory\.splice\(4\);activeOperation=null;/, 'Maintenance must release the active slot only in finalization');
  assert.match(maintenance, /enqueueOperation\("deep","Deep B2 check"/, 'Deep B2 checks must use the maintenance queue');
  assert.match(maintenance, /enqueueOperation\("taxonomy",`Normalize taxonomy for \$\{count\} series`/, 'Taxonomy normalization must use the maintenance queue');
  assert.match(maintenance, /enqueueOperation\("covers",`Optimize \$\{candidates\.length\} legacy cover/, 'Legacy-cover optimization must use the maintenance queue');
  assert.match(maintenance, /data-remove-maintenance-operation/, 'Queued work must expose an explicit pre-start removal action');
  assert.match(maintenance, /session:locked",\(\)=>\{invalidate\(\);clearQueuedOperations\(\)\}/, 'Locking Keeper must discard work that has not started');
  assert.match(maintenance, /Reloading this page does not create background jobs/, 'Maintenance must state that the queue is tab-local rather than a background-job system');

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
