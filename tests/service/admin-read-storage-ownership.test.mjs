import test from 'node:test';
import assert from 'node:assert/strict';

import { adminSessionCookie, issueAdminSession } from '../../functions/_lib/admin-session.js';
import {
  handleLibraryGet,
  handleMaintenanceGet,
  handleSeriesBannerGet
} from '../../functions/services/catalog.js';
import { handleRecoveryGet } from '../../functions/services/recovery.js';

const env = {
  SG_ADMIN_TOKEN: 'fixture-admin-token',
  SG_MEDIA_SIGNING_SECRET: 'shadow-garden-v2-11e-admin-read-secret-0123456789abcdef',
  B2_READ_KEY_ID: 'fixture-read-key',
  B2_READ_APPLICATION_KEY: 'fixture-read-secret'
};

async function authorizedRequest(path) {
  const session = await issueAdminSession(env);
  return new Request(`https://shadowgarden-bon.pages.dev${path}`, {
    headers: {
      authorization: `Bearer ${env.SG_ADMIN_TOKEN}`,
      cookie: adminSessionCookie(session)
    }
  });
}

test('v2.11E audit: read-only Keeper catalog endpoints expose their storage credential dependency', async () => {
  const results = [];
  for (const [name, handler, path] of [
    ['library', handleLibraryGet, '/admin-api/library'],
    ['series-banner', handleSeriesBannerGet, '/admin-api/series-banner?id=fixture-series'],
    ['maintenance', handleMaintenanceGet, '/admin-api/maintenance'],
    ['recovery', handleRecoveryGet, '/admin-api/recovery']
  ]) {
    const request = await authorizedRequest(path);
    const response = await handler({ request, env });
    const payload = await response.json();
    results.push({ name, status: response.status, detail: String(payload.detail || '') });
  }

  console.log('FUNCTIONS_V2_11E_READ_CLIENT_AUDIT', JSON.stringify(results));

  assert.deepEqual(results.map(result => result.status), [502, 502, 502, 502]);
  assert.ok(results.every(result => /write credentials are not configured/i.test(result.detail)));
});
