import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { findVolumeEntry, isAdultSeriesId, normalizeCatalogShape } from "../../src/assets/js/domain/catalog.js";
import { filterAndSort, filterOptions, recentlyAdded, volumeCountMatches } from "../../src/assets/js/library-model.js";

const fixture = async name => JSON.parse(await fs.readFile(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
const state = overrides => ({
  query: "", author: "", year: "", tags: new Set(), volumeRange: "", readingStatus: "", pinnedOnly: false, sort: "recent", view: "grid", ...overrides
});

test("catalog fixtures normalize Main/Adult status and opaque book identities", async () => {
  const main = normalizeCatalogShape(await fixture("catalog-main.json")).catalog;
  const adult = normalizeCatalogShape(await fixture("catalog-adult.json")).catalog;

  assert.equal(main.series[0].status, "Complete");
  assert.deepEqual(main.series[0].tags, ["Fantasy", "Complete"]);
  assert.equal(main.series[1].status, "Ongoing");
  assert.equal(main.series[1].volumes[0].file, "bk_2222222222222222222222");
  assert.equal(adult.series[0].status, "Hiatus");
  assert.deepEqual(adult.series[0].tags, ["Romance", "Drama", "Hiatus"]);
  assert.equal(isAdultSeriesId(adult.series[0].id), true);
  assert.equal(isAdultSeriesId(main.series[0].id), false);
});

test("single and multi-volume fixtures exercise canonical volume filters", async () => {
  const main = normalizeCatalogShape(await fixture("catalog-main.json")).catalog.series;
  assert.equal(main[0].volumes.length, 1);
  assert.equal(main[1].volumes.length, 3);
  assert.equal(volumeCountMatches(main[0].volumes.length, "1"), true);
  assert.equal(volumeCountMatches(main[1].volumes.length, "2-5"), true);
  assert.equal(filterAndSort(main, state({ volumeRange: "1" }))[0].id, "moonlit-single");
  assert.equal(filterAndSort(main, state({ volumeRange: "2-5" }))[0].id, "long-metadata-archive");
});

test("long metadata remains searchable without mutating display content", async () => {
  const main = normalizeCatalogShape(await fixture("catalog-main.json")).catalog.series;
  const long = main.find(series => series.id === "long-metadata-archive");
  const originalDescription = long.description;
  const result = filterAndSort(main, state({ query: '"moonlit conservatory" western glass', sort: "title" }));
  assert.deepEqual(result.map(series => series.id), ["long-metadata-archive"]);
  assert.equal(long.description, originalDescription);
  assert.match(long.title, /Extremely Long Archive Title/);
});

test("filter options and Recently Added stay deterministic across fixtures", async () => {
  const main = normalizeCatalogShape(await fixture("catalog-main.json")).catalog.series;
  const adult = normalizeCatalogShape(await fixture("catalog-adult.json")).catalog.series;
  const items = [...main, ...adult];
  const options = filterOptions(items);
  assert.ok(options.authors.includes("Fixture Author"));
  assert.ok(options.authors.includes("Restricted Fixture Author"));
  assert.ok(options.tags.includes("Ongoing"));
  assert.ok(options.tags.includes("Hiatus"));
  const recent = recentlyAdded(items, 3);
  assert.equal(recent.length, 3);
  assert.equal(recent[0].volume.bookId, "bk_6666666666666666666666");
  assert.equal(recent[1].volume.bookId, "bk_4444444444444444444444");
});

test("#162 session-level extra identities cannot blanket-match the first catalog volume", async () => {
  const main = normalizeCatalogShape(await fixture("catalog-main.json")).catalog;
  const seriesId = "long-metadata-archive";
  const SECOND = "bk_3333333333333333333333";
  const LAST = "bk_4444444444444444444444";

  const polluted = findVolumeEntry(main, seriesId, LAST, ["/media/shadow-garden/books/e2e-reader.epub", LAST, LAST]);
  assert.equal(polluted?.index, 2);
  assert.equal(polluted?.volume?.title, "An Ancient Archive Opens Again");

  assert.equal(findVolumeEntry(main, seriesId, SECOND)?.index, 1);
});

test("findVolumeEntry keeps legacy alternate identities working without first-entry bleed", () => {
  const legacy = {
    series: [{
      id: "legacy-saga",
      volumes: [
        { number: 1, title: "Vol One", file: "/media/shadow-garden/books/legacy-vol-one.epub" },
        { number: 2, title: "Vol Two", file: "/media/shadow-garden/books/legacy-vol-two.epub" }
      ]
    }]
  };

  const directPath = findVolumeEntry(legacy, "legacy-saga", "/media/shadow-garden/books/legacy-vol-two.epub");
  assert.equal(directPath?.index, 1);

  const throughAlternate = findVolumeEntry(legacy, "legacy-saga", "bk_legacyopaqueidentity001", ["/media/shadow-garden/books/legacy-vol-two.epub"]);
  assert.equal(throughAlternate?.index, 1);

  const unknownWithBlanketExtra = findVolumeEntry(legacy, "legacy-saga", "bk_unknownopaqueid00001", ["bk_unknownopaqueid00001"]);
  assert.equal(unknownWithBlanketExtra, null);
});
