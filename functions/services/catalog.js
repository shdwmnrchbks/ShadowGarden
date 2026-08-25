/* Shadow Garden R6 — canonical catalog, backup, Trash, banner, and maintenance service. */
import { bookIdForFile, isBookId, volumeBookId } from "../_lib/book-id.js";
import { canonicalizeSeriesStatus, normalizeSeriesStatus, withSeriesStatusTag } from "../_lib/series-status.js";
import { requireAdmin } from "./auth.js";
import { json, parseJson } from "./http.js";
import { deleteObject, getTextObject, putObject, validObjectKey, writeClient } from "./storage.js";
import {
  arr, catalogHealth, checkObjectBatch, clean, clone, externalUrl, mediaKey,
  normalizeCatalogVolumeInput, sameText, slug
} from "./validation.js";

export const MAIN_KEY = "shadow-garden/data/catalog.json";
export const ADULT_KEY = "shadow-garden/data/adult-catalog.json";
export const TRASH_KEY = "shadow-garden/data/trash.json";
export const BACKUP_INDEX_KEY = "shadow-garden/backups/catalog-index.json";
export const BACKUP_PREFIX = "shadow-garden/backups/catalogs/";
export const BACKUP_LIMIT = 30;

function normalizeCatalog(value) {
  const input = value && typeof value === "object" ? value : {};
  return { generatedAt: input.generatedAt || new Date().toISOString(), series: arr(input.series) };
}

async function loadJson(aws, key, fallback) {
  const text = await getTextObject(aws, key);
  if (!text) return clone(fallback);
  try { return JSON.parse(text); }
  catch { throw new Error(`${key} contains invalid JSON`); }
}

export async function loadCatalog(aws, key) {
  return normalizeCatalog(await loadJson(aws, key, { generatedAt: new Date().toISOString(), series: [] }));
}

export async function loadCatalogPair(aws) {
  const [main, adult] = await Promise.all([loadCatalog(aws, MAIN_KEY), loadCatalog(aws, ADULT_KEY)]);
  return { main, adult };
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
    const origin = new URL(request.url).origin, cache = caches.default;
    await Promise.all([MAIN_KEY, ADULT_KEY].map(key => cache.delete(new Request(`${origin}/media/${key}`))));
  } catch (error) { console.warn("Public catalog cache invalidation skipped", error); }
}

export function locateSeries(data, id) {
  const mainIndex = arr(data?.main?.series).findIndex(series => series?.id === id);
  if (mainIndex >= 0) return { catalog: data.main, key: MAIN_KEY, index: mainIndex, adult: false, series: data.main.series[mainIndex] };
  const adultIndex = arr(data?.adult?.series).findIndex(series => series?.id === id);
  if (adultIndex >= 0) return { catalog: data.adult, key: ADULT_KEY, index: adultIndex, adult: true, series: data.adult.series[adultIndex] };
  return null;
}

export function managementShape(data) {
  const main = arr(data?.main?.series), adult = arr(data?.adult?.series), all = [...main, ...adult];
  return { ok: true, generatedAt: new Date().toISOString(), main, adult, counts: {
    series: all.length, volumes: all.reduce((total, series) => total + arr(series.volumes).length, 0), mainSeries: main.length, adultSeries: adult.length
  }};
}

function safeReason(value) {
  return String(value || "catalog-change").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "catalog-change";
}

export async function listBackups(aws) {
  const index = await loadJson(aws, BACKUP_INDEX_KEY, { version: 1, backups: [] });
  return arr(index.backups);
}

export async function snapshotCatalogs(aws, main, adult, reason = "catalog-change") {
  const createdAt = new Date().toISOString(), id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, stamp = createdAt.replace(/[:.]/g, "-");
  const key = `${BACKUP_PREFIX}${stamp}-${safeReason(reason)}-${id.slice(-8)}.json`;
  const payload = { version: 1, id, createdAt, reason: String(reason || "catalog-change").slice(0, 120), main: clone(normalizeCatalog(main)), adult: clone(normalizeCatalog(adult)) };
  await putObject(aws, key, JSON.stringify(payload, null, 2), { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" });
  const backups = await listBackups(aws);
  const meta = { id, key, createdAt, reason: payload.reason, counts: {
    mainSeries: payload.main.series.length, adultSeries: payload.adult.series.length,
    volumes: [...payload.main.series, ...payload.adult.series].reduce((total, series) => total + arr(series.volumes).length, 0)
  }};
  const next = [meta, ...backups.filter(item => item?.id !== id)], kept = next.slice(0, BACKUP_LIMIT), pruned = next.slice(BACKUP_LIMIT);
  await putObject(aws, BACKUP_INDEX_KEY, JSON.stringify({ version: 1, updatedAt: createdAt, backups: kept }, null, 2), { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" });
  for (const item of pruned) if (item?.key?.startsWith(BACKUP_PREFIX)) try { await deleteObject(aws, item.key); } catch (error) { console.warn("Old catalog backup cleanup skipped", item.key, error); }
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
  await putObject(aws, TRASH_KEY, JSON.stringify(next, null, 2), { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" });
  return next;
}

export async function appendTrashItem(aws, item) {
  const trash = await loadTrash(aws);
  const entry = { id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, removedAt: new Date().toISOString(), ...clone(item) };
  trash.items.unshift(entry); await saveTrash(aws, trash); return entry;
}

export function seriesObjectKeys(series) {
  const keys = new Set(), add = value => { const key = mediaKey(value); if (key) keys.add(key); };
  add(series?.cover); add(series?.coverThumb);
  for (const volume of arr(series?.volumes)) { add(volume?.file); add(volume?.cover); add(volume?.coverThumb); }
  return keys;
}

export function trashItemKeys(item) {
  if (item?.type === "series") return seriesObjectKeys(item?.payload?.series);
  if (item?.type === "volume") {
    const keys = new Set(), add = value => { const key = mediaKey(value); if (key) keys.add(key); };
    add(item?.payload?.volume?.file); add(item?.payload?.volume?.cover); add(item?.payload?.volume?.coverThumb); return keys;
  }
  return new Set();
}

function duplicateIndex(series, { number, title, sha256, originalFilename, replaceTargetFile }) {
  const volumes = arr(series?.volumes);
  if (replaceTargetFile) return volumes.findIndex(volume => String(volume.file || "") === replaceTargetFile);
  return volumes.findIndex(volume =>
    (sha256 && volume.sha256 && String(volume.sha256).toLowerCase() === sha256) ||
    (originalFilename && volume.originalFilename && sameText(volume.originalFilename, originalFilename)) ||
    (number !== 9999 && Number(volume.number) === number) || sameText(volume.title, title)
  );
}

export async function handleCatalogPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await parseJson(request); if (!body.ok) return json({ ok: false, error: "Invalid JSON body" }, 400);
  const normalized = normalizeCatalogVolumeInput(body.value); if (!normalized.ok) return json({ ok: false, error: normalized.error }, normalized.status);
  const input = normalized.value, requestedStatus = normalizeSeriesStatus(input.rawStatus);
  try {
    const aws = writeClient(env), data = await loadCatalogPair(aws), target = input.adult ? data.adult : data.main;
    let sid = `${input.adult ? "adult-" : ""}${slug(input.seriesName)}`;
    let series;
    if (input.targetSeriesId) {
      series = target.series.find(item => item.id === input.targetSeriesId);
      if (!series) return json({ ok: false, error: "Target series no longer exists on this shelf. Refresh Garden Keeper and try again." }, 409);
      sid = series.id;
    } else series = target.series.find(item => item.id === sid);

    const cover = input.coverKey ? `/media/${input.coverKey}` : "", coverThumb = input.coverThumbKey ? `/media/${input.coverThumbKey}` : "";
    let existing = series ? duplicateIndex(series, input) : -1;
    if (input.duplicatePolicy === "replace" && input.replaceTargetFile && existing < 0) return json({ ok: false, error: "Replacement target no longer exists", duplicate: true }, 409);
    if (input.duplicatePolicy === "reject" && existing >= 0) return json({ ok: false, error: "Duplicate volume detected", duplicate: true, seriesId: sid, volumeIndex: existing, volume: series.volumes[existing] }, 409);

    await snapshotCatalogs(aws, data.main, data.adult, input.duplicatePolicy === "replace" && existing >= 0 ? "replace-volume" : "add-volume");
    if (!series) {
      series = { id: sid, title: input.seriesName, author: input.author, year: input.year, status: requestedStatus, description: input.description,
        tags: withSeriesStatusTag(input.incomingTags, requestedStatus), cover, coverThumb, audioAlignedUrl: input.audioAlignedUrl, ...(input.translationStatus ? { translationStatus: input.translationStatus } : {}), ...(input.translations.length ? { translations: input.translations } : {}), nsfw: input.adult, volumes: [] };
      target.series.push(series);
    } else {
      canonicalizeSeriesStatus(series);
      if (!input.targetSeriesId) {
        series.title = input.seriesName || series.title; series.author = input.author || series.author; series.year = input.year || series.year;
        if (input.rawStatus) series.status = requestedStatus; series.description = input.description || series.description;
        series.tags = withSeriesStatusTag([...arr(series.tags), ...input.incomingTags], series.status);
      }
      const legacyAudioUrl = arr(series.volumes).find(volume => volume.audioAlignedUrl)?.audioAlignedUrl || "";
      if (!series.audioAlignedUrl && legacyAudioUrl) series.audioAlignedUrl = legacyAudioUrl;
      if (input.audioAlignedUrl) series.audioAlignedUrl = input.audioAlignedUrl;
      if (input.translationStatus) series.translationStatus = input.translationStatus;
      if (input.translations.length) series.translations = input.translations;
    }
    canonicalizeSeriesStatus(series);

    const previous = existing >= 0 ? series.volumes[existing] : null, replacing = input.duplicatePolicy === "replace" && existing >= 0, file = `/media/${input.epubKey}`;
    const bookId = replacing ? (isBookId(previous?.bookId) ? previous.bookId : await bookIdForFile(previous?.file || file)) : await bookIdForFile(file);
    const volume = { title: input.title, number: input.number, file, ...(bookId ? { bookId } : {}),
      cover: cover || (replacing ? previous?.cover || "" : ""), coverThumb: coverThumb || (replacing ? previous?.coverThumb || "" : ""),
      author: input.author, language: input.language, date: input.date, size: input.size,
      added: replacing && previous?.added ? previous.added : new Date().toISOString().slice(0, 10), publisher: input.publisher, description: input.description,
      ...(replacing && previous?.translations ? { translations: previous.translations } : {}),
      ...(input.sha256 ? { sha256: input.sha256 } : {}), ...(input.originalFilename ? { originalFilename: input.originalFilename } : {}) };
    if (replacing) {
      const previousWasSeriesCover = Boolean(previous?.cover && series.cover === previous.cover), previousWasSeriesThumb = Boolean(previous?.coverThumb && series.coverThumb === previous.coverThumb);
      if (!series.audioAlignedUrl && previous?.audioAlignedUrl) series.audioAlignedUrl = previous.audioAlignedUrl;
      series.volumes[existing] = volume;
      if (previousWasSeriesCover && volume.cover) series.cover = volume.cover;
      if ((previousWasSeriesThumb || previousWasSeriesCover) && volume.coverThumb) series.coverThumb = volume.coverThumb;
    } else series.volumes.push(volume);
    series.volumes.sort((a, b) => (Number(a.number) || 9999) - (Number(b.number) || 9999) || String(a.title).localeCompare(String(b.title)));
    if (!series.cover && volume.cover) { series.cover = volume.cover; series.coverThumb = volume.coverThumb; }
    else if (!series.coverThumb && series.cover === volume.cover && volume.coverThumb) series.coverThumb = volume.coverThumb;

    await saveCatalogPair(aws, data.main, data.adult); await invalidateCatalogCache(request);
    return json({ ok: true, seriesId: sid, series: series.title, volume: input.title, file: volume.file, bookId: volume.bookId || "", cover: volume.cover,
      coverThumb: volume.coverThumb, audioAlignedUrl: series.audioAlignedUrl || "", duplicatePolicy: input.duplicatePolicy, replaced: replacing, targeted: Boolean(input.targetSeriesId) });
  } catch (error) { console.error("Catalog update failed", error); return json({ ok: false, error: "Catalog update failed", detail: String(error?.message || error) }, 502); }
}

export async function handleLibraryGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  try { return json(managementShape(await loadCatalogPair(writeClient(env)))); }
  catch (error) { console.error("Library management read failed", error); return json({ ok: false, error: "Could not load library", detail: String(error?.message || error) }, 502); }
}

export async function handleLibraryPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await parseJson(request); if (!body.ok) return json({ ok: false, error: "Invalid JSON body" }, 400);
  const input = body.value, action = clean(input.action, 40), id = clean(input.id, 180);
  if (!action || !id) return json({ ok: false, error: "Action and series id are required" }, 400);
  try {
    const aws = writeClient(env), data = await loadCatalogPair(aws), found = locateSeries(data, id);
    if (!found) return json({ ok: false, error: "Series not found" }, 404);
    const series = found.series;
    if (action === "update-series") {
      const audioAlignedUrl = externalUrl(input.audioAlignedUrl); if (audioAlignedUrl === null) return json({ ok: false, error: "Audio-aligned EPUB folder URL must use http:// or https://" }, 400);
      await snapshotCatalogs(aws, data.main, data.adult, "update-series");
      const status = normalizeSeriesStatus(input.status);
      series.title = clean(input.title, 300) || series.title; series.author = clean(input.author, 240); series.year = Number(input.year) || ""; series.status = status;
      series.description = clean(input.description, 12000); series.tags = withSeriesStatusTag(input.tags, status); series.audioAlignedUrl = audioAlignedUrl;
      for (const volume of arr(series.volumes)) delete volume.audioAlignedUrl;
      const requestedAdult = Boolean(input.adult);
      if (requestedAdult !== found.adult) {
        found.catalog.series.splice(found.index, 1); series.nsfw = requestedAdult;
        series.id = requestedAdult ? (String(series.id).startsWith("adult-") ? series.id : `adult-${series.id}`) : String(series.id).replace(/^adult-/, "");
        const destination = requestedAdult ? data.adult : data.main;
        if (destination.series.some(item => item.id === series.id)) return json({ ok: false, error: "A series with the target id already exists" }, 409);
        destination.series.push(series);
      }
      await saveCatalogPair(aws, data.main, data.adult); await invalidateCatalogCache(request); return json({ ...managementShape(data), changedId: series.id });
    }
    if (action === "update-volume") {
      const volumeIndex = Number(input.volumeIndex); if (!Number.isInteger(volumeIndex) || volumeIndex < 0 || volumeIndex >= arr(series.volumes).length) return json({ ok: false, error: "Volume not found" }, 404);
      const volume = series.volumes[volumeIndex], number = Number(input.number); await snapshotCatalogs(aws, data.main, data.adult, "update-volume");
      canonicalizeSeriesStatus(series); if (!series.audioAlignedUrl) series.audioAlignedUrl = arr(series.volumes).find(v => v.audioAlignedUrl)?.audioAlignedUrl || "";
      for (const item of arr(series.volumes)) delete item.audioAlignedUrl;
      volume.title = clean(input.title, 300) || volume.title; volume.number = Number.isFinite(number) && number > 0 ? number : volume.number; volume.date = clean(input.date, 40);
      volume.publisher = clean(input.publisher, 240); volume.description = clean(input.description, 12000);
      series.volumes.sort((a, b) => (Number(a.number) || 9999) - (Number(b.number) || 9999) || String(a.title || "").localeCompare(String(b.title || "")));
      await saveCatalog(aws, found.key, found.catalog); await invalidateCatalogCache(request); return json(managementShape(data));
    }
    if (action === "delete-volume") {
      const volumeIndex = Number(input.volumeIndex); if (!Number.isInteger(volumeIndex) || volumeIndex < 0 || volumeIndex >= arr(series.volumes).length) return json({ ok: false, error: "Volume not found" }, 404);
      await snapshotCatalogs(aws, data.main, data.adult, "trash-volume"); const originalSeries = clone(series), [volume] = series.volumes.splice(volumeIndex, 1);
      if (!series.volumes.length) found.catalog.series.splice(found.index, 1); else { canonicalizeSeriesStatus(series); if (series.cover === volume.cover) series.cover = series.volumes.find(v => v.cover)?.cover || ""; if (series.coverThumb === volume.coverThumb) series.coverThumb = series.volumes.find(v => v.coverThumb)?.coverThumb || ""; }
      await appendTrashItem(aws, { type: "volume", scope: found.adult ? "adult" : "main", seriesId: originalSeries.id, title: volume.title || `Volume ${volume.number ?? volumeIndex + 1}`,
        subtitle: originalSeries.title || "Untitled series", payload: { series: { ...originalSeries, volumes: [] }, volume: clone(volume), volumeIndex } });
      await saveCatalog(aws, found.key, found.catalog); await invalidateCatalogCache(request); return json({ ...managementShape(data), trashed: true });
    }
    if (action === "delete-series") {
      await snapshotCatalogs(aws, data.main, data.adult, "trash-series"); const removed = clone(series);
      await appendTrashItem(aws, { type: "series", scope: found.adult ? "adult" : "main", seriesId: removed.id, title: removed.title || "Untitled series",
        subtitle: `${arr(removed.volumes).length} ${arr(removed.volumes).length === 1 ? "volume" : "volumes"}`, payload: { series: removed } });
      found.catalog.series.splice(found.index, 1); await saveCatalog(aws, found.key, found.catalog); await invalidateCatalogCache(request); return json({ ...managementShape(data), trashed: true });
    }
    return json({ ok: false, error: "Unknown management action" }, 400);
  } catch (error) { console.error("Library management mutation failed", error); return json({ ok: false, error: "Library update failed", detail: String(error?.message || error) }, 502); }
}

async function bannerChoices(series) {
  const choices = [];
  for (const [index, volume] of arr(series?.volumes).entries()) {
    const bookId = await volumeBookId(volume); if (!bookId) continue;
    choices.push({ bookId, number: volume?.number ?? index + 1, title: String(volume?.title || `Volume ${index + 1}`), cover: String(volume?.cover || volume?.coverThumb || "") });
  }
  return choices;
}

export async function handleSeriesBannerGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const id = clean(new URL(request.url).searchParams.get("id"), 180); if (!id) return json({ ok: false, error: "Series id is required" }, 400);
  try {
    const data = await loadCatalogPair(writeClient(env)), found = locateSeries(data, id); if (!found) return json({ ok: false, error: "Series not found" }, 404);
    const choices = await bannerChoices(found.series), allowed = new Set(choices.map(choice => choice.bookId));
    const current = allowed.has(String(found.series?.bannerBookId || "")) ? String(found.series.bannerBookId) : "";
    return json({ ok: true, id: found.series.id, current, choices });
  } catch (error) { console.error("Series banner read failed", error); return json({ ok: false, error: "Could not load series banner options", detail: String(error?.message || error) }, 502); }
}

export async function handleSeriesBannerPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await parseJson(request); if (!body.ok) return json({ ok: false, error: "Invalid JSON body" }, 400);
  const id = clean(body.value?.id, 180), bannerBookId = clean(body.value?.bannerBookId, 80); if (!id) return json({ ok: false, error: "Series id is required" }, 400);
  try {
    const aws = writeClient(env), data = await loadCatalogPair(aws), found = locateSeries(data, id); if (!found) return json({ ok: false, error: "Series not found" }, 404);
    const choices = await bannerChoices(found.series), allowed = new Set(choices.map(choice => choice.bookId)); if (bannerBookId && !allowed.has(bannerBookId)) return json({ ok: false, error: "Banner must use a current volume cover" }, 400);
    await snapshotCatalogs(aws, data.main, data.adult, "update-series-banner"); if (bannerBookId) found.series.bannerBookId = bannerBookId; else delete found.series.bannerBookId;
    await saveCatalog(aws, found.key, found.catalog); await invalidateCatalogCache(request); return json({ ok: true, id: found.series.id, bannerBookId: bannerBookId || "", choices });
  } catch (error) { console.error("Series banner update failed", error); return json({ ok: false, error: "Could not update series banner", detail: String(error?.message || error) }, 502); }
}

export async function handleBackupPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await parseJson(request); if (!body.ok) return json({ ok: false, error: "Invalid JSON body" }, 400);
  if (clean(body.value.action, 40) !== "delete") return json({ ok: false, error: "Unknown backup action" }, 400);
  const id = clean(body.value.id, 160); if (!id) return json({ ok: false, error: "Backup id is required" }, 400);
  try {
    const aws = writeClient(env), backups = await listBackups(aws), index = backups.findIndex(item => item?.id === id);
    if (index < 0) return json({ ok: false, error: "Backup not found" }, 404);
    const removed = backups[index], next = backups.filter(item => item?.id !== id), now = new Date().toISOString();
    await putObject(aws, BACKUP_INDEX_KEY, JSON.stringify({ version: 1, updatedAt: now, backups: next }, null, 2), { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" });
    try { if (removed?.key?.startsWith(BACKUP_PREFIX)) await deleteObject(aws, removed.key); }
    catch (error) {
      await putObject(aws, BACKUP_INDEX_KEY, JSON.stringify({ version: 1, updatedAt: now, backups }, null, 2), { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" }); throw error;
    }
    return json({ ok: true, deletedBackup: id, remaining: next.length });
  } catch (error) { console.error("Catalog backup deletion failed", error); return json({ ok: false, error: "Could not delete catalog backup", detail: String(error?.message || error) }, 502); }
}

async function maintenancePayload(aws) {
  const [data, trash, backups] = await Promise.all([loadCatalogPair(aws), loadTrash(aws), listBackups(aws)]);
  return { ok: true, generatedAt: new Date().toISOString(), health: catalogHealth(data, trash), backups, trash: arr(trash.items).map(item => ({
    id: item.id, type: item.type, scope: item.scope, seriesId: item.seriesId, title: item.title, subtitle: item.subtitle || "", removedAt: item.removedAt
  })) };
}

function activeObjectKeys(data) { const keys = new Set(); for (const series of [...arr(data.main.series), ...arr(data.adult.series)]) for (const key of seriesObjectKeys(series)) keys.add(key); return keys; }

export async function handleMaintenanceGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  try { return json(await maintenancePayload(writeClient(env))); }
  catch (error) { console.error("Garden Maintenance read failed", error); return json({ ok: false, error: "Could not load Garden Maintenance", detail: String(error?.message || error) }, 502); }
}

export async function handleMaintenancePost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await parseJson(request); if (!body.ok) return json({ ok: false, error: "Invalid JSON body" }, 400);
  const input = body.value, action = clean(input.action, 80);
  try {
    const aws = writeClient(env);
    if (action === "check-objects") return json({ ok: true, ...(await checkObjectBatch(aws, input.keys)) });
    if (action === "create-backup") {
      const data = await loadCatalogPair(aws), backup = await snapshotCatalogs(aws, data.main, data.adult, clean(input.reason, 120) || "manual-backup");
      return json({ ...(await maintenancePayload(aws)), createdBackup: backup });
    }
    if (action === "restore-backup") {
      const id = clean(input.id, 160), backup = await loadBackup(aws, id); if (!backup) return json({ ok: false, error: "Backup not found" }, 404);
      const current = await loadCatalogPair(aws); await snapshotCatalogs(aws, current.main, current.adult, `pre-restore-${id.slice(0, 24)}`);
      await saveCatalogPair(aws, clone(backup.main), clone(backup.adult)); await invalidateCatalogCache(request); return json({ ...(await maintenancePayload(aws)), restoredBackup: id });
    }
    if (action === "apply-cover-optimizations") {
      const updates = arr(input.updates).slice(0, 250); if (!updates.length) return json({ ok: false, error: "No cover updates were supplied" }, 400);
      const data = await loadCatalogPair(aws), valid = [];
      for (const update of updates) {
        const scope = update.scope === "adult" ? "adult" : "main", seriesId = clean(update.seriesId, 180), coverKey = clean(update.coverKey, 900), coverThumbKey = clean(update.coverThumbKey, 900);
        if (!validObjectKey(coverKey, ["shadow-garden/covers/"]) || !validObjectKey(coverThumbKey, ["shadow-garden/covers/"])) continue;
        const found = locateSeries(data, seriesId); if (!found || (found.adult ? "adult" : "main") !== scope) continue;
        valid.push({ update, found, coverKey, coverThumbKey });
      }
      if (!valid.length) return json({ ok: false, error: "None of the cover updates still matched the catalog" }, 409);
      await snapshotCatalogs(aws, data.main, data.adult, "bulk-cover-optimization"); let applied = 0;
      for (const { update, found, coverKey, coverThumbKey } of valid) {
        const detail = `/media/${coverKey}`, thumb = `/media/${coverThumbKey}`, series = found.series;
        const hasVolumeIndex = update.volumeIndex !== null && update.volumeIndex !== undefined && Number.isInteger(Number(update.volumeIndex));
        let volume = update.volumeFile ? arr(series.volumes).find(entry => entry.file === update.volumeFile) || null : null;
        if (!volume && hasVolumeIndex) volume = arr(series.volumes)[Number(update.volumeIndex)] || null;
        if (volume) {
          const oldCover = volume.cover || "", oldThumb = volume.coverThumb || "", seriesUsesCover = !series.cover || series.cover === oldCover, seriesUsesThumb = !series.coverThumb || series.coverThumb === oldThumb;
          volume.cover = detail; volume.coverThumb = thumb; if (seriesUsesCover) { series.cover = detail; if (seriesUsesThumb) series.coverThumb = thumb; }
        } else if (!hasVolumeIndex) { series.cover = detail; series.coverThumb = thumb; } else continue;
        applied++;
      }
      if (!applied) return json({ ok: false, error: "Cover targets changed before the update could be applied" }, 409);
      await saveCatalogPair(aws, data.main, data.adult); await invalidateCatalogCache(request); return json({ ...(await maintenancePayload(aws)), optimized: applied });
    }
    if (action === "restore-trash") {
      const id = clean(input.id, 160), [data, trash] = await Promise.all([loadCatalogPair(aws), loadTrash(aws)]), index = arr(trash.items).findIndex(item => item.id === id);
      if (index < 0) return json({ ok: false, error: "Trash item not found" }, 404);
      const item = trash.items[index], scope = item.scope === "adult" ? "adult" : "main", target = scope === "adult" ? data.adult : data.main, other = scope === "adult" ? data.main : data.adult, seriesId = clean(item.seriesId, 180);
      if (item.type === "series") {
        const restored = clone(item.payload?.series); if (!restored?.id) return json({ ok: false, error: "Trash entry is incomplete" }, 409);
        if (arr(target.series).some(series => series.id === restored.id) || arr(other.series).some(series => series.id === restored.id)) return json({ ok: false, error: "A series with this id already exists. Restore a catalog backup or resolve the conflict first." }, 409);
        await snapshotCatalogs(aws, data.main, data.adult, "restore-trash-series"); target.series.push(restored);
      } else if (item.type === "volume") {
        const volume = clone(item.payload?.volume), seriesMeta = clone(item.payload?.series); if (!volume?.file || !seriesMeta?.id) return json({ ok: false, error: "Trash entry is incomplete" }, 409);
        if (arr(other.series).some(series => series.id === seriesMeta.id)) return json({ ok: false, error: "The series currently exists on the other shelf." }, 409);
        let series = arr(target.series).find(entry => entry.id === seriesMeta.id);
        if (series && arr(series.volumes).some(entry => entry.file === volume.file || (Number(entry.number) === Number(volume.number) && Number.isFinite(Number(volume.number))))) return json({ ok: false, error: "That volume already exists in the restored series." }, 409);
        await snapshotCatalogs(aws, data.main, data.adult, "restore-trash-volume"); if (!series) { series = { ...seriesMeta, volumes: [] }; target.series.push(series); }
        series.volumes.push(volume); series.volumes.sort((a, b) => (Number(a.number) || 9999) - (Number(b.number) || 9999) || String(a.title || "").localeCompare(String(b.title || "")));
        if (!series.cover && volume.cover) series.cover = volume.cover; if (!series.coverThumb && volume.coverThumb) series.coverThumb = volume.coverThumb;
      } else return json({ ok: false, error: "Unknown Trash entry type" }, 409);
      trash.items.splice(index, 1); await Promise.all([saveCatalogPair(aws, data.main, data.adult), saveTrash(aws, trash)]); await invalidateCatalogCache(request);
      return json({ ...(await maintenancePayload(aws)), restoredTrash: id, seriesId });
    }
    if (action === "purge-trash") {
      const requested = arr(input.ids).map(value => clean(value, 160)).filter(Boolean), [data, trash] = await Promise.all([loadCatalogPair(aws), loadTrash(aws)]);
      const selected = requested.length ? arr(trash.items).filter(item => requested.includes(item.id)) : arr(trash.items);
      if (!selected.length) return json({ ...(await maintenancePayload(aws)), purged: 0, deletedObjects: 0 });
      const selectedIds = new Set(selected.map(item => item.id)), remaining = arr(trash.items).filter(item => !selectedIds.has(item.id)), keep = activeObjectKeys(data);
      for (const item of remaining) for (const key of trashItemKeys(item)) keep.add(key);
      const remove = new Set(); for (const item of selected) for (const key of trashItemKeys(item)) if (!keep.has(key)) remove.add(key);
      let deletedObjects = 0; for (const key of remove) { await deleteObject(aws, key); deletedObjects++; }
      trash.items = remaining; await saveTrash(aws, trash); return json({ ...(await maintenancePayload(aws)), purged: selected.length, deletedObjects });
    }
    return json({ ok: false, error: "Unknown maintenance action" }, 400);
  } catch (error) { console.error("Garden Maintenance action failed", action, error); return json({ ok: false, error: "Garden Maintenance action failed", detail: String(error?.message || error) }, 502); }
}
