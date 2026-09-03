import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Recovery Readiness is a read-only on-demand report over existing recovery owners', async () => {
  const [app, route, service, workflow] = await Promise.all([
    read('src/assets/js/admin/app.js'),
    read('functions/admin-api/recovery-readiness.js'),
    read('functions/services/recovery-readiness.js'),
    read('src/assets/js/admin/recovery-readiness-workflow.js')
  ]);

  assert.match(app, /\/assets\/js\/admin\/recovery-readiness-workflow\.js/);
  assert.match(app, /"maintenance","recoveryReadiness","history"/);
  assert.match(route, /handleRecoveryReadinessGet/);
  assert.match(route, /onRequestGet\(context\).*handleRecoveryReadinessGet\(context\)/s);
  assert.doesNotMatch(route, /onRequestPost/);

  assert.match(service, /auditCatalogBackups/);
  assert.match(service, /inspectLiveCatalogState/);
  assert.match(service, /inspectRecoveryAnchorObjects/);
  assert.match(service, /status === "ready"/);
  assert.match(service, /"recovery-required"/);
  assert.match(service, /"check-required"/);
  assert.match(service, /"not-ready"/);
  assert.doesNotMatch(service, /saveCatalogPair|handleMaintenancePost|handleBackupPost|emergencyRestoreCatalogBackup/);

  assert.match(workflow, /registerWorkflow\("recoveryReadiness"/);
  assert.match(workflow, /client\.request\("\/admin-api\/recovery-readiness",\{method:"GET"\}\)/);
  assert.doesNotMatch(workflow, /\/admin-api\/recovery-readiness[^\n]*POST/);
  assert.match(workflow, /if\(loading\)return/);
  assert.match(workflow, /maintenance:opened/);
  assert.match(workflow, /history:changed/);
  assert.match(workflow, /trash:changed/);
  assert.match(workflow, /library:invalidate/);
  assert.match(workflow, /status==="ready".*"READY"/s);
  assert.match(workflow, /status==="recovery-required".*"RECOVER NOW"/s);
});
