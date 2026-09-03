/* Shadow Garden v2.9 — atomic Keeper cover + banner catalog updates. */
import { volumeBookId } from "../_lib/book-id.js";
import { requireAdmin } from "./auth.js";
import {
  invalidateCatalogCache, loadCatalogPair, locateSeries, managementShape,
  saveCatalogPair, snapshotCatalogs
} from "./catalog.js";
import { json, parseJson } from "./http.js";
import { validObjectKey, writeClient } from "./storage.js";
import { arr, clean } from "./validation.js";

const MAX_UPDATES = 100;
const hasOwn = (value, key) => Boolean(value && Object.prototype.hasOwnProperty.call(value, key));

async function bannerIds(series) {
  const ids = new Set();
  for (const volume of arr(series?.volumes)) {
    const id = await volumeBookId(volume);
    if (id) ids.add(id);
  }
  return ids;
}

export async function buildArtworkPlan(data, supplied) {
  const updates = arr(supplied);
  if (!updates.length) return { ok: false, status: 400, error: "No artwork updates were supplied" };
  if (updates.length > MAX_UPDATES) return { ok: false, status: 413, error: `Artwork batches are limited to ${MAX_UPDATES} series` };

  const seen = new Set(), plan = [];
  for (const input of updates) {
    const seriesId = clean(input?.seriesId, 180), scope = input?.scope === "adult" ? "adult" : "main";
    if (!seriesId) return { ok: false, status: 400, error: "Every artwork update requires a series id" };
    if (seen.has(seriesId)) return { ok: false, status: 400, error: `Series ${seriesId} appears more than once in the artwork batch` };
    seen.add(seriesId);

    const found = locateSeries(data, seriesId);
    if (!found || (found.adult ? "adult" : "main") !== scope) return { ok: false, status: 409, error: `Series ${seriesId} no longer matches the selected shelf` };

    const coverKey = clean(input?.coverKey, 900), coverThumbKey = clean(input?.coverThumbKey, 900), hasCover = Boolean(coverKey || coverThumbKey);
    let cover = null;
    if (hasCover) {
      if (!validObjectKey(coverKey, ["shadow-garden/covers/"]) || !validObjectKey(coverThumbKey, ["shadow-garden/covers/"])) {
        return { ok: false, status: 400, error: `Series ${seriesId} has an invalid cover object key` };
      }
      const target = input?.coverTarget === "volume" ? "volume" : "series";
      if (target === "volume") {
        const volumeFile = clean(input?.volumeFile, 900), volume = arr(found.series?.volumes).find(item => String(item?.file || "") === volumeFile) || null;
        if (!volumeFile || !volume) return { ok: false, status: 409, error: `A selected volume in ${seriesId} no longer exists` };
        cover = { target, volume, coverKey, coverThumbKey };
      } else cover = { target: "series", volume: null, coverKey, coverThumbKey };
    }

    const hasBanner = hasOwn(input, "bannerBookId");
    let bannerBookId = "";
    if (hasBanner) {
      bannerBookId = clean(input?.bannerBookId, 80);
      if (bannerBookId && !(await bannerIds(found.series)).has(bannerBookId)) {
        return { ok: false, status: 409, error: `A selected banner volume in ${seriesId} is no longer available` };
      }
    }

    if (!cover && !hasBanner) continue;
    plan.push({ found, seriesId, scope, cover, hasBanner, bannerBookId });
  }

  if (!plan.length) return { ok: false, status: 400, error: "No cover or banner changes were supplied" };
  return { ok: true, plan };
}

export function applyArtworkPlan(plan) {
  let covers = 0, banners = 0;
  for (const item of arr(plan)) {
    const series = item.found.series;
    if (item.cover) {
      const detail = `/media/${item.cover.coverKey}`, thumb = `/media/${item.cover.coverThumbKey}`;
      if (item.cover.target === "volume") {
        const volume = item.cover.volume, oldCover = String(volume.cover || ""), seriesUsesCover = !series.cover || series.cover === oldCover;
        volume.cover = detail; volume.coverThumb = thumb;
        if (seriesUsesCover) { series.cover = detail; series.coverThumb = thumb; }
      } else {
        series.cover = detail; series.coverThumb = thumb;
      }
      covers++;
    }
    if (item.hasBanner) {
      if (item.bannerBookId) series.bannerBookId = item.bannerBookId;
      else delete series.bannerBookId;
      banners++;
    }
  }
  return { covers, banners, series: arr(plan).length };
}

export async function handleArtworkPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await parseJson(request); if (!body.ok) return json({ ok: false, error: "Invalid JSON body" }, 400);

  try {
    const aws = writeClient(env), data = await loadCatalogPair(aws), planned = await buildArtworkPlan(data, body.value?.updates);
    if (!planned.ok) return json({ ok: false, error: planned.error }, planned.status);

    /* Validate the entire batch before the safety snapshot or any catalog mutation. Uploaded cover
       objects are immutable/new; only these references change the live library. */
    await snapshotCatalogs(aws, data.main, data.adult, "bulk-artwork-update");
    const applied = applyArtworkPlan(planned.plan);
    await saveCatalogPair(aws, data.main, data.adult);
    await invalidateCatalogCache(request);
    return json({ ...managementShape(data), updatedArtwork: applied });
  } catch (error) {
    console.error("Bulk artwork update failed", error);
    return json({ ok: false, error: "Could not update library artwork", detail: String(error?.message || error) }, 502);
  }
}
