import { deleteObject, getTextObject, putObject } from "./b2.js";

export const MAIN_KEY = "shadow-garden/data/catalog.json";
export const ADULT_KEY = "shadow-garden/data/adult-catalog.json";
export const TRASH_KEY = "shadow-garden/data/trash.json";
export const BACKUP_INDEX_KEY = "shadow-garden/backups/catalog-index.json";
export const BACKUP_PREFIX = "shadow-garden/backups/catalogs/";
export const BACKUP_LIMIT = 30;

const arr = value => Array.isArray(value) ? value : [];
const clone = value => JSON.parse(JSON.stringify(value));

function safeReason(value) {
  return String(value || "catalog-change")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "catalog-change";
}

function normalizeCatalog(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    series: arr(input.series)
  };
}

async function loadJson(aws, key, fallback) {
  const text = await getTextObject(aws, key);
  if (!text) return clone(fallback);
  try { return JSON.parse(text); }
  catch { throw new Error(`${key} contains invalid JSON`); }
}

export async function loadCatalogPair(aws) {
  const [main, adult] = await Promise.all([
    loadJson(aws, MAIN_KEY, { generatedAt: new Date().toISOString(), series: [] }),
    loadJson(aws, ADULT_KEY, { generatedAt: new Date().toISOString(), series: [] })
  ]);
  return { main: normalizeCatalog(main), adult: normalizeCatalog(adult) };
}

export async function saveCatalog(aws, key, catalog) {
  const next = normalizeCatalog(catalog);
  next.generatedAt = new Date().toISOString();
  next.series = arr(next.series).sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  await putObject(aws, key, JSON.stringify(next, null, 2), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30, stale-while-revalidate=120"
  });
  catalog.generatedAt = next.generatedAt;
  catalog.series = next.series;
}

export async function saveCatalogPair(aws, main, adult) {
  await Promise.all([saveCatalog(aws, MAIN_KEY, main), saveCatalog(aws, ADULT_KEY, adult)]);
}

export async function invalidateCatalogCache(request) {
  try {
    const cache = caches.default;
    const origin = new URL(request.url).origin;
    await Promise.all([MAIN_KEY, ADULT_KEY].map(key => cache.delete(new Request(`${origin}/media/${key}`))));
  } catch (error) {
    console.warn("Public catalog cache invalidation skipped", error);
  }
}

export async function listBackups(aws) {
  const index = await loadJson(aws, BACKUP_INDEX_KEY, { version: 1, backups: [] });
  return arr(index.backups);
}

export async function snapshotCatalogs(aws, main, adult, reason = "catalog-change") {
  const createdAt = new Date().toISOString();
  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const stamp = createdAt.replace(/[:.]/g, "-");
  const key = `${BACKUP_PREFIX}${stamp}-${safeReason(reason)}-${id.slice(-8)}.json`;
  const payload = {
    version: 1,
    id,
    createdAt,
    reason: String(reason || "catalog-change").slice(0, 120),
    main: clone(normalizeCatalog(main)),
    adult: clone(normalizeCatalog(adult))
  };
  await putObject(aws, key, JSON.stringify(payload, null, 2), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store"
  });

  const backups = await listBackups(aws);
  const meta = {
    id,
    key,
    createdAt,
    reason: payload.reason,
    counts: {
      mainSeries: payload.main.series.length,
      adultSeries: payload.adult.series.length,
      volumes: [...payload.main.series, ...payload.adult.series].reduce((n, series) => n + arr(series.volumes).length, 0)
    }
  };
  const next = [meta, ...backups.filter(item => item?.id !== id)];
  const kept = next.slice(0, BACKUP_LIMIT);
  const pruned = next.slice(BACKUP_LIMIT);
  await putObject(aws, BACKUP_INDEX_KEY, JSON.stringify({ version: 1, updatedAt: createdAt, backups: kept }, null, 2), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store"
  });
  for (const item of pruned) {
    if (item?.key?.startsWith(BACKUP_PREFIX)) {
      try { await deleteObject(aws, item.key); }
      catch (error) { console.warn("Old catalog backup cleanup skipped", item.key, error); }
    }
  }
  return meta;
}

export async function loadBackup(aws, id) {
  const backup = (await listBackups(aws)).find(item => item?.id === id);
  if (!backup?.key) return null;
  const payload = await loadJson(aws, backup.key, null);
  if (!payload?.main || !payload?.adult) throw new Error("Catalog backup is incomplete");
  return { meta: backup, main: normalizeCatalog(payload.main), adult: normalizeCatalog(payload.adult) };
}

export async function loadTrash(aws) {
  const value = await loadJson(aws, TRASH_KEY, { version: 1, items: [] });
  return { version: 1, updatedAt: value.updatedAt || "", items: arr(value.items) };
}

export async function saveTrash(aws, trash) {
  const next = { version: 1, updatedAt: new Date().toISOString(), items: arr(trash?.items) };
  await putObject(aws, TRASH_KEY, JSON.stringify(next, null, 2), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store"
  });
  return next;
}

export async function appendTrashItem(aws, item) {
  const trash = await loadTrash(aws);
  const entry = {
    id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    removedAt: new Date().toISOString(),
    ...clone(item)
  };
  trash.items.unshift(entry);
  await saveTrash(aws, trash);
  return entry;
}

export function mediaKey(value) {
  const text = String(value || "");
  if (!text.startsWith("/media/")) return "";
  try { return decodeURIComponent(text.slice(7)); }
  catch { return ""; }
}

export function seriesObjectKeys(series) {
  const keys = new Set();
  const add = value => { const key = mediaKey(value); if (key) keys.add(key); };
  add(series?.cover);
  add(series?.coverThumb);
  for (const volume of arr(series?.volumes)) {
    add(volume?.file);
    add(volume?.cover);
    add(volume?.coverThumb);
  }
  return keys;
}

export function trashItemKeys(item) {
  if (item?.type === "series") return seriesObjectKeys(item?.payload?.series);
  if (item?.type === "volume") {
    const keys = new Set();
    const add = value => { const key = mediaKey(value); if (key) keys.add(key); };
    add(item?.payload?.volume?.file);
    add(item?.payload?.volume?.cover);
    add(item?.payload?.volume?.coverThumb);
    return keys;
  }
  return new Set();
}
