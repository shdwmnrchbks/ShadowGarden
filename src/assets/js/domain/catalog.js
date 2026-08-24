/* Shadow Garden R2 — canonical catalog normalization and lookup helpers. */

import { isBookId, volumeMatchesIdentity } from "./book-identity.js";
import { migrateLegacyBookmarks } from "./bookmarks.js";
import { migrateLegacyProgress } from "./progress.js";

const STATUS_ALIASES = new Map([
  ["complete", "Complete"], ["completed", "Complete"], ["finished", "Complete"],
  ["ongoing", "Ongoing"], ["publishing", "Ongoing"], ["active", "Ongoing"], ["current", "Ongoing"],
  ["hiatus", "Hiatus"], ["on hiatus", "Hiatus"], ["paused", "Hiatus"],
  ["dropped", "Dropped"], ["cancelled", "Dropped"], ["canceled", "Dropped"], ["discontinued", "Dropped"]
]);
const STATUS_TAG_KEYS = new Set([...STATUS_ALIASES.keys(), "complete", "ongoing", "hiatus", "dropped"]);

export const statuses = Object.freeze(["Complete", "Ongoing", "Hiatus", "Dropped"]);

export function normalizeStatus(value) {
  return STATUS_ALIASES.get(String(value || "").trim().toLowerCase()) || "Ongoing";
}

export function normalizeCatalogShape(catalog) {
  const value = catalog && typeof catalog === "object" ? catalog : {};
  const bookIds = [];
  const series = (Array.isArray(value.series) ? value.series : []).map(item => {
    const status = normalizeStatus(item?.status);
    const tags = [...new Set([
      ...(Array.isArray(item?.tags) ? item.tags : []).map(String).filter(tag => !STATUS_TAG_KEYS.has(String(tag).trim().toLowerCase())),
      status
    ])];
    const volumes = (Array.isArray(item?.volumes) ? item.volumes : []).map(volume => {
      const bookId = String(volume?.bookId || "");
      if (!isBookId(bookId)) return volume;
      bookIds.push(bookId);
      return { ...volume, file: bookId };
    });
    return { ...item, status, tags, volumes };
  });
  return { catalog: { ...value, series }, bookIds };
}

export async function normalizeCatalog(catalog, { migrateLegacyState = true } = {}) {
  const normalized = normalizeCatalogShape(catalog);
  if (migrateLegacyState && normalized.bookIds.length) {
    try {
      await Promise.all([
        migrateLegacyProgress(normalized.bookIds),
        migrateLegacyBookmarks(normalized.bookIds)
      ]);
    } catch (error) {
      console.warn("Legacy reading-state migration skipped", error);
    }
  }
  return normalized.catalog;
}

export function seriesList(catalog) {
  return Array.isArray(catalog?.series) ? catalog.series : [];
}

export function seriesById(catalog, seriesId) {
  const id = String(seriesId || "");
  return seriesList(catalog).find(series => String(series?.id || "") === id) || null;
}

export function volumeEntries(series) {
  const volumes = Array.isArray(series?.volumes) ? series.volumes : [];
  return volumes.map((volume, index) => ({ series, volume, index }));
}

export function allVolumeEntries(catalog) {
  return seriesList(catalog).flatMap(volumeEntries);
}

export function findVolumeEntry(catalog, seriesId, identity, extra = []) {
  const series = seriesById(catalog, seriesId);
  if (!series) return null;
  const volumes = Array.isArray(series.volumes) ? series.volumes : [];
  for (let index = 0; index < volumes.length; index += 1) {
    const volume = volumes[index];
    if (volumeMatchesIdentity(series.id, volume, index, identity, extra)) return { series, volume, index };
  }
  return null;
}

export function isAdultSeriesId(seriesId) {
  return String(seriesId || "").startsWith("adult-");
}
