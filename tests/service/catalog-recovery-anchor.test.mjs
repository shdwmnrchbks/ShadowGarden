import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seriesObjectKeys,
  snapshotCatalogs
} from '../../functions/services/catalog.js';
import { catalogBackupDeletionGuard } from '../../functions/services/recovery.js';
import { B2_BUCKET, putObject } from '../../functions/services/storage.js';

class MemoryAws {
  constructor() { this.objects = new Map(); this.failGet = new Set(); }

  keyFor(url) {
    const path = new URL(url).pathname;
    const prefix = `/${B2_BUCKET}/`;
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
      if (this.failGet.has(key)) throw new Error(`fixture GET failure for ${key}`);
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

const catalog = id => ({
  generatedAt: '2026-09-03T00:00:00.000Z',
  series: [{ id, title: id, volumes: [{ number: 1, title: 'Volume 1', file: `/media/shadow-garden/books/${id}.epub` }] }]
});
const emptyCatalog = () => ({ generatedAt: '2026-09-03T00:00:00.000Z', series: [] });

async function seedCatalogMedia(aws, value) {
  for (const series of value.series || []) for (const key of seriesObjectKeys(series)) await putObject(aws, key, `fixture:${key}`);
}

function firstMediaKey(value) {
  for (const series of value.series || []) for (const key of seriesObjectKeys(series)) return key;
  return '';
}

test('manual deletion is blocked for the last object-complete recoverable snapshot', async () => {
  const aws = new MemoryAws(), onlyCatalog = catalog('only-anchor');
  await seedCatalogMedia(aws, onlyCatalog);
  const only = await snapshotCatalogs(aws, onlyCatalog, emptyCatalog(), 'only-anchor');

  const guard = await catalogBackupDeletionGuard(aws, only.id);
  assert.equal(guard.allowed, false);
  assert.equal(guard.status, 'last-recoverable-backup');
  assert.equal(guard.targetStatus, 'verified');
  assert.equal(guard.targetAvailability, 'complete');
  assert.equal(guard.recoverableBefore, 1);
  assert.equal(guard.remainingRecoverable, 0);
  assert.equal(guard.remainingRecoveryAnchors, 0);
  assert.match(guard.detail, /last object-complete recoverable/i);
});

test('manual deletion is allowed when another object-complete recovery anchor remains', async () => {
  const aws = new MemoryAws(), firstCatalog = catalog('first-anchor'), secondCatalog = catalog('second-anchor');
  await seedCatalogMedia(aws, firstCatalog);
  await seedCatalogMedia(aws, secondCatalog);
  const first = await snapshotCatalogs(aws, firstCatalog, emptyCatalog(), 'first-anchor');
  const second = await snapshotCatalogs(aws, secondCatalog, emptyCatalog(), 'second-anchor');

  const guard = await catalogBackupDeletionGuard(aws, second.id);
  assert.equal(guard.allowed, true);
  assert.equal(guard.status, 'safe-to-delete');
  assert.equal(guard.targetStatus, 'verified');
  assert.equal(guard.recoverableBefore, 2);
  assert.equal(guard.remainingRecoverable, 1);
  assert.equal(guard.remainingRecoveryAnchors, 1);
  assert.equal(guard.recoveryAnchor.id, first.id);

  const firstGuard = await catalogBackupDeletionGuard(aws, first.id);
  assert.equal(firstGuard.allowed, true);
  assert.equal(firstGuard.remainingRecoveryAnchors, 1);
  assert.equal(firstGuard.recoveryAnchor.id, second.id);
});

test('valid snapshot JSON with missing referenced media does not count as the remaining recovery anchor', async () => {
  const aws = new MemoryAws(), olderCatalog = catalog('stale-anchor'), currentCatalog = catalog('current-anchor');
  await seedCatalogMedia(aws, olderCatalog);
  await seedCatalogMedia(aws, currentCatalog);
  const older = await snapshotCatalogs(aws, olderCatalog, emptyCatalog(), 'stale-anchor');
  const current = await snapshotCatalogs(aws, currentCatalog, emptyCatalog(), 'current-anchor');
  aws.objects.delete(firstMediaKey(olderCatalog));

  const guard = await catalogBackupDeletionGuard(aws, current.id);
  assert.equal(guard.allowed, false);
  assert.equal(guard.status, 'last-recoverable-backup');
  assert.equal(guard.targetAvailability, 'complete');
  assert.equal(guard.remainingRecoverable, 1, 'snapshot JSON is still structurally recoverable');
  assert.equal(guard.remainingRecoveryAnchors, 0, 'missing media makes the older snapshot unusable as the destructive-operation anchor');

  const staleGuard = await catalogBackupDeletionGuard(aws, older.id);
  assert.equal(staleGuard.allowed, true);
  assert.equal(staleGuard.status, 'safe-to-delete');
  assert.equal(staleGuard.recoveryAnchor.id, current.id);
});

test('known-bad recovery material may be deleted because it is not a recovery anchor', async () => {
  const aws = new MemoryAws();
  const damaged = await snapshotCatalogs(aws, catalog('damaged-anchor'), emptyCatalog(), 'damaged-anchor');
  const stored = aws.objects.get(damaged.key);
  assert.ok(stored, 'fixture snapshot must exist');
  stored.body = stored.body.replace('damaged-anchor', 'tampered-anchor');

  const guard = await catalogBackupDeletionGuard(aws, damaged.id);
  assert.equal(guard.allowed, true);
  assert.equal(guard.status, 'stale-backup-safe-to-delete');
  assert.equal(guard.targetStatus, 'checksum-mismatch');
  assert.equal(guard.recoverableBefore, 0);
  assert.equal(guard.remainingRecoverable, 0);
  assert.equal(guard.remainingRecoveryAnchors, 0);
});

test('uncertain snapshot verification blocks deletion when no confirmed anchor remains', async () => {
  const aws = new MemoryAws();
  const uncertain = await snapshotCatalogs(aws, catalog('uncertain-anchor'), emptyCatalog(), 'uncertain-anchor');
  aws.failGet.add(uncertain.key);

  const guard = await catalogBackupDeletionGuard(aws, uncertain.id);
  assert.equal(guard.allowed, false);
  assert.equal(guard.status, 'recovery-audit-uncertain');
  assert.equal(guard.targetStatus, 'check-failed');
  assert.equal(guard.remainingRecoverable, 0);
  assert.equal(guard.remainingRecoveryAnchors, 0);
  assert.match(guard.detail, /could not be proven disposable/i);
});
