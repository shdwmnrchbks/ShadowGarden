import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { contextualFilterOptions, filterAndSort } from "../src/assets/js/library-model.js";

export const DEFAULT_SERIES_COUNT = 300;
export const DEFAULT_SEVERE_REGRESSION_MS = 5000;

export function syntheticCatalog(count = DEFAULT_SERIES_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const volumeCount = 1 + (index % 12);
    return {
      id: `perf-series-${String(number).padStart(3, "0")}`,
      title: `Synthetic Series ${String(number).padStart(3, "0")}`,
      author: `Author ${index % 20}`,
      description: `Deterministic performance fixture series ${number} with searchable fantasy adventure text.`,
      year: 2000 + (index % 25),
      genres: [index % 3 === 0 ? "Fantasy" : index % 3 === 1 ? "Action" : "Adventure"],
      tags: [`Tag ${index % 12}`, `Group ${index % 5}`],
      translationStatus: index % 2 ? "Ongoing" : "Complete",
      translations: [{ name: `Translator ${index % 10}` }],
      volumes: Array.from({ length: volumeCount }, (_, volumeIndex) => ({
        id: `perf-volume-${number}-${volumeIndex + 1}`,
        number: volumeIndex + 1,
        title: `Volume ${volumeIndex + 1}`,
        year: 2000 + ((index + volumeIndex) % 25),
        added: new Date(Date.UTC(2024 + (index % 3), index % 12, 1 + (volumeIndex % 20))).toISOString()
      }))
    };
  });
}

function baseState() {
  return {
    query: "",
    author: "",
    translator: "",
    genre: "",
    tags: new Set(),
    year: "",
    volumeRange: "",
    readingStatus: "",
    sort: "recent",
    pinnedOnly: false,
    view: "grid"
  };
}

export function measureLibraryPerformance({ count = DEFAULT_SERIES_COUNT, severeRegressionMs = DEFAULT_SEVERE_REGRESSION_MS } = {}) {
  const items = syntheticCatalog(count);
  const pinnedIds = new Set(items.filter((_, index) => index % 11 === 0).map(series => series.id));
  const seriesFinished = series => Number(series.id.slice(-3)) % 7 === 0;
  const dependencies = { pinnedIds, seriesFinished };
  const started = performance.now();

  const recent = filterAndSort(items, baseState(), dependencies);
  const searched = filterAndSort(items, { ...baseState(), query: "fantasy adventure", sort: "title" }, dependencies);
  const filtered = filterAndSort(items, {
    ...baseState(),
    author: "Author 4",
    translator: "Translator 4",
    tags: new Set(["Group 4"]),
    volumeRange: "6-10",
    sort: "volumes"
  }, dependencies);
  const options = contextualFilterOptions(items, {
    ...baseState(),
    genre: "Fantasy",
    sort: "title"
  }, dependencies);

  const elapsedMs = performance.now() - started;
  const failures = [];
  if (recent.length !== count) failures.push(`recent query returned ${recent.length}; expected ${count}`);
  if (!searched.length) failures.push("search query unexpectedly returned no synthetic series");
  if (!filtered.length) failures.push("combined realistic filters unexpectedly returned no synthetic series");
  if (options.authors.length !== 20) failures.push(`contextual options exposed ${options.authors.length} authors; expected 20`);
  if (options.translators.length !== 10) failures.push(`contextual options exposed ${options.translators.length} translators; expected 10`);
  if (elapsedMs > severeRegressionMs) failures.push(`300-series Library model sanity took ${elapsedMs.toFixed(1)}ms; severe-regression ceiling is ${severeRegressionMs}ms`);

  return {
    count,
    elapsedMs,
    recentCount: recent.length,
    searchCount: searched.length,
    filteredCount: filtered.length,
    authorOptions: options.authors.length,
    translatorOptions: options.translators.length,
    failures
  };
}

export function runPerformanceSanity(options = {}) {
  const result = measureLibraryPerformance(options);
  if (result.failures.length) {
    console.error(`Performance sanity failed with ${result.failures.length} problem${result.failures.length === 1 ? "" : "s"}:`);
    result.failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
    return result;
  }
  console.log(`Performance sanity passed: ${result.count} synthetic series exercised in ${result.elapsedMs.toFixed(1)}ms (broad ceiling ${options.severeRegressionMs || DEFAULT_SEVERE_REGRESSION_MS}ms).`);
  return result;
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) runPerformanceSanity();
