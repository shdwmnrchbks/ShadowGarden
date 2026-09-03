import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAIN_KEY,
  saveCatalogPair,
  saveTrash,
  snapshotCatalogs
} from '../../functions/services/catalog.js';
import { catalogTrashPurgeGuard } from '../../functions/services/recovery.js';
import { B2_BUCKET } from '../../functions/services/storage.js';

class MemoryAws {
  constructor() { this.objects = new Map(); }

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

const removedSeries = {
  id: 'purge-recovery-series',
  title: 'Purge Recovery Series',
  cover: '/media/shadow-garden/covers/purge-recovery.webp',
  volumes: [{
    number: 1,
    title: 'Volume 1',
    file: '/media/shadow-garden/books/purge-recovery.epub',
    cover: '/media/shadow-garden/covers/purge-recovery.webp'
  }]
};
const catalog = series => ({ generatedAt: '2026-09-03T00:00:00.000Z', series });
const emptyCatalog = () => catalog([]);
const trashItem = (id, series = removedSeries) => ({
  id,
  type: 'series',
  scope: 'main',
  seriesId: series.id,
  title: series.title,
  payload: { series }
});

test('Trash purge is blocked while its media is referenced by the current recovery anchor', async () => {
  const aws = new MemoryAws(), beforeDelete = catalog([structuredClone(removedSeries)]), adult = emptyCatalog();
  await saveCatalogPair(aws, beforeDelete, adult);
  const preDelete = await snapshotCatalogs(aws, beforeDelete, adult, 'pre-delete-anchor');
  await saveCatalogPair(aws, emptyCatalog(), emptyCatalog());
  await saveTrash(aws, { items: [trashItem('trash-one')] });

  const blocked = await catalogTrashPurgeGuard(aws, ['trash-one']);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.status, 'purge-would-break-recovery-anchor');
  assert.equal(blocked.recoveryAnchor.id, preDelete.id);
  assert.equal(blocked.recoveryAnchor.verified, true);
  assert.equal(blocked.selected, 1);
  assert.ok(blocked.candidateDeletes >= 1);
  assert.ok(blocked.protectedDeletes >= 1);
  assert.match(blocked.detail, /fresh snapshot after the Trash change/i);
});

test('a fresh post-delete snapshot moves the recovery anchor forward and allows purge', async () => {
  const aws = new MemoryAws(), beforeDelete = catalog([structuredClone(removedSeries)]), adult = emptyCatalog();
  await saveCatalogPair(aws, beforeDelete, adult);
  const preDelete = await snapshotCatalogs(aws, beforeDelete, adult, 'pre-delete-anchor');
  const afterDelete = emptyCatalog();
  await saveCatalogPair(aws, afterDelete, emptyCatalog());
  await saveTrash(aws, { items: [trashItem('trash-one')] });
  const postDelete = await snapshotCatalogs(aws, afterDelete, emptyCatalog(), 'post-delete-anchor');

  const guard = await catalogTrashPurgeGuard(aws, ['trash-one']);
  assert.equal(guard.allowed, true);
  assert.equal(guard.status, 'safe-to-purge');
  assert.equal(guard.recoveryAnchor.id, postDelete.id);
  assert.notEqual(guard.recoveryAnchor.id, preDelete.id);
  assert.equal(guard.protectedDeletes, 0);
  assert.ok(guard.candidateDeletes >= 1);
});

test('object-deleting purge is blocked when no recoverable snapshot exists', async () => {
  const aws = new MemoryAws();
  await saveCatalogPair(aws, emptyCatalog(), emptyCatalog());
  await saveTrash(aws, { items: [trashItem('trash-one')] });

  const guard = await catalogTrashPurgeGuard(aws, ['trash-one']);
  assert.equal(guard.allowed, false);
  assert.equal(guard.status, 'no-recoverable-backup');
  assert.ok(guard.candidateDeletes >= 1);
  assert.match(guard.detail, /Create and verify a snapshot first/i);
});

test('purge that would delete no storage objects does not require a recovery anchor', async () => {
  const aws = new MemoryAws();
  await saveCatalogPair(aws, emptyCatalog(), emptyCatalog());
  await saveTrash(aws, { items: [trashItem('selected'), trashItem('remaining')] });

  const guard = await catalogTrashPurgeGuard(aws, ['selected']);
  assert.equal(guard.allowed, true);
  assert.equal(guard.status, 'no-object-deletes');
  assert.equal(guard.selected, 1);
  assert.equal(guard.candidateDeletes, 0);
});

test('Trash purge is blocked whenever a canonical live catalog requires recovery', async () => {
  const aws = new MemoryAws();
  await saveCatalogPair(aws, emptyCatalog(), emptyCatalog());
  await saveTrash(aws, { items: [trashItem('trash-one')] });
  aws.objects.delete(MAIN_KEY);

  const guard = await catalogTrashPurgeGuard(aws, ['trash-one']);
  assert.equal(guard.allowed, false);
  assert.equal(guard.status, 'live-catalog-recovery-required');
  assert.equal(guard.current.status, 'recovery-required');
  assert.equal(guard.current.entries.find(entry => entry.scope === 'main')?.status, 'missing');
  assert.equal(guard.candidateDeletes, 0);
  assert.match(guard.detail, /Recover the canonical catalogs/i);
});
