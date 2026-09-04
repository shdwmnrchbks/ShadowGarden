import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_INDEX_KEY,
  BACKUP_LIMIT,
  listBackups,
  loadBackup,
  snapshotCatalogs
} from '../../functions/services/catalog.js';
import { auditCatalogBackups, inspectCatalogBackup } from '../../functions/services/recovery.js';
import {
  BACKUP_BYTES_HEADER,
  BACKUP_SHA256_HEADER,
  B2_BUCKET,
  getTextObject,
  getTextObjectWithIntegrity,
  putObject
} from '../../functions/services/storage.js';

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
      return new Response(null, { status: 204 });
    }
    return new Response('', { status: 405 });
  }
}

const catalog = (id = 'fixture-series') => ({
  generatedAt: '2026-09-03T00:00:00.000Z',
  series: [{ id, title: 'Recovery Fixture', volumes: [{ number: 1, title: 'Volume 1', file: '/media/shadow-garden/books/recovery.epub' }] }]
});
const emptyCatalog = () => ({ generatedAt: '2026-09-03T00:00:00.000Z', series: [] });

test('catalog snapshot retention policy is 15', () => {
  assert.equal(BACKUP_LIMIT, 15);
});

test('text objects without backup byte metadata remain readable', async () => {
  const aws = new MemoryAws();
  const key = 'shadow-garden/data/adult-catalog.json';
  const body = JSON.stringify(catalog('adult-fixture'));
  aws.rawPut(key, body, { 'content-type': 'application/json; charset=utf-8' });

  const inspected = await getTextObjectWithIntegrity(aws, key);
  assert.equal(inspected.integrity.expectedBytes, null);
  assert.equal(inspected.integrity.sizeMatches, null);
  assert.equal(await getTextObject(aws, key), body);
});

test('an explicit zero byte metadata value is distinct from a missing header', async () => {
  const aws = new MemoryAws();
  const key = 'shadow-garden/backups/catalogs/zero-byte-metadata.json';
  aws.rawPut(key, '{"not":"empty"}', { [BACKUP_BYTES_HEADER]: '0' });

  const inspected = await getTextObjectWithIntegrity(aws, key);
  assert.equal(inspected.integrity.expectedBytes, 0);
  assert.equal(inspected.integrity.sizeMatches, false);
  await assert.rejects(() => getTextObject(aws, key), /byte length mismatch/);
});

test('new catalog snapshots carry storage checksums and tampering blocks restore', async () => {
  const aws = new MemoryAws();
  const meta = await snapshotCatalogs(aws, catalog(), emptyCatalog(), 'integrity-test');
  const stored = aws.objects.get(meta.key);
  assert.ok(stored, 'snapshot payload must exist');
  assert.match(stored.headers.get(BACKUP_SHA256_HEADER) || '', /^[a-f0-9]{64}$/);
  assert.equal(Number(stored.headers.get(BACKUP_BYTES_HEADER)), new TextEncoder().encode(stored.body).byteLength);

  const verified = await inspectCatalogBackup(aws, meta);
  assert.equal(verified.status, 'verified');
  assert.equal(verified.recoverable, true);
  assert.equal(verified.verified, true);

  const loaded = await loadBackup(aws, meta.id);
  assert.equal(loaded.main.series[0].id, 'fixture-series');

  stored.body = stored.body.replace('Recovery Fixture', 'Tampered Fixture');
  const damaged = await inspectCatalogBackup(aws, meta);
  assert.equal(damaged.status, 'checksum-mismatch');
  assert.equal(damaged.recoverable, false);
  await assert.rejects(() => loadBackup(aws, meta.id), /SHA-256 checksum mismatch/);
});

test('recovery audit distinguishes legacy, missing, unreadable, and incomplete snapshots', async () => {
  const aws = new MemoryAws();
  const entries = [
    { id: 'legacy', key: 'shadow-garden/backups/catalogs/legacy.json', createdAt: '2026-09-03T01:00:00.000Z', reason: 'legacy' },
    { id: 'missing', key: 'shadow-garden/backups/catalogs/missing.json', createdAt: '2026-09-03T00:59:00.000Z', reason: 'missing' },
    { id: 'unreadable', key: 'shadow-garden/backups/catalogs/unreadable.json', createdAt: '2026-09-03T00:58:00.000Z', reason: 'unreadable' },
    { id: 'incomplete', key: 'shadow-garden/backups/catalogs/incomplete.json', createdAt: '2026-09-03T00:57:00.000Z', reason: 'incomplete' }
  ];
  const payload = id => JSON.stringify({ version: 1, id, createdAt: '2026-09-03T00:00:00.000Z', reason: id, main: catalog(id), adult: emptyCatalog() });
  aws.rawPut(entries[0].key, payload('legacy'));
  aws.rawPut(entries[2].key, '{not-json');
  aws.rawPut(entries[3].key, JSON.stringify({ version: 1, id: 'incomplete', main: catalog('incomplete') }));
  await putObject(aws, BACKUP_INDEX_KEY, JSON.stringify({ version: 1, backups: entries }), { 'content-type': 'application/json' });

  const report = await auditCatalogBackups(aws);
  assert.equal(report.policy.maxSnapshots, BACKUP_LIMIT);
  assert.equal(report.policy.checksum, 'sha256');
  assert.deepEqual(report.items.map(item => item.status), ['legacy-unverified', 'missing', 'unreadable', 'incomplete']);
  assert.equal(report.summary.total, 4);
  assert.equal(report.summary.recoverable, 1);
  assert.equal(report.summary.verified, 0);
  assert.equal(report.summary.legacyUnverified, 1);
  assert.equal(report.summary.damaged, 3);
  assert.equal(report.summary.missing, 1);
  assert.equal(report.summary.unreadable, 1);
  assert.equal(report.summary.incomplete, 1);
});

test('snapshot retention keeps the newest 15 and removes pruned payload objects', async () => {
  const aws = new MemoryAws(), created = [];
  for (let index = 0; index < BACKUP_LIMIT + 1; index += 1) created.push(await snapshotCatalogs(aws, catalog(`series-${index}`), emptyCatalog(), `retention-${index}`));

  const backups = await listBackups(aws);
  assert.equal(backups.length, BACKUP_LIMIT);
  assert.equal(backups[0].id, created.at(-1).id);
  assert.equal(backups.at(-1).id, created[1].id);
  assert.equal(aws.objects.has(created[0].key), false, 'oldest pruned backup payload must be removed after index update');
  assert.equal(aws.objects.has(created[1].key), true);
});
