import { adminAuthorized, getTextObject, json, putObject, validObjectKey, writeClient } from "../_lib/b2.js";
import { bookIdForFile, isBookId } from "../_lib/book-id.js";
import { snapshotCatalogs } from "../_lib/garden-maintenance.js";
import { canonicalizeSeriesStatus, normalizeSeriesStatus, withSeriesStatusTag } from "../_lib/series-status.js";

const MAIN_KEY = "shadow-garden/data/catalog.json";
const ADULT_KEY = "shadow-garden/data/adult-catalog.json";
const arr = value => Array.isArray(value) ? value : [];
const slug = value => String(value || "untitled")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "untitled";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
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

function safeHash(value) {
  const hash = clean(value, 128).toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : "";
}

function sameText(a, b) {
  return clean(a, 500).toLowerCase() === clean(b, 500).toLowerCase();
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

function duplicateIndex(series, { number, title, sha256, originalFilename, replaceTargetFile }) {
  const volumes = arr(series?.volumes);
  if (replaceTargetFile) {
    return volumes.findIndex(volume => String(volume.file || "") === replaceTargetFile);
  }
  return volumes.findIndex(volume =>
    (sha256 && volume.sha256 && String(volume.sha256).toLowerCase() === sha256) ||
    (originalFilename && volume.originalFilename && sameText(volume.originalFilename, originalFilename)) ||
    (number !== 9999 && Number(volume.number) === number) ||
    sameText(volume.title, title)
  );
}

export async function onRequestPost({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);

  let input;
  try { input = await request.json(); }
  catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }

  const adult = Boolean(input.adult);
  const seriesName = clean(input.series, 240);
  const targetSeriesId = clean(input.targetSeriesId, 180);
  const title = clean(input.title, 300);
  const author = clean(input.author, 240);
  const epubKey = clean(input.epubKey, 700);
  const coverKey = clean(input.coverKey, 700);
  const coverThumbKey = clean(input.coverThumbKey, 700);
  const description = clean(input.description, 12000);
  const language = clean(input.language, 40);
  const publisher = clean(input.publisher, 240);
  const date = clean(input.date, 40);
  const rawStatus = clean(input.status, 80);
  const requestedStatus = normalizeSeriesStatus(rawStatus);
  const incomingTags = arr(input.tags).map(value => clean(value, 80)).filter(Boolean);
  const size = Math.max(0, Number(input.size) || 0);
  const audioAlignedUrl = externalUrl(input.audioAlignedUrl);
  const sha256 = safeHash(input.sha256);
  const originalFilename = clean(input.originalFilename, 500);
  const replaceTargetFile = clean(input.replaceTargetFile, 1000);
  const duplicatePolicy = ["reject", "replace", "separate"].includes(input.duplicatePolicy) ? input.duplicatePolicy : "replace";
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
  if (audioAlignedUrl === null) return json({ ok: false, error: "Audio-aligned EPUB folder URL must use http:// or https://" }, 400);
  if (replaceTargetFile && !replaceTargetFile.startsWith("/media/shadow-garden/books/")) {
    return json({ ok: false, error: "Invalid replacement target" }, 400);
  }

  try {
    const aws = writeClient(env);
    const [main, restricted] = await Promise.all([loadCatalog(aws, MAIN_KEY), loadCatalog(aws, ADULT_KEY)]);
    const target = adult ? restricted : main;
    let sid = `${adult ? "adult-" : ""}${slug(seriesName)}`;
    let series;

    if (targetSeriesId) {
      series = target.series.find(item => item.id === targetSeriesId);
      if (!series) {
        return json({ ok: false, error: "Target series no longer exists on this shelf. Refresh Garden Keeper and try again." }, 409);
      }
      sid = series.id;
    } else {
      series = target.series.find(item => item.id === sid);
    }

    const cover = coverKey ? `/media/${coverKey}` : "";
    const coverThumb = coverThumbKey ? `/media/${coverThumbKey}` : "";
    const year = Number(input.year) || Number.parseInt(date.slice(0, 4)) || "";

    let existing = -1;
    if (series) {
      existing = duplicateIndex(series, { number, title, sha256, originalFilename, replaceTargetFile });
    }

    if (duplicatePolicy === "replace" && replaceTargetFile && existing < 0) {
      return json({ ok: false, error: "Replacement target no longer exists", duplicate: true }, 409);
    }
    if (duplicatePolicy === "reject" && existing >= 0) {
      const duplicate = series.volumes[existing];
      return json({
        ok: false,
        error: "Duplicate volume detected",
        duplicate: true,
        seriesId: sid,
        volumeIndex: existing,
        volume: duplicate
      }, 409);
    }

    await snapshotCatalogs(aws, main, restricted, duplicatePolicy === "replace" && existing >= 0 ? "replace-volume" : "add-volume");

    if (!series) {
      series = {
        id: sid,
        title: seriesName,
        author,
        year,
        status: requestedStatus,
        description,
        tags: withSeriesStatusTag(incomingTags, requestedStatus),
        cover,
        coverThumb,
        audioAlignedUrl,
        nsfw: adult,
        volumes: []
      };
      target.series.push(series);
    } else {
      canonicalizeSeriesStatus(series);
      if (!targetSeriesId) {
        series.title = seriesName || series.title;
        series.author = author || series.author;
        series.year = year || series.year;
        if (rawStatus) series.status = requestedStatus;
        series.description = description || series.description;
        series.tags = withSeriesStatusTag([...arr(series.tags), ...incomingTags], series.status);
      }
      const legacyAudioUrl = arr(series.volumes).find(volume => volume.audioAlignedUrl)?.audioAlignedUrl || "";
      if (!series.audioAlignedUrl && legacyAudioUrl) series.audioAlignedUrl = legacyAudioUrl;
      if (audioAlignedUrl) series.audioAlignedUrl = audioAlignedUrl;
    }

    canonicalizeSeriesStatus(series);

    const previous = existing >= 0 ? series.volumes[existing] : null;
    const replacing = duplicatePolicy === "replace" && existing >= 0;
    const file = `/media/${epubKey}`;
    const bookId = replacing
      ? (isBookId(previous?.bookId) ? previous.bookId : await bookIdForFile(previous?.file || file))
      : await bookIdForFile(file);
    const volume = {
      title,
      number,
      file,
      ...(bookId ? { bookId } : {}),
      cover: cover || (replacing ? previous?.cover || "" : ""),
      coverThumb: coverThumb || (replacing ? previous?.coverThumb || "" : ""),
      author,
      language,
      date,
      size,
      added: replacing && previous?.added ? previous.added : new Date().toISOString().slice(0, 10),
      publisher,
      description,
      ...(sha256 ? { sha256 } : {}),
      ...(originalFilename ? { originalFilename } : {})
    };

    if (replacing) {
      const previousWasSeriesCover = Boolean(previous?.cover && series.cover === previous.cover);
      const previousWasSeriesThumb = Boolean(previous?.coverThumb && series.coverThumb === previous.coverThumb);
      if (!series.audioAlignedUrl && previous?.audioAlignedUrl) series.audioAlignedUrl = previous.audioAlignedUrl;
      series.volumes[existing] = volume;
      if (previousWasSeriesCover && volume.cover) series.cover = volume.cover;
      if ((previousWasSeriesThumb || previousWasSeriesCover) && volume.coverThumb) series.coverThumb = volume.coverThumb;
    } else {
      series.volumes.push(volume);
    }

    series.volumes.sort((a, b) => (Number(a.number) || 9999) - (Number(b.number) || 9999) || String(a.title).localeCompare(String(b.title)));
    if (!series.cover && volume.cover) {
      series.cover = volume.cover;
      series.coverThumb = volume.coverThumb;
    } else if (!series.coverThumb && series.cover === volume.cover && volume.coverThumb) {
      series.coverThumb = volume.coverThumb;
    }

    await Promise.all([saveCatalog(aws, MAIN_KEY, main), saveCatalog(aws, ADULT_KEY, restricted)]);
    await invalidatePublicCatalogCache(request);
    return json({
      ok: true,
      seriesId: sid,
      series: series.title,
      volume: title,
      file: volume.file,
      bookId: volume.bookId || "",
      cover: volume.cover,
      coverThumb: volume.coverThumb,
      audioAlignedUrl: series.audioAlignedUrl || "",
      duplicatePolicy,
      replaced: replacing,
      targeted: Boolean(targetSeriesId)
    });
  } catch (error) {
    console.error("Catalog update failed", error);
    return json({ ok: false, error: "Catalog update failed", detail: String(error?.message || error) }, 502);
  }
}
