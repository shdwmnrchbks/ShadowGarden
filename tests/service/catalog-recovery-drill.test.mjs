import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADULT_KEY,
  MAIN_KEY,
  loadCatalogPair,
  saveCatalogPair,
  snapshotCatalogs
} from '../../functions/services/catalog.js';
import {
  emergencyRestoreCatalogBackup,
  inspectLiveCatalogState
} from '../../functions/services/recovery.js';
import { B2_BUCKET } from '../../functions/services/storage.js';

class MemoryAws {
  constructor() { this.objects = new Map(); }

  keyFor(url) {
    const path = new URL(url).pathname;
    const prefix = `/${B2_BUCKET}/`;
    assert.ok(path.startsWith(prefix), `unexpected storage URL: ${url}`);
    return path.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
  }

  rawPut(key, body, headers = {}) {
    this.objects.set(key, { body: String(body), headers: new Headers(headers) });
  }

  async fetch(url, init = {}) {
    const key = this.keyFor(url), method = String(init.method || 'GET').toUpperCase();
    if (method === 'PUT') {
      const body = typeof init.body === 'string' ? init.body : await new Response(init.body).text();
      this.objects.set(key, { body, headers: new Headers(init.headers || {}) });
      return new Response('', { status: 200 });
    }
    if (method === 'GET') {
      const entry = this.objects.get(key);
      if (!entry) return new Response('', { status: 404 });
      return new Response(entry.body, { status: 200, headers: entry.headers });
    }
    if (method === 'HEAD') {
      const entry = this.objects.get(key);
      if (!entry) return new Response('', { status: 404 });
      return new Response(null, { status: 200, headers: entry.headers });
    }
    if (method === 'DELETE') {
      this.objects.delete(key);
      return new Response('', { status: 204 });
    }
    return new Response('', { status: 405 });
  }
}

const mainCatalog = () => ({
  generatedAt: '2026-09-03T00:00:00.000Z',
  series: [{
    id: 'recovery-drill-main',
    title: 'Recovery Drill Main',
    volumes: [{ number: 1, title: 'Volume 1', file: '/media/shadow-garden/books/recovery-main.epub' }]
  }]
});

const adultCatalog = () => ({
  generatedAt: '2026-09-03T00:00:00.000Z',
  series: [{
    id: 'adult-recovery-drill',
    title: 'Recovery Drill Adult',
    nsfw: true,
    volumes: [{ number: 1, title: 'Volume 1', file: '/media/shadow-garden/books/recovery-adult.epub' }]
  }]
});

async function knownGoodFixture() {
  const aws = new MemoryAws(), main = mainCatalog(), adult = adultCatalog();
  await saveCatalogPair(aws, main, adult);
  const backup = await snapshotCatalogs(aws, main, adult, 'recovery-drill-known-good');
  return { aws, backup };
}

function assertRestoredCatalogs(data) {
  assert.deepEqual(data.main.series.map(series => series.id), ['recovery-drill-main']);
  assert.deepEqual(data.adult.series.map(series => series.id), ['adult-recovery-drill']);
}

test('recovery drill restores a known-good snapshot after damaged live catalog JSON', async () => {
  const { aws, backup } = await knownGoodFixture();
  aws.rawPut(MAIN_KEY, '{damaged-json');

  const before = await inspectLiveCatalogState(aws);
  assert.equal(before.status, 'recovery-required');
  assert.equal(before.entries.find(entry => entry.scope === 'main')?.status, 'invalid-json');
  assert.equal(before.entries.find(entry => entry.scope === 'adult')?.status, 'readable');

  const result = await emergencyRestoreCatalogBackup(aws, backup.id);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'restored');
  assert.equal(result.restoredBackup, backup.id);
  assert.equal(result.backup.status, 'verified');
  assert.equal(result.backup.verified, true);
  assert.equal(result.preRestoreSnapshot, 'skipped-unrecoverable-current-state');
  assert.equal(result.currentAfter.status, 'readable');
  assertRestoredCatalogs(await loadCatalogPair(aws));
});

test('recovery drill restores a known-good snapshot after live catalog objects are missing', async () => {
  const { aws, backup } = await knownGoodFixture();
  aws.objects.delete(MAIN_KEY);
  aws.objects.delete(ADULT_KEY);

  const before = await inspectLiveCatalogState(aws);
  assert.equal(before.status, 'recovery-required');
  assert.deepEqual(before.entries.map(entry => entry.status), ['missing', 'missing']);

  const result = await emergencyRestoreCatalogBackup(aws, backup.id);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'restored');
  assert.equal(result.currentAfter.status, 'readable');
  assertRestoredCatalogs(await loadCatalogPair(aws));
});

test('emergency recovery refuses healthy live catalogs so normal restore keeps its pre-restore snapshot contract', async () => {
  const { aws, backup } = await knownGoodFixture();
  const beforeMain = aws.objects.get(MAIN_KEY)?.body;

  const result = await emergencyRestoreCatalogBackup(aws, backup.id);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'current-readable');
  assert.match(result.detail, /normal Maintenance restore/i);
  assert.equal(aws.objects.get(MAIN_KEY)?.body, beforeMain);
});

test('emergency recovery refuses a tampered snapshot and leaves damaged live state untouched', async () => {
  const { aws, backup } = await knownGoodFixture();
  aws.rawPut(MAIN_KEY, '{damaged-json');
  const storedBackup = aws.objects.get(backup.key);
  assert.ok(storedBackup, 'known-good snapshot must exist before tampering');
  storedBackup.body = storedBackup.body.replace('Recovery Drill Main', 'Tampered Recovery Main');

  const result = await emergencyRestoreCatalogBackup(aws, backup.id);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'backup-unrecoverable');
  assert.equal(result.backup.status, 'checksum-mismatch');
  assert.equal(aws.objects.get(MAIN_KEY)?.body, '{damaged-json');
});
