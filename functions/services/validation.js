/* Shadow Garden R6 — canonical request/catalog validation service. */
import { headObject, validObjectKey } from "./storage.js";
import { normalizeTranslationStatus, validateTranslationCredits } from "../_lib/translations.js";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ALLOWED_UPLOAD_PREFIXES = Object.freeze(["shadow-garden/books/", "shadow-garden/covers/"]);
export const OPAQUE_COVER_KEY = /^shadow-garden\/covers\/cv_[A-Za-z0-9_-]{20,64}-(?:detail|thumb)\.(?:jpe?g|png|webp|avif|gif)$/i;

export const arr = value => Array.isArray(value) ? value : [];
export const clone = value => JSON.parse(JSON.stringify(value));
export const clean = (value, max = 4000) => String(value ?? "").trim().slice(0, max);

export function slug(value) {
  return String(value || "untitled").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "untitled";
}

export function externalUrl(value) {
  const raw = clean(value, 2000);
  if (!raw) return "";
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

export function safeHash(value) {
  const hash = clean(value, 128).toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : "";
}

export function sameText(a, b) {
  return clean(a, 500).toLowerCase() === clean(b, 500).toLowerCase();
}

export function mediaKey(value) {
  const text = String(value || "");
  if (!text.startsWith("/media/")) return "";
  try {
    const key = decodeURIComponent(text.slice(7));
    return validObjectKey(key) ? key : "";
  } catch { return ""; }
}

export function validateUploadTarget(key, contentType, declaredBytes = 0) {
  if (!validObjectKey(key, ALLOWED_UPLOAD_PREFIXES)) return { ok: false, status: 400, error: "Invalid object key" };
  if (key.startsWith("shadow-garden/covers/") && !OPAQUE_COVER_KEY.test(key)) return { ok: false, status: 400, error: "Cover object keys must use an opaque cv_ identifier" };
  if (declaredBytes > MAX_UPLOAD_BYTES) return { ok: false, status: 413, error: "File exceeds the 50 MB mobile upload limit" };
  const type = String(contentType || "application/octet-stream");
  const baseType = type.split(";")[0];
  if (key.endsWith(".epub") && !["application/epub+zip", "application/octet-stream", "application/zip"].includes(baseType)) return { ok: false, status: 415, error: "EPUB upload has an unexpected content type" };
  if (key.includes("/covers/") && !type.startsWith("image/")) return { ok: false, status: 415, error: "Cover upload must be an image" };
  return { ok: true, type };
}

export function validateUploadBody(byteLength) {
  if (!byteLength) return { ok: false, status: 400, error: "Empty upload" };
  if (byteLength > MAX_UPLOAD_BYTES) return { ok: false, status: 413, error: "File exceeds the 50 MB mobile upload limit" };
  return { ok: true };
}

export function normalizeCatalogVolumeInput(input = {}) {
  const seriesName = clean(input.series, 240), title = clean(input.title, 300);
  const epubKey = clean(input.epubKey, 700), coverKey = clean(input.coverKey, 700), coverThumbKey = clean(input.coverThumbKey, 700);
  const audioAlignedUrl = externalUrl(input.audioAlignedUrl), replaceTargetFile = clean(input.replaceTargetFile, 1000);
  const rawTranslationStatus=clean(input.translationStatus,80),translationStatus=normalizeTranslationStatus(rawTranslationStatus),translationCredits=validateTranslationCredits(input.translations);
  if (!seriesName || !title) return { ok: false, status: 400, error: "Series and title are required" };
  if (!validObjectKey(epubKey, ["shadow-garden/books/"]) || !epubKey.endsWith(".epub")) return { ok: false, status: 400, error: "Invalid EPUB key" };
  if (coverKey && !validObjectKey(coverKey, ["shadow-garden/covers/"])) return { ok: false, status: 400, error: "Invalid cover key" };
  if (coverThumbKey && !validObjectKey(coverThumbKey, ["shadow-garden/covers/"])) return { ok: false, status: 400, error: "Invalid cover thumbnail key" };
  if (audioAlignedUrl === null) return { ok: false, status: 400, error: "Audio-aligned EPUB folder URL must use http:// or https://" };
  if (rawTranslationStatus && !translationStatus) return { ok: false, status: 400, error: "Unknown translation status" };
  if (!translationCredits.ok) return { ok: false, status: 400, error: translationCredits.error };
  if (replaceTargetFile && !replaceTargetFile.startsWith("/media/shadow-garden/books/")) return { ok: false, status: 400, error: "Invalid replacement target" };
  let number = Number(input.number); if (!Number.isFinite(number) || number <= 0) number = 9999;
  return { ok: true, value: {
    adult: Boolean(input.adult), seriesName, targetSeriesId: clean(input.targetSeriesId, 180), title,
    author: clean(input.author, 240), epubKey, coverKey, coverThumbKey, description: clean(input.description, 12000),
    language: clean(input.language, 40), publisher: clean(input.publisher, 240), date: clean(input.date, 40),
    rawStatus: clean(input.status, 80), incomingTags: arr(input.tags).map(value => clean(value, 80)).filter(Boolean),
    size: Math.max(0, Number(input.size) || 0), audioAlignedUrl, translationStatus, translations: translationCredits.value, sha256: safeHash(input.sha256),
    originalFilename: clean(input.originalFilename, 500), replaceTargetFile,
    duplicatePolicy: ["reject", "replace", "separate"].includes(input.duplicatePolicy) ? input.duplicatePolicy : "replace", number,
    year: Number(input.year) || Number.parseInt(clean(input.date, 40).slice(0, 4)) || ""
  }};
}

function allSeries(data) {
  return [...arr(data?.main?.series).map(series => ({ scope: "main", series })), ...arr(data?.adult?.series).map(series => ({ scope: "adult", series }))];
}

function addIssue(issues, severity, code, title, detail, context = {}) { issues.push({ severity, code, title, detail, ...context }); }

export function catalogHealth(data, trash) {
  const issues = [], optimizationCandidates = [], objectKeys = new Set();
  let missingThumbs = 0, missingCovers = 0, legacyIdentity = 0, legacyAudioLinks = 0;
  const addMedia = value => { const key = mediaKey(value); if (key) objectKeys.add(key); };

  for (const { scope, series } of allSeries(data)) {
    const seriesId = clean(series.id, 180), title = clean(series.title, 300) || "Untitled series", volumes = arr(series.volumes);
    addMedia(series.cover); addMedia(series.coverThumb);
    if (!series.title) addIssue(issues, "error", "series-title", "Series title missing", `${seriesId || "Unknown series"} has no title.`, { scope, seriesId });
    if (!series.author) addIssue(issues, "info", "series-author", "Series author missing", `${title} has no author metadata.`, { scope, seriesId });
    if (!volumes.length) addIssue(issues, "warning", "empty-series", "Series has no volumes", `${title} contains no readable volumes.`, { scope, seriesId });
    const numberMap = new Map(), hashMap = new Map();
    volumes.forEach((volume, volumeIndex) => {
      const volumeTitle = clean(volume.title, 300) || `Volume ${volume.number ?? volumeIndex + 1}`;
      const context = { scope, seriesId, seriesTitle: title, volumeIndex, volumeTitle };
      addMedia(volume.file); addMedia(volume.cover); addMedia(volume.coverThumb);
      if (!volume.file || !mediaKey(volume.file)) addIssue(issues, "error", "volume-file", "EPUB reference missing", `${title} — ${volumeTitle} has no valid /media/ EPUB reference.`, context);
      if (!volume.cover) { missingCovers++; addIssue(issues, "warning", "volume-cover", "Cover missing", `${title} — ${volumeTitle} has no cover image.`, context); }
      else if (!volume.coverThumb) { missingThumbs++; optimizationCandidates.push({ scope, seriesId, seriesTitle: title, volumeIndex, volumeTitle, volumeFile: volume.file || "", source: volume.cover }); }
      if (!volume.sha256 || !volume.originalFilename) legacyIdentity++;
      if (volume.audioAlignedUrl) legacyAudioLinks++;
      const number = Number(volume.number);
      if (Number.isFinite(number)) { if (numberMap.has(number)) addIssue(issues, "warning", "duplicate-number", "Duplicate volume number", `${title} contains multiple entries numbered ${number}.`, context); else numberMap.set(number, volumeIndex); }
      const hash = clean(volume.sha256, 128).toLowerCase();
      if (hash) { if (hashMap.has(hash)) addIssue(issues, "warning", "duplicate-hash", "Duplicate EPUB hash", `${title} contains two catalog entries with the same SHA-256.`, context); else hashMap.set(hash, volumeIndex); }
    });
    if (series.cover && !series.coverThumb) {
      const represented = optimizationCandidates.some(candidate => candidate.scope === scope && candidate.seriesId === seriesId && candidate.source === series.cover);
      if (!represented) { missingThumbs++; optimizationCandidates.push({ scope, seriesId, seriesTitle: title, volumeIndex: null, volumeTitle: "Series cover", volumeFile: "", source: series.cover }); }
    }
  }
  if (legacyAudioLinks) addIssue(issues, "info", "legacy-audio", "Legacy volume audio links remain", `${legacyAudioLinks} volume-level audio link${legacyAudioLinks === 1 ? "" : "s"} can be migrated by saving the affected series.`);
  const items = allSeries(data);
  const counts = { series: items.length, mainSeries: arr(data?.main?.series).length, adultSeries: arr(data?.adult?.series).length, volumes: items.reduce((total, item) => total + arr(item.series.volumes).length, 0) };
  return {
    status: issues.some(issue => issue.severity === "error") ? "attention" : issues.some(issue => issue.severity === "warning") ? "warning" : "healthy",
    counts,
    metrics: { missingCovers, missingThumbs, legacyIdentity, legacyAudioLinks, trashItems: arr(trash?.items).length, referencedObjects: objectKeys.size },
    issues, optimizationCandidates, objectKeys: [...objectKeys]
  };
}

export async function checkObjectBatch(aws, keys) {
  const list = [...new Set(arr(keys).map(key => clean(key, 900)).filter(key => validObjectKey(key)))].slice(0, 30);
  const results = new Array(list.length); let cursor = 0;
  const workers = Array.from({ length: Math.min(8, list.length) }, async () => {
    while (cursor < list.length) {
      const index = cursor++, key = list[index];
      try { results[index] = { key, exists: await headObject(aws, key) }; }
      catch (error) { results[index] = { key, exists: false, error: String(error?.message || error) }; }
    }
  });
  await Promise.all(workers);
  return { checked: results.length, missing: results.filter(item => !item?.exists) };
}
