import { adminAuthorized, deleteObject, headObject, json, validObjectKey, writeClient } from "../_lib/b2.js";
import {
  invalidateCatalogCache,
  listBackups,
  loadBackup,
  loadCatalogPair,
  loadTrash,
  mediaKey,
  saveCatalogPair,
  saveTrash,
  seriesObjectKeys,
  snapshotCatalogs,
  trashItemKeys
} from "../_lib/garden-maintenance.js";

const arr = value => Array.isArray(value) ? value : [];
const clone = value => JSON.parse(JSON.stringify(value));
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);

function allSeries(data) {
  return [
    ...arr(data.main.series).map(series => ({ scope: "main", series })),
    ...arr(data.adult.series).map(series => ({ scope: "adult", series }))
  ];
}

function findSeries(data, scope, id) {
  const catalog = scope === "adult" ? data.adult : data.main;
  const index = arr(catalog.series).findIndex(series => series.id === id);
  return index >= 0 ? { catalog, series: catalog.series[index], index } : null;
}

function catalogCounts(data) {
  const items = allSeries(data);
  return {
    series: items.length,
    mainSeries: arr(data.main.series).length,
    adultSeries: arr(data.adult.series).length,
    volumes: items.reduce((total, item) => total + arr(item.series.volumes).length, 0)
  };
}

function addIssue(issues, severity, code, title, detail, context = {}) {
  issues.push({ severity, code, title, detail, ...context });
}

function staticHealth(data, trash) {
  const issues = [];
  const optimizationCandidates = [];
  const objectKeys = new Set();
  let missingThumbs = 0;
  let missingCovers = 0;
  let legacyIdentity = 0;
  let legacyAudioLinks = 0;

  const addMedia = value => {
    const key = mediaKey(value);
    if (key && validObjectKey(key)) objectKeys.add(key);
  };

  for (const { scope, series } of allSeries(data)) {
    const seriesId = clean(series.id, 180);
    const title = clean(series.title, 300) || "Untitled series";
    const volumes = arr(series.volumes);
    addMedia(series.cover);
    addMedia(series.coverThumb);

    if (!series.title) addIssue(issues, "error", "series-title", "Series title missing", `${seriesId || "Unknown series"} has no title.`, { scope, seriesId });
    if (!series.author) addIssue(issues, "info", "series-author", "Series author missing", `${title} has no author metadata.`, { scope, seriesId });
    if (!volumes.length) addIssue(issues, "warning", "empty-series", "Series has no volumes", `${title} contains no readable volumes.`, { scope, seriesId });

    const numberMap = new Map();
    const hashMap = new Map();
    volumes.forEach((volume, volumeIndex) => {
      const volumeTitle = clean(volume.title, 300) || `Volume ${volume.number ?? volumeIndex + 1}`;
      const context = { scope, seriesId, seriesTitle: title, volumeIndex, volumeTitle };
      addMedia(volume.file);
      addMedia(volume.cover);
      addMedia(volume.coverThumb);

      if (!volume.file || !mediaKey(volume.file)) addIssue(issues, "error", "volume-file", "EPUB reference missing", `${title} — ${volumeTitle} has no valid /media/ EPUB reference.`, context);
      if (!volume.cover) {
        missingCovers++;
        addIssue(issues, "warning", "volume-cover", "Cover missing", `${title} — ${volumeTitle} has no cover image.`, context);
      } else if (!volume.coverThumb) {
        missingThumbs++;
        optimizationCandidates.push({
          scope,
          seriesId,
          seriesTitle: title,
          volumeIndex,
          volumeTitle,
          volumeFile: volume.file || "",
          source: volume.cover
        });
      }

      if (!volume.sha256 || !volume.originalFilename) legacyIdentity++;
      if (volume.audioAlignedUrl) legacyAudioLinks++;

      const number = Number(volume.number);
      if (Number.isFinite(number)) {
        if (numberMap.has(number)) addIssue(issues, "warning", "duplicate-number", "Duplicate volume number", `${title} contains multiple entries numbered ${number}.`, context);
        else numberMap.set(number, volumeIndex);
      }
      const hash = clean(volume.sha256, 128).toLowerCase();
      if (hash) {
        if (hashMap.has(hash)) addIssue(issues, "warning", "duplicate-hash", "Duplicate EPUB hash", `${title} contains two catalog entries with the same SHA-256.`, context);
        else hashMap.set(hash, volumeIndex);
      }
    });

    if (series.cover && !series.coverThumb) {
      const represented = optimizationCandidates.some(candidate => candidate.scope === scope && candidate.seriesId === seriesId && candidate.source === series.cover);
      if (!represented) {
        missingThumbs++;
        optimizationCandidates.push({
          scope,
          seriesId,
          seriesTitle: title,
          volumeIndex: null,
          volumeTitle: "Series cover",
          volumeFile: "",
          source: series.cover
        });
      }
    }
  }

  if (legacyAudioLinks) addIssue(issues, "info", "legacy-audio", "Legacy volume audio links remain", `${legacyAudioLinks} volume-level audio link${legacyAudioLinks === 1 ? "" : "s"} can be migrated by saving the affected series.`, {});

  const counts = catalogCounts(data);
  return {
    status: issues.some(issue => issue.severity === "error") ? "attention" : issues.some(issue => issue.severity === "warning") ? "warning" : "healthy",
    counts,
    metrics: {
      missingCovers,
      missingThumbs,
      legacyIdentity,
      legacyAudioLinks,
      trashItems: arr(trash.items).length,
      referencedObjects: objectKeys.size
    },
    issues,
    optimizationCandidates,
    objectKeys: [...objectKeys]
  };
}

async function payload(aws) {
  const [data, trash, backups] = await Promise.all([loadCatalogPair(aws), loadTrash(aws), listBackups(aws)]);
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    health: staticHealth(data, trash),
    backups,
    trash: arr(trash.items).map(item => ({
      id: item.id,
      type: item.type,
      scope: item.scope,
      seriesId: item.seriesId,
      title: item.title,
      subtitle: item.subtitle || "",
      removedAt: item.removedAt
    }))
  };
}

async function checkObjectBatch(aws, keys) {
  const list = [...new Set(arr(keys).map(key => clean(key, 900)).filter(key => validObjectKey(key)))].slice(0, 30);
  const results = new Array(list.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(8, list.length) }, async () => {
    while (cursor < list.length) {
      const index = cursor++;
      const key = list[index];
      try { results[index] = { key, exists: await headObject(aws, key) }; }
      catch (error) { results[index] = { key, exists: false, error: String(error?.message || error) }; }
    }
  });
  await Promise.all(workers);
  return { checked: results.length, missing: results.filter(item => !item?.exists) };
}

function activeObjectKeys(data) {
  const keys = new Set();
  for (const { series } of allSeries(data)) for (const key of seriesObjectKeys(series)) keys.add(key);
  return keys;
}

export async function onRequestGet({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  try { return json(await payload(writeClient(env))); }
  catch (error) {
    console.error("Garden Maintenance read failed", error);
    return json({ ok: false, error: "Could not load Garden Maintenance", detail: String(error?.message || error) }, 502);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  let input;
  try { input = await request.json(); }
  catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }

  const action = clean(input.action, 80);
  try {
    const aws = writeClient(env);

    if (action === "check-objects") {
      return json({ ok: true, ...(await checkObjectBatch(aws, input.keys)) });
    }

    if (action === "create-backup") {
      const data = await loadCatalogPair(aws);
      const backup = await snapshotCatalogs(aws, data.main, data.adult, clean(input.reason, 120) || "manual-backup");
      return json({ ...(await payload(aws)), createdBackup: backup });
    }

    if (action === "restore-backup") {
      const id = clean(input.id, 160);
      const backup = await loadBackup(aws, id);
      if (!backup) return json({ ok: false, error: "Backup not found" }, 404);
      const current = await loadCatalogPair(aws);
      await snapshotCatalogs(aws, current.main, current.adult, `pre-restore-${id.slice(0, 24)}`);
      await saveCatalogPair(aws, clone(backup.main), clone(backup.adult));
      await invalidateCatalogCache(request);
      return json({ ...(await payload(aws)), restoredBackup: id });
    }

    if (action === "apply-cover-optimizations") {
      const updates = arr(input.updates).slice(0, 250);
      if (!updates.length) return json({ ok: false, error: "No cover updates were supplied" }, 400);
      const data = await loadCatalogPair(aws);
      const valid = [];
      for (const update of updates) {
        const scope = update.scope === "adult" ? "adult" : "main";
        const seriesId = clean(update.seriesId, 180);
        const coverKey = clean(update.coverKey, 900);
        const coverThumbKey = clean(update.coverThumbKey, 900);
        if (!validObjectKey(coverKey, ["shadow-garden/covers/"]) || !validObjectKey(coverThumbKey, ["shadow-garden/covers/"])) continue;
        const found = findSeries(data, scope, seriesId);
        if (!found) continue;
        valid.push({ update, found, coverKey, coverThumbKey });
      }
      if (!valid.length) return json({ ok: false, error: "None of the cover updates still matched the catalog" }, 409);

      await snapshotCatalogs(aws, data.main, data.adult, "bulk-cover-optimization");
      let applied = 0;
      for (const item of valid) {
        const { update, found, coverKey, coverThumbKey } = item;
        const detail = `/media/${coverKey}`;
        const thumb = `/media/${coverThumbKey}`;
        const series = found.series;
        const hasVolumeIndex = update.volumeIndex !== null && update.volumeIndex !== undefined && Number.isInteger(Number(update.volumeIndex));
        let volume = null;
        if (update.volumeFile) volume = arr(series.volumes).find(entry => entry.file === update.volumeFile) || null;
        if (!volume && hasVolumeIndex) volume = arr(series.volumes)[Number(update.volumeIndex)] || null;
        if (volume) {
          const oldCover = volume.cover || "";
          const oldThumb = volume.coverThumb || "";
          const seriesUsesCover = !series.cover || series.cover === oldCover;
          const seriesUsesThumb = !series.coverThumb || series.coverThumb === oldThumb;
          volume.cover = detail;
          volume.coverThumb = thumb;
          if (seriesUsesCover) {
            series.cover = detail;
            if (seriesUsesThumb) series.coverThumb = thumb;
          }
        } else if (!hasVolumeIndex) {
          series.cover = detail;
          series.coverThumb = thumb;
        } else continue;
        applied++;
      }
      if (!applied) return json({ ok: false, error: "Cover targets changed before the update could be applied" }, 409);
      await saveCatalogPair(aws, data.main, data.adult);
      await invalidateCatalogCache(request);
      return json({ ...(await payload(aws)), optimized: applied });
    }

    if (action === "restore-trash") {
      const id = clean(input.id, 160);
      const [data, trash] = await Promise.all([loadCatalogPair(aws), loadTrash(aws)]);
      const index = arr(trash.items).findIndex(item => item.id === id);
      if (index < 0) return json({ ok: false, error: "Trash item not found" }, 404);
      const item = trash.items[index];
      const scope = item.scope === "adult" ? "adult" : "main";
      const otherScope = scope === "adult" ? "main" : "adult";
      const target = scope === "adult" ? data.adult : data.main;
      const other = otherScope === "adult" ? data.adult : data.main;
      const seriesId = clean(item.seriesId, 180);

      if (item.type === "series") {
        const restored = clone(item.payload?.series);
        if (!restored?.id) return json({ ok: false, error: "Trash entry is incomplete" }, 409);
        if (arr(target.series).some(series => series.id === restored.id) || arr(other.series).some(series => series.id === restored.id)) {
          return json({ ok: false, error: "A series with this id already exists. Restore a catalog backup or resolve the conflict first." }, 409);
        }
        await snapshotCatalogs(aws, data.main, data.adult, "restore-trash-series");
        target.series.push(restored);
      } else if (item.type === "volume") {
        const volume = clone(item.payload?.volume);
        const seriesMeta = clone(item.payload?.series);
        if (!volume?.file || !seriesMeta?.id) return json({ ok: false, error: "Trash entry is incomplete" }, 409);
        if (arr(other.series).some(series => series.id === seriesMeta.id)) return json({ ok: false, error: "The series currently exists on the other shelf." }, 409);
        let series = arr(target.series).find(entry => entry.id === seriesMeta.id);
        if (series) {
          const conflict = arr(series.volumes).some(entry => entry.file === volume.file || (Number(entry.number) === Number(volume.number) && Number.isFinite(Number(volume.number))));
          if (conflict) return json({ ok: false, error: "That volume already exists in the restored series." }, 409);
        }
        await snapshotCatalogs(aws, data.main, data.adult, "restore-trash-volume");
        if (!series) {
          series = { ...seriesMeta, volumes: [] };
          target.series.push(series);
        }
        series.volumes.push(volume);
        series.volumes.sort((a, b) => (Number(a.number) || 9999) - (Number(b.number) || 9999) || String(a.title || "").localeCompare(String(b.title || "")));
        if (!series.cover && volume.cover) series.cover = volume.cover;
        if (!series.coverThumb && volume.coverThumb) series.coverThumb = volume.coverThumb;
      } else return json({ ok: false, error: "Unknown Trash entry type" }, 409);

      trash.items.splice(index, 1);
      await Promise.all([saveCatalogPair(aws, data.main, data.adult), saveTrash(aws, trash)]);
      await invalidateCatalogCache(request);
      return json({ ...(await payload(aws)), restoredTrash: id, seriesId });
    }

    if (action === "purge-trash") {
      const requested = arr(input.ids).map(value => clean(value, 160)).filter(Boolean);
      const [data, trash] = await Promise.all([loadCatalogPair(aws), loadTrash(aws)]);
      const selected = requested.length ? arr(trash.items).filter(item => requested.includes(item.id)) : arr(trash.items);
      if (!selected.length) return json({ ...(await payload(aws)), purged: 0, deletedObjects: 0 });
      const selectedIds = new Set(selected.map(item => item.id));
      const remaining = arr(trash.items).filter(item => !selectedIds.has(item.id));
      const keep = activeObjectKeys(data);
      for (const item of remaining) for (const key of trashItemKeys(item)) keep.add(key);
      const remove = new Set();
      for (const item of selected) for (const key of trashItemKeys(item)) if (!keep.has(key)) remove.add(key);
      let deletedObjects = 0;
      for (const key of remove) {
        await deleteObject(aws, key);
        deletedObjects++;
      }
      trash.items = remaining;
      await saveTrash(aws, trash);
      return json({ ...(await payload(aws)), purged: selected.length, deletedObjects });
    }

    return json({ ok: false, error: "Unknown maintenance action" }, 400);
  } catch (error) {
    console.error("Garden Maintenance action failed", action, error);
    return json({ ok: false, error: "Garden Maintenance action failed", detail: String(error?.message || error) }, 502);
  }
}
