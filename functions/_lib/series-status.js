export const SERIES_STATUSES = Object.freeze(["Complete", "Ongoing", "Hiatus", "Dropped"]);

const STATUS_ALIASES = new Map([
  ["complete", "Complete"], ["completed", "Complete"], ["finished", "Complete"],
  ["ongoing", "Ongoing"], ["publishing", "Ongoing"], ["active", "Ongoing"], ["current", "Ongoing"],
  ["hiatus", "Hiatus"], ["on hiatus", "Hiatus"], ["paused", "Hiatus"],
  ["dropped", "Dropped"], ["cancelled", "Dropped"], ["canceled", "Dropped"], ["discontinued", "Dropped"]
]);

const STATUS_TAG_KEYS = new Set(STATUS_ALIASES.keys());

export function normalizeSeriesStatus(value) {
  return STATUS_ALIASES.get(String(value || "").trim().toLowerCase()) || "Ongoing";
}

export function withSeriesStatusTag(values, status) {
  const canonical = normalizeSeriesStatus(status);
  const tags = [];
  for (const value of Array.isArray(values) ? values : []) {
    const tag = String(value ?? "").trim().slice(0, 80);
    if (!tag || STATUS_TAG_KEYS.has(tag.toLowerCase()) || tags.includes(tag)) continue;
    tags.push(tag);
    if (tags.length >= 39) break;
  }
  tags.push(canonical);
  return tags;
}

export function canonicalizeSeriesStatus(series) {
  if (!series || typeof series !== "object") return series;
  const status = normalizeSeriesStatus(series.status);
  series.status = status;
  series.tags = withSeriesStatusTag(series.tags, status);
  return series;
}
