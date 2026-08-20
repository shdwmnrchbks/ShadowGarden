import { adminAuthorized, getTextObject, json, putObject, validObjectKey, writeClient } from "../_lib/b2.js";
import { appendTrashItem, snapshotCatalogs } from "../_lib/garden-maintenance.js";

const MAIN_KEY = "shadow-garden/data/catalog.json";
const ADULT_KEY = "shadow-garden/data/adult-catalog.json";
const arr = value => Array.isArray(value) ? value : [];
const clone = value => JSON.parse(JSON.stringify(value));

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function tags(value) {
  return [...new Set(arr(value).map(v => clean(v, 80)).filter(Boolean))].slice(0, 40);
}

function externalUrl(value) {
  const raw = clean(value, 2000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function mediaKey(value) {
  const text = String(value || "");
  const prefix = "/media/";
  if (!text.startsWith(prefix)) return "";
  const key = decodeURIComponent(text.slice(prefix.length));
  return validObjectKey(key) ? key : "";
}

async function loadCatalog(aws, key) {
  const text = await getTextObject(aws, key);
  if (!text) return { generatedAt: new Date().toISOString(), series: [] };
  const parsed = JSON.parse(text);
  return { generatedAt: parsed.generatedAt || new Date().toISOString(), series: arr(parsed.series) };
}

async function saveCatalog(aws, key, catalog) {
  catalog.generatedAt = new Date().toISOString();
  catalog.series = arr(catalog.series).sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  await putObject(aws, key, JSON.stringify(catalog, null, 2), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30, stale-while-revalidate=120"
  });
}

async function invalidatePublicCatalogCache(request) {
  try {
    const cache = caches.default;
    const origin = new URL(request.url).origin;
    await Promise.all([MAIN_KEY, ADULT_KEY].map(key => cache.delete(new Request(`${origin}/media/${key}`))));
  } catch (error) {
    console.warn("Public catalog cache invalidation skipped", error);
  }
}

async function catalogs(aws) {
  const [main, adult] = await Promise.all([loadCatalog(aws, MAIN_KEY), loadCatalog(aws, ADULT_KEY)]);
  return { main, adult };
}

function locate(data, id) {
  const mainIndex = data.main.series.findIndex(s => s.id === id);
  if (mainIndex >= 0) return { catalog: data.main, key: MAIN_KEY, index: mainIndex, adult: false };
  const adultIndex = data.adult.series.findIndex(s => s.id === id);
  if (adultIndex >= 0) return { catalog: data.adult, key: ADULT_KEY, index: adultIndex, adult: true };
  return null;
}

function publicShape(data) {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    main: arr(data.main.series),
    adult: arr(data.adult.series),
    counts: {
      series: arr(data.main.series).length + arr(data.adult.series).length,
      volumes: [...arr(data.main.series), ...arr(data.adult.series)].reduce((n, s) => n + arr(s.volumes).length, 0),
      mainSeries: arr(data.main.series).length,
      adultSeries: arr(data.adult.series).length
    }
  };
}

export async function onRequestGet({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  try {
    const aws = writeClient(env);
    return json(publicShape(await catalogs(aws)));
  } catch (error) {
    console.error("Library management read failed", error);
    return json({ ok: false, error: "Could not load library", detail: String(error?.message || error) }, 502);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  let input;
  try { input = await request.json(); }
  catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }

  const action = clean(input.action, 40);
  const id = clean(input.id, 180);
  if (!action || !id) return json({ ok: false, error: "Action and series id are required" }, 400);

  try {
    const aws = writeClient(env);
    const data = await catalogs(aws);
    const found = locate(data, id);
    if (!found) return json({ ok: false, error: "Series not found" }, 404);
    const series = found.catalog.series[found.index];

    if (action === "update-series") {
      const audioAlignedUrl = externalUrl(input.audioAlignedUrl);
      if (audioAlignedUrl === null) return json({ ok: false, error: "Audio-aligned EPUB folder URL must use http:// or https://" }, 400);
      await snapshotCatalogs(aws, data.main, data.adult, "update-series");

      series.title = clean(input.title, 300) || series.title;
      series.author = clean(input.author, 240);
      series.year = Number(input.year) || "";
      series.status = clean(input.status, 80);
      series.description = clean(input.description, 12000);
      series.tags = tags(input.tags);
      series.audioAlignedUrl = audioAlignedUrl;
      for (const volume of arr(series.volumes)) delete volume.audioAlignedUrl;

      const requestedAdult = Boolean(input.adult);
      if (requestedAdult !== found.adult) {
        found.catalog.series.splice(found.index, 1);
        series.nsfw = requestedAdult;
        series.id = requestedAdult ? (String(series.id).startsWith("adult-") ? series.id : `adult-${series.id}`) : String(series.id).replace(/^adult-/, "");
        const destination = requestedAdult ? data.adult : data.main;
        if (destination.series.some(s => s.id === series.id)) return json({ ok: false, error: "A series with the target id already exists" }, 409);
        destination.series.push(series);
      }
      await Promise.all([saveCatalog(aws, MAIN_KEY, data.main), saveCatalog(aws, ADULT_KEY, data.adult)]);
      await invalidatePublicCatalogCache(request);
      return json({ ...publicShape(data), changedId: series.id });
    }

    if (action === "update-volume") {
      const volumeIndex = Number(input.volumeIndex);
      if (!Number.isInteger(volumeIndex) || volumeIndex < 0 || volumeIndex >= arr(series.volumes).length) return json({ ok: false, error: "Volume not found" }, 404);
      const volume = series.volumes[volumeIndex];
      const number = Number(input.number);
      await snapshotCatalogs(aws, data.main, data.adult, "update-volume");

      if (!series.audioAlignedUrl) {
        series.audioAlignedUrl = arr(series.volumes).find(v => v.audioAlignedUrl)?.audioAlignedUrl || "";
      }
      for (const item of arr(series.volumes)) delete item.audioAlignedUrl;

      volume.title = clean(input.title, 300) || volume.title;
      volume.number = Number.isFinite(number) && number > 0 ? number : volume.number;
      volume.date = clean(input.date, 40);
      volume.publisher = clean(input.publisher, 240);
      volume.description = clean(input.description, 12000);
      series.volumes.sort((a, b) => (Number(a.number) || 9999) - (Number(b.number) || 9999) || String(a.title || "").localeCompare(String(b.title || "")));
      await saveCatalog(aws, found.key, found.catalog);
      await invalidatePublicCatalogCache(request);
      return json(publicShape(data));
    }

    if (action === "delete-volume") {
      const volumeIndex = Number(input.volumeIndex);
      if (!Number.isInteger(volumeIndex) || volumeIndex < 0 || volumeIndex >= arr(series.volumes).length) return json({ ok: false, error: "Volume not found" }, 404);
      await snapshotCatalogs(aws, data.main, data.adult, "trash-volume");
      const originalSeries = clone(series);
      const [volume] = series.volumes.splice(volumeIndex, 1);

      if (!series.volumes.length) {
        found.catalog.series.splice(found.index, 1);
      } else {
        if (series.cover === volume.cover) series.cover = series.volumes.find(v => v.cover)?.cover || "";
        if (series.coverThumb === volume.coverThumb) series.coverThumb = series.volumes.find(v => v.coverThumb)?.coverThumb || "";
      }

      const seriesMeta = { ...originalSeries, volumes: [] };
      await appendTrashItem(aws, {
        type: "volume",
        scope: found.adult ? "adult" : "main",
        seriesId: originalSeries.id,
        title: volume.title || `Volume ${volume.number ?? volumeIndex + 1}`,
        subtitle: originalSeries.title || "Untitled series",
        payload: { series: seriesMeta, volume: clone(volume), volumeIndex }
      });

      await saveCatalog(aws, found.key, found.catalog);
      await invalidatePublicCatalogCache(request);
      return json({ ...publicShape(data), trashed: true });
    }

    if (action === "delete-series") {
      await snapshotCatalogs(aws, data.main, data.adult, "trash-series");
      const removed = clone(series);
      await appendTrashItem(aws, {
        type: "series",
        scope: found.adult ? "adult" : "main",
        seriesId: removed.id,
        title: removed.title || "Untitled series",
        subtitle: `${arr(removed.volumes).length} ${arr(removed.volumes).length === 1 ? "volume" : "volumes"}`,
        payload: { series: removed }
      });
      found.catalog.series.splice(found.index, 1);
      await saveCatalog(aws, found.key, found.catalog);
      await invalidatePublicCatalogCache(request);
      return json({ ...publicShape(data), trashed: true });
    }

    return json({ ok: false, error: "Unknown management action" }, 400);
  } catch (error) {
    console.error("Library management mutation failed", error);
    return json({ ok: false, error: "Library update failed", detail: String(error?.message || error) }, 502);
  }
}
