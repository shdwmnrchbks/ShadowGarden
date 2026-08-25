const encoder = new TextEncoder();
const BOOK_PATH = /^\/media\/shadow-garden\/books\/.+\.epub$/i;
const BOOK_ID = /^bk_[A-Za-z0-9_-]{22}$/;

function base64Url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function publicTranslationCredits(value) {
  if (!Array.isArray(value)) return null;
  const credits = value.map(raw => {
    const name = String(raw?.name || "").trim();
    if (!name) return null;
    const url = String(raw?.url || "").trim(), coverage = String(raw?.coverage || "").trim();
    return { name, ...(url ? { url } : {}), ...(coverage ? { coverage } : {}) };
  }).filter(Boolean);
  return credits.length ? credits : null;
}

function publicTranslationShape(value) {
  const source = value && typeof value === "object" ? value : {};
  const { translations: _translations, ...rest } = source;
  const translations = publicTranslationCredits(source.translations);
  return translations ? { ...rest, translations } : rest;
}

export function isBookId(value) {
  return BOOK_ID.test(String(value || ""));
}

export function normalizeBookFile(value) {
  const raw = String(value || "").trim().split("#")[0].split("?")[0];
  if (!BOOK_PATH.test(raw) || raw.includes("\\") || raw.split("/").some(part => part === "." || part === "..")) return "";
  return raw;
}

export async function bookIdForFile(value) {
  const file = normalizeBookFile(value);
  if (!file) return "";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`shadow-garden-book-id-v1\n${file}`)));
  return `bk_${base64Url(digest.slice(0, 16))}`;
}

export async function volumeBookId(volume) {
  if (isBookId(volume?.bookId)) return String(volume.bookId);
  return bookIdForFile(volume?.file);
}

export async function persistentVolumeBookId(previous, nextFile) {
  if (isBookId(previous?.bookId)) return String(previous.bookId);
  const previousFile = normalizeBookFile(previous?.file);
  return bookIdForFile(previousFile || nextFile);
}

export async function publicCatalogShape(catalog) {
  const source = catalog && typeof catalog === "object" ? catalog : {};
  const series = await Promise.all((Array.isArray(source.series) ? source.series : []).map(async item => {
    const volumes = await Promise.all((Array.isArray(item?.volumes) ? item.volumes : []).map(async volume => {
      const bookId = await volumeBookId(volume);
      const { file: _file, sha256: _sha256, originalFilename: _originalFilename, ...rest } = volume || {};
      const publicVolume = publicTranslationShape(rest);
      return bookId ? { ...publicVolume, bookId } : publicVolume;
    }));
    return { ...publicTranslationShape(item), volumes };
  }));
  return { ...source, series };
}
