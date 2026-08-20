import { adminAuthorized, getTextObject, json, putObject, validObjectKey, writeClient } from "../_lib/b2.js";

const MAIN_KEY = "shadow-garden/data/catalog.json";
const ADULT_KEY = "shadow-garden/data/adult-catalog.json";
const arr = value => Array.isArray(value) ? value : [];
const slug = value => String(value || "untitled")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "untitled";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function uniqueTags(value) {
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

async function loadCatalog(aws, key) {
  const text = await getTextObject(aws, key);
  if (!text) return { generatedAt: new Date().toISOString(), series: [] };
  try {
    const parsed = JSON.parse(text);
    return { generatedAt: parsed.generatedAt || new Date().toISOString(), series: arr(parsed.series) };
  } catch {
    throw new Error(`${key} contains invalid JSON`);
  }
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

export async function onRequestPost({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);

  let input;
  try { input = await request.json(); }
  catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }

  const adult = Boolean(input.adult);
  const seriesName = clean(input.series, 240);
  const title = clean(input.title, 300);
  const author = clean(input.author, 240);
  const epubKey = clean(input.epubKey, 700);
  const coverKey = clean(input.coverKey, 700);
  const coverThumbKey = clean(input.coverThumbKey, 700);
  const description = clean(input.description, 12000);
  const language = clean(input.language, 40);
  const publisher = clean(input.publisher, 240);
  const date = clean(input.date, 40);
  const status = clean(input.status, 80);
  const tags = uniqueTags(input.tags);
  const size = Math.max(0, Number(input.size) || 0);
  const audioAlignedUrl = externalUrl(input.audioAlignedUrl);
  let number = Number(input.number);
  if (!Number.isFinite(number) || number <= 0) number = 9999;

  if (!seriesName || !title) return json({ ok: false, error: "Series and title are required" }, 400);
  if (!validObjectKey(epubKey, ["shadow-garden/books/"]) || !epubKey.endsWith(".epub")) {
    return json({ ok: false, error: "Invalid EPUB key" }, 400);
  }
  if (coverKey && !validObjectKey(coverKey, ["shadow-garden/covers/"])) {
    return json({ ok: false, error: "Invalid cover key" }, 400);
  }
  if (coverThumbKey && !validObjectKey(coverThumbKey, ["shadow-garden/covers/"])) {
    return json({ ok: false, error: "Invalid cover thumbnail key" }, 400);
  }
  if (audioAlignedUrl === null) return json({ ok: false, error: "Audio-aligned EPUB URL must use http:// or https://" }, 400);

  try {
    const aws = writeClient(env);
    const [main, restricted] = await Promise.all([loadCatalog(aws, MAIN_KEY), loadCatalog(aws, ADULT_KEY)]);
    const target = adult ? restricted : main;
    const sid = `${adult ? "adult-" : ""}${slug(seriesName)}`;
    let series = target.series.find(item => item.id === sid);
    const cover = coverKey ? `/media/${coverKey}` : "";
    const coverThumb = coverThumbKey ? `/media/${coverThumbKey}` : "";
    const year = Number(input.year) || Number.parseInt(date.slice(0, 4)) || "";

    if (!series) {
      series = {
        id: sid,
        title: seriesName,
        author,
        year,
        status,
        description,
        tags,
        cover,
        coverThumb,
        nsfw: adult,
        volumes: []
      };
      target.series.push(series);
    } else {
      series.title = seriesName || series.title;
      series.author = author || series.author;
      series.year = year || series.year;
      series.status = status || series.status;
      series.description = description || series.description;
      series.tags = [...new Set([...arr(series.tags), ...tags])];
    }

    const volume = {
      title,
      number,
      file: `/media/${epubKey}`,
      cover,
      coverThumb,
      author,
      language,
      date,
      size,
      added: new Date().toISOString().slice(0, 10),
      publisher,
      description,
      audioAlignedUrl
    };

    const existing = arr(series.volumes).findIndex(v =>
      (number !== 9999 && Number(v.number) === number) || String(v.title || "") === title
    );

    if (existing >= 0) {
      const previous = series.volumes[existing];
      const previousWasSeriesCover = Boolean(previous?.cover && series.cover === previous.cover);
      const previousWasSeriesThumb = Boolean(previous?.coverThumb && series.coverThumb === previous.coverThumb);
      series.volumes[existing] = volume;
      if (previousWasSeriesCover && cover) series.cover = cover;
      if ((previousWasSeriesThumb || previousWasSeriesCover) && coverThumb) series.coverThumb = coverThumb;
    } else {
      series.volumes.push(volume);
    }

    series.volumes.sort((a, b) => (Number(a.number) || 9999) - (Number(b.number) || 9999) || String(a.title).localeCompare(String(b.title)));
    if (!series.cover && cover) {
      series.cover = cover;
      series.coverThumb = coverThumb;
    } else if (!series.coverThumb && series.cover === cover && coverThumb) {
      series.coverThumb = coverThumb;
    }

    await Promise.all([saveCatalog(aws, MAIN_KEY, main), saveCatalog(aws, ADULT_KEY, restricted)]);
    await invalidatePublicCatalogCache(request);
    return json({ ok: true, seriesId: sid, series: series.title, volume: title, file: volume.file, cover: volume.cover, coverThumb: volume.coverThumb });
  } catch (error) {
    console.error("Catalog update failed", error);
    return json({ ok: false, error: "Catalog update failed", detail: String(error?.message || error) }, 502);
  }
}
