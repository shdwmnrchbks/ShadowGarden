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
