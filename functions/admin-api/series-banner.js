import { adminAuthorized, getTextObject, json, putObject, writeClient } from "../_lib/b2.js";
import { volumeBookId } from "../_lib/book-id.js";
import { snapshotCatalogs } from "../_lib/garden-maintenance.js";

const MAIN_KEY = "shadow-garden/data/catalog.json";
const ADULT_KEY = "shadow-garden/data/adult-catalog.json";
const arr = value => Array.isArray(value) ? value : [];
const clean = (value, max = 1000) => String(value ?? "").trim().slice(0, max);

async function loadCatalog(aws, key) {
  const text = await getTextObject(aws, key);
  if (!text) return { generatedAt: new Date().toISOString(), series: [] };
  const value = JSON.parse(text);
  return { generatedAt: value.generatedAt || new Date().toISOString(), series: arr(value.series) };
}

async function loadPair(aws) {
  const [main, adult] = await Promise.all([loadCatalog(aws, MAIN_KEY), loadCatalog(aws, ADULT_KEY)]);
  return { main, adult };
}

function locate(data, id) {
  const mainIndex = data.main.series.findIndex(series => series?.id === id);
  if (mainIndex >= 0) return { catalog: data.main, key: MAIN_KEY, index: mainIndex };
  const adultIndex = data.adult.series.findIndex(series => series?.id === id);
  if (adultIndex >= 0) return { catalog: data.adult, key: ADULT_KEY, index: adultIndex };
  return null;
}

async function choicesFor(series) {
  const choices = [];
  for (const [index, volume] of arr(series?.volumes).entries()) {
    const bookId = await volumeBookId(volume);
    if (!bookId) continue;
    const cover = String(volume?.cover || volume?.coverThumb || "");
    choices.push({
      bookId,
      number: volume?.number ?? index + 1,
      title: String(volume?.title || `Volume ${index + 1}`),
      cover
    });
  }
  return choices;
}

async function saveCatalog(aws, key, catalog) {
  catalog.generatedAt = new Date().toISOString();
  catalog.series = arr(catalog.series).sort((a, b) => String(a?.title || "").localeCompare(String(b?.title || "")));
  await putObject(aws, key, JSON.stringify(catalog, null, 2), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30, stale-while-revalidate=120"
  });
}

async function invalidateCatalogCache(request) {
  try {
    const origin = new URL(request.url).origin;
    const cache = caches.default;
    await Promise.all([MAIN_KEY, ADULT_KEY].map(key => cache.delete(new Request(`${origin}/media/${key}`))));
  } catch (error) {
    console.warn("Series banner catalog cache invalidation skipped", error);
  }
}

export async function onRequestGet({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const id = clean(new URL(request.url).searchParams.get("id"), 180);
  if (!id) return json({ ok: false, error: "Series id is required" }, 400);
  try {
    const aws = writeClient(env);
    const data = await loadPair(aws);
    const found = locate(data, id);
    if (!found) return json({ ok: false, error: "Series not found" }, 404);
    const series = found.catalog.series[found.index];
    const choices = await choicesFor(series);
    const allowed = new Set(choices.map(choice => choice.bookId));
    const current = allowed.has(String(series?.bannerBookId || "")) ? String(series.bannerBookId) : "";
    return json({ ok: true, id: series.id, current, choices });
  } catch (error) {
    console.error("Series banner read failed", error);
    return json({ ok: false, error: "Could not load series banner options", detail: String(error?.message || error) }, 502);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  let input;
  try { input = await request.json(); }
  catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }
  const id = clean(input?.id, 180);
  const bannerBookId = clean(input?.bannerBookId, 80);
  if (!id) return json({ ok: false, error: "Series id is required" }, 400);

  try {
    const aws = writeClient(env);
    const data = await loadPair(aws);
    const found = locate(data, id);
    if (!found) return json({ ok: false, error: "Series not found" }, 404);
    const series = found.catalog.series[found.index];
    const choices = await choicesFor(series);
    const allowed = new Set(choices.map(choice => choice.bookId));
    if (bannerBookId && !allowed.has(bannerBookId)) {
      return json({ ok: false, error: "Banner must use a current volume cover" }, 400);
    }

    await snapshotCatalogs(aws, data.main, data.adult, "update-series-banner");
    if (bannerBookId) series.bannerBookId = bannerBookId;
    else delete series.bannerBookId;
    await saveCatalog(aws, found.key, found.catalog);
    await invalidateCatalogCache(request);
    return json({ ok: true, id: series.id, bannerBookId: bannerBookId || "", choices });
  } catch (error) {
    console.error("Series banner update failed", error);
    return json({ ok: false, error: "Could not update series banner", detail: String(error?.message || error) }, 502);
  }
}
