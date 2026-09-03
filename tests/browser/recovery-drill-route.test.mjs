import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('recovery route exposes the service-owned emergency restore contract', async () => {
  const [route, service] = await Promise.all([
    read('functions/admin-api/recovery.js'),
    read('functions/services/recovery.js')
  ]);

  assert.match(route, /handleRecoveryGet, handleRecoveryPost/);
  assert.match(route, /onRequestPost\(context\).*handleRecoveryPost\(context\)/s);
  assert.match(service, /action !== "restore-known-good"/);
  assert.match(service, /status: "current-readable"/);
  assert.match(service, /normal Maintenance restore/);
  assert.match(service, /status: "backup-unrecoverable"/);
  assert.match(service, /preRestoreSnapshot: "skipped-unrecoverable-current-state"/);
  assert.match(service, /await invalidateCatalogCache\(request\)/);
});

test('backup deletion remains catalog-owned behind an object-complete recovery-anchor guard', async () => {
  const [route, service] = await Promise.all([
    read('functions/admin-api/backup.js'),
    read('functions/services/recovery.js')
  ]);

  assert.match(route, /handleGuardedBackupPost/);
  assert.match(route, /onRequestPost\(context\).*handleGuardedBackupPost\(context\)/s);
  assert.match(service, /inspectRecoveryAnchorObjects/);
  assert.match(service, /await headObject\(aws, key\)/);
  assert.match(service, /status: "missing-media"/);
  assert.match(service, /remainingRecoveryAnchors/);
  assert.match(service, /status: "last-recoverable-backup"/);
  assert.match(service, /status: "recovery-audit-uncertain"/);
  assert.match(service, /if \(!guard\.allowed\).*409/s);
  assert.match(service, /return handleBackupPost\(\{ request, env \}\)/);
});

test('Trash purge remains catalog-owned behind object-complete recovery-anchor media checks', async () => {
  const [route, service] = await Promise.all([
    read('functions/admin-api/maintenance.js'),
    read('functions/services/recovery.js')
  ]);

  assert.match(route, /handleMaintenanceGet/);
  assert.match(route, /handleGuardedMaintenancePost/);
  assert.match(route, /onRequestPost\(context\).*handleGuardedMaintenancePost\(context\)/s);
  assert.match(service, /status: "live-catalog-recovery-required"/);
  assert.match(service, /firstCompleteRecoveryAnchor/);
  assert.match(service, /status: "recovery-anchor-check-uncertain"/);
  assert.match(service, /status: "no-recoverable-backup"/);
  assert.match(service, /status: "purge-would-break-recovery-anchor"/);
  assert.match(service, /current object-complete recovery anchor/);
  assert.match(service, /if \(!guard\.allowed\).*409/s);
  assert.match(service, /return handleMaintenancePost\(\{ request, env \}\)/);
});
