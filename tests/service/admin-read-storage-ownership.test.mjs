import test from 'node:test';
import assert from 'node:assert/strict';

import { adminSessionCookie, issueAdminSession } from '../../functions/_lib/admin-session.js';
import {
  handleLibraryGet,
  handleMaintenanceGet,
  handleSeriesBannerGet
} from '../../functions/services/catalog.js';
import { handleRecoveryGet } from '../../functions/services/recovery.js';
import { B2_BUCKET, putObject, writeClient } from '../../functions/services/storage.js';

const env = {
  SG_ADMIN_TOKEN: 'fixture-admin-token',
  SG_MEDIA_SIGNING_SECRET: 'shadow-garden-v2-11e-admin-read-secret-0123456789abcdef',
  B2_READ_KEY_ID: 'fixture-read-key',
  B2_READ_APPLICATION_KEY: 'fixture-read-secret'
};

const mainCatalog = {
  generatedAt: '2026-09-05T00:00:00.000Z',
  series: [{
    id: 'fixture-series',
    title: 'Fixture Series',
    author: 'Fixture Author',
    volumes: [{
      number: 1,
      title: 'Volume 1',
      file: '/media/shadow-garden/books/fixture-volume.epub'
    }]
  }]
};
const adultCatalog = { generatedAt: '2026-09-05T00:00:00.000Z', series: [] };
const trash = { version: 1, updatedAt: '2026-09-05T00:00:00.000Z', items: [] };
const backupIndex = { version: 1, updatedAt: '2026-09-05T00:00:00.000Z', backups: [] };

async function authorizedRequest(path) {
  const session = await issueAdminSession(env);
  return new Request(`https://shadowgarden-bon.pages.dev${path}`, {
    headers: {
      authorization: `Bearer ${env.SG_ADMIN_TOKEN}`,
      cookie: adminSessionCookie(session)
    }
  });
}

function b2Key(url) {
  const path = new URL(url).pathname;
  const prefix = `/${B2_BUCKET}/`;
  assert.ok(path.startsWith(prefix), `unexpected storage URL: ${url}`);
  return path.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
}

function fixtureFor(key) {
  if (key === 'shadow-garden/data/catalog.json') return mainCatalog;
  if (key === 'shadow-garden/data/adult-catalog.json') return adultCatalog;
  if (key === 'shadow-garden/data/trash.json') return trash;
  if (key === 'shadow-garden/backups/catalog-index.json') return backupIndex;
  return null;
}

test('v2.11E audit: read-only Keeper storage uses read credentials and never falls back for writes', async () => {
  const originalFetch = globalThis.fetch;
  const storageCalls = [];
  globalThis.fetch = async input => {
    const request = input instanceof Request ? input : new Request(input);
    const key = b2Key(request.url), method = request.method.toUpperCase();
    storageCalls.push({ key, method, authorization: request.headers.get('authorization') || '' });
    assert.ok(['GET', 'HEAD'].includes(method), `unexpected storage mutation: ${method} ${key}`);
    assert.match(request.headers.get('authorization') || '', /Credential=fixture-read-key\//);
    const value = fixtureFor(key);
    if (value === null) return new Response('', { status: 404 });
    return new Response(method === 'HEAD' ? null : JSON.stringify(value), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  };

  try {
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
      results.push({ name, status: response.status, ok: payload.ok !== false });
    }

    const callsBeforeWrite = storageCalls.length;
    await assert.rejects(
      () => putObject(writeClient(env), 'shadow-garden/data/write-denied.json', '{}'),
      /B2 write credentials are not configured/i
    );
    assert.equal(storageCalls.length, callsBeforeWrite, 'missing write credentials must fail before any storage request');

    console.log('FUNCTIONS_V2_11E_READ_CLIENT_AUDIT', JSON.stringify({ results, storageCalls }));

    assert.deepEqual(results.map(result => result.status), [200, 200, 200, 200]);
    assert.ok(results.every(result => result.ok));
    assert.ok(storageCalls.length > 0);
    assert.ok(storageCalls.every(call => call.authorization.includes('Credential=fixture-read-key/')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
