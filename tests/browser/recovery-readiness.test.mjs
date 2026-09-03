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
  assert.match(service, /legacyAnchor/);
  assert.match(service, /if \(candidate\.verified\) \{ anchor = candidate; break; \}/);
  assert.match(service, /if \(!anchor\) anchor = legacyAnchor/);
  assert.match(service, /anchor\?\.verified/);
  assert.match(service, /checksum-verified, object-complete recovery anchor/);
  assert.match(service, /object-complete legacy snapshot/);
  assert.match(service, /buildRecoveryReadinessReport\(readClient\(env\)\)/);
  assert.doesNotMatch(service, /writeClient/);
  assert.match(service, /status === "ready"/);
  assert.match(service, /"recovery-required"/);
  assert.match(service, /"check-required"/);
  assert.match(service, /"not-ready"/);
  assert.doesNotMatch(service, /saveCatalogPair|handleMaintenancePost|handleBackupPost|emergencyRestoreCatalogBackup/);

  assert.match(workflow, /registerWorkflow\("recoveryReadiness"/);
  assert.match(workflow, /client\.request\("\/admin-api\/recovery-readiness",\{method:"GET"\}\)/);
  assert.doesNotMatch(workflow, /\/admin-api\/recovery-readiness[^\n]*POST/);
  assert.match(workflow, /if\(loading\)return/);
  assert.match(workflow, /checkSequence/);
  assert.match(workflow, /if\(sequence!==checkSequence\)return/);
  assert.match(workflow, /function invalidate\(\)\{checkSequence\+=1;loading=false;report=null;idle\(\)\}/);
  assert.match(workflow, /maintenance:opened/);
  assert.match(workflow, /history:changed/);
  assert.match(workflow, /trash:changed/);
  assert.match(workflow, /library:invalidate/);
  assert.match(workflow, /session:locked/);
  assert.match(workflow, /checksum-verified, object-complete retained snapshot/);
  assert.match(workflow, /verified\?"AVAILABLE":"LEGACY"/);
  assert.match(workflow, /status==="ready".*"READY"/s);
  assert.match(workflow, /status==="recovery-required".*"RECOVER NOW"/s);
});
