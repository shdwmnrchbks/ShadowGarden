import { getTextObject, readClient } from "./b2.js";
import { isBookId, normalizeBookFile, volumeBookId } from "./book-id.js";

const MAIN_KEY = "shadow-garden/data/catalog.json";
const ADULT_KEY = "shadow-garden/data/adult-catalog.json";
const CACHE_TTL_MS = 10000;
let cached = null;
let cachedAt = 0;

function arr(value) {
  return Array.isArray(value) ? value : [];
}

async function loadCatalog(aws, key) {
  const text = await getTextObject(aws, key);
  if (!text) return { series: [] };
  const parsed = JSON.parse(text);
  return { ...parsed, series: arr(parsed?.series) };
}

async function buildIndex(env) {
  const aws = readClient(env);
  const [main, adult] = await Promise.all([loadCatalog(aws, MAIN_KEY), loadCatalog(aws, ADULT_KEY)]);
  const byId = new Map();
  const byFile = new Map();

  for (const catalog of [main, adult]) {
    for (const series of arr(catalog.series)) {
      for (const volume of arr(series?.volumes)) {
        const file = normalizeBookFile(volume?.file);
        if (!file) continue;
        const bookId = await volumeBookId(volume);
        if (!bookId) continue;
        const entry = { bookId, file, seriesId: String(series?.id || ""), volume };
        byId.set(bookId, entry);
        byFile.set(file, entry);
      }
    }
  }

  cached = { byId, byFile };
  cachedAt = Date.now();
  return cached;
}

async function index(env) {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  return buildIndex(env);
}

function find(lookup, ref) {
  if (isBookId(ref)) return lookup.byId.get(ref) || null;
  const file = normalizeBookFile(ref);
  return file ? lookup.byFile.get(file) || null : null;
}

export async function resolveBookReference(env, value) {
  const ref = String(value || "").trim();
  if (!ref) return null;
  const lookup = await index(env);
  const found = find(lookup, ref);
  if (found) return found;
  if (!cached || Date.now() - cachedAt >= CACHE_TTL_MS) return null;
  return find(await buildIndex(env), ref);
}

export function clearBookResolverCache() {
  cached = null;
  cachedAt = 0;
}
