import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAIN_KEY,
  saveCatalogPair,
  seriesObjectKeys,
  snapshotCatalogs
} from '../../functions/services/catalog.js';
import { buildRecoveryReadinessReport } from '../../functions/services/recovery-readiness.js';
import { BACKUP_SHA256_HEADER, B2_BUCKET, putObject } from '../../functions/services/storage.js';

class MemoryAws {
  constructor() { this.objects = new Map(); this.failHead = new Set(); }
  keyFor(url) {
    const path = new URL(url).pathname, prefix = `/${B2_BUCKET}/`;
    assert.ok(path.startsWith(prefix), `unexpected storage URL: ${url}`);
    return path.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
  }
  async fetch(url, init = {}) {
    const key = this.keyFor(url), method = String(init.method || 'GET').toUpperCase();
    if (method === 'PUT') {
      const body = typeof init.body === 'string' ? init.body : await new Response(init.body).text();
      this.objects.set(key, { body, headers: new Headers(init.headers || {}) });
      return new Response('', { status: 200 });
    }
    if (method === 'GET') {
      const entry = this.objects.get(key);if (!entry) return new Response('', { status: 404 });
      return new Response(entry.body, { status: 200, headers: entry.headers });
    }
    if (method === 'HEAD') {
      if (this.failHead.has(key)) throw new Error(`fixture HEAD failure for ${key}`);
      const entry = this.objects.get(key);if (!entry) return new Response('', { status: 404 });
      return new Response(null, { status: 200, headers: entry.headers });
    }
    if (method === 'DELETE') { this.objects.delete(key); return new Response('', { status: 204 }); }
    return new Response('', { status: 405 });
  }
}

const catalog = id => ({
  generatedAt: '2026-09-03T00:00:00.000Z',
  series: id ? [{ id, title: id, volumes: [{ number: 1, title: 'Volume 1', file: `/media/shadow-garden/books/${id}.epub` }] }] : []
});
const emptyCatalog = () => catalog('');

async function seedMedia(aws, value) {
  for (const series of value.series || []) for (const key of seriesObjectKeys(series)) await putObject(aws, key, `fixture:${key}`);
}
function firstMediaKey(value) {
  for (const series of value.series || []) for (const key of seriesObjectKeys(series)) return key;
  return '';
}

test('readiness is READY only with readable live catalogs and a verified object-complete anchor', async () => {
  const aws = new MemoryAws(), main = catalog('ready-series'), adult = emptyCatalog();
  await seedMedia(aws, main);await saveCatalogPair(aws, main, adult);
  const snapshot = await snapshotCatalogs(aws, main, adult, 'ready-anchor');

  const report = await buildRecoveryReadinessReport(aws);
  assert.equal(report.readiness.status, 'ready');
  assert.equal(report.readiness.ready, true);
  assert.equal(report.live.readable, true);
  assert.equal(report.readiness.anchor.id, snapshot.id);
  assert.equal(report.readiness.anchor.verified, true);
  assert.ok(report.readiness.anchor.objectCount >= 1);
  assert.equal(report.readiness.staleSnapshots, 0);
  assert.equal(report.readiness.uncertainSnapshots, 0);
});

test('object-complete legacy snapshot is useful recovery material but does not report READY', async () => {
  const aws = new MemoryAws(), main = catalog('legacy-series'), adult = emptyCatalog();
  await seedMedia(aws, main);await saveCatalogPair(aws, main, adult);
  const snapshot = await snapshotCatalogs(aws, main, adult, 'legacy-anchor');
  const stored = aws.objects.get(snapshot.key);
  assert.ok(stored, 'fixture snapshot must exist');
  stored.headers.delete(BACKUP_SHA256_HEADER);

  const report = await buildRecoveryReadinessReport(aws);
  assert.equal(report.live.readable, true);
  assert.equal(report.readiness.status, 'not-ready');
  assert.equal(report.readiness.ready, false);
  assert.equal(report.readiness.anchor.id, snapshot.id);
  assert.equal(report.readiness.anchor.status, 'legacy-unverified');
  assert.equal(report.readiness.anchor.verified, false);
  assert.ok(report.readiness.anchor.objectCount >= 1);
  assert.match(report.readiness.detail, /legacy snapshot/i);
  assert.match(report.readiness.detail, /not checksum-verified/i);
});

test('readable snapshot JSON with missing media reports NOT READY rather than a false anchor', async () => {
  const aws = new MemoryAws(), main = catalog('stale-series'), adult = emptyCatalog();
  await saveCatalogPair(aws, emptyCatalog(), adult);
  await snapshotCatalogs(aws, main, adult, 'stale-anchor');

  const report = await buildRecoveryReadinessReport(aws);
  assert.equal(report.live.readable, true);
  assert.equal(report.readiness.status, 'not-ready');
  assert.equal(report.readiness.ready, false);
  assert.equal(report.readiness.anchor, null);
  assert.equal(report.readiness.staleSnapshots, 1);
  assert.match(report.readiness.detail, /No object-complete recovery anchor/i);
});

test('media verification uncertainty reports CHECK instead of READY or NOT READY', async () => {
  const aws = new MemoryAws(), main = catalog('uncertain-series'), adult = emptyCatalog();
  await seedMedia(aws, main);await saveCatalogPair(aws, emptyCatalog(), adult);
  await snapshotCatalogs(aws, main, adult, 'uncertain-anchor');
  aws.failHead.add(firstMediaKey(main));

  const report = await buildRecoveryReadinessReport(aws);
  assert.equal(report.readiness.status, 'check-required');
  assert.equal(report.readiness.ready, false);
  assert.equal(report.readiness.anchor, null);
  assert.equal(report.readiness.uncertainSnapshots, 1);
  assert.match(report.readiness.detail, /verification was uncertain/i);
});

test('damaged live catalog reports RECOVERY REQUIRED even when a complete anchor exists', async () => {
  const aws = new MemoryAws(), main = catalog('recoverable-series'), adult = emptyCatalog();
  await seedMedia(aws, main);await saveCatalogPair(aws, main, adult);
  const snapshot = await snapshotCatalogs(aws, main, adult, 'known-good');
  aws.objects.delete(MAIN_KEY);

  const report = await buildRecoveryReadinessReport(aws);
  assert.equal(report.readiness.status, 'recovery-required');
  assert.equal(report.readiness.ready, false);
  assert.equal(report.live.readable, false);
  assert.equal(report.live.entries.find(entry => entry.scope === 'main')?.status, 'missing');
  assert.equal(report.readiness.anchor.id, snapshot.id);
  assert.match(report.readiness.detail, /requires recovery/i);
});
