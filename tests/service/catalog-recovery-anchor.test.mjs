import test from 'node:test';
import assert from 'node:assert/strict';
import {
  snapshotCatalogs
} from '../../functions/services/catalog.js';
import { catalogBackupDeletionGuard } from '../../functions/services/recovery.js';
import { B2_BUCKET } from '../../functions/services/storage.js';

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

test('manual deletion is blocked for the last confirmed recoverable snapshot', async () => {
  const aws = new MemoryAws();
  const only = await snapshotCatalogs(aws, catalog('only-anchor'), emptyCatalog(), 'only-anchor');

  const guard = await catalogBackupDeletionGuard(aws, only.id);
  assert.equal(guard.allowed, false);
  assert.equal(guard.status, 'last-recoverable-backup');
  assert.equal(guard.targetStatus, 'verified');
  assert.equal(guard.recoverableBefore, 1);
  assert.equal(guard.remainingRecoverable, 0);
  assert.match(guard.detail, /last confirmed recoverable/i);
});

test('manual deletion is allowed when another confirmed recoverable snapshot remains', async () => {
  const aws = new MemoryAws();
  const first = await snapshotCatalogs(aws, catalog('first-anchor'), emptyCatalog(), 'first-anchor');
  const second = await snapshotCatalogs(aws, catalog('second-anchor'), emptyCatalog(), 'second-anchor');

  const guard = await catalogBackupDeletionGuard(aws, second.id);
  assert.equal(guard.allowed, true);
  assert.equal(guard.status, 'safe-to-delete');
  assert.equal(guard.targetStatus, 'verified');
  assert.equal(guard.recoverableBefore, 2);
  assert.equal(guard.remainingRecoverable, 1);

  const firstGuard = await catalogBackupDeletionGuard(aws, first.id);
  assert.equal(firstGuard.allowed, true);
  assert.equal(firstGuard.remainingRecoverable, 1);
});

test('known-bad recovery material may be deleted because it is not a recoverable anchor', async () => {
  const aws = new MemoryAws();
  const damaged = await snapshotCatalogs(aws, catalog('damaged-anchor'), emptyCatalog(), 'damaged-anchor');
  const stored = aws.objects.get(damaged.key);
  assert.ok(stored, 'fixture snapshot must exist');
  stored.body = stored.body.replace('damaged-anchor', 'tampered-anchor');

  const guard = await catalogBackupDeletionGuard(aws, damaged.id);
  assert.equal(guard.allowed, true);
  assert.equal(guard.status, 'safe-to-delete');
  assert.equal(guard.targetStatus, 'checksum-mismatch');
  assert.equal(guard.recoverableBefore, 0);
  assert.equal(guard.remainingRecoverable, 0);
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
  assert.match(guard.detail, /could not be verified/i);
});
