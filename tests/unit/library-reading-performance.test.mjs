import test from "node:test";
import assert from "node:assert/strict";

import * as readingState from "../../src/assets/js/domain/reading-state.js";
import { seriesCard } from "../../src/assets/js/library-renderers.js";
import { installBrowserEnv } from "../helpers/browser-env.mjs";

test("volume entries read progress aliases once per volume", () => {
  const env = installBrowserEnv();
  try {
    const series = {
      id: "single-read-series",
      title: "Single Read Series",
      volumes: [{
        number: 1,
        title: "Volume 1",
        bookId: "bk_6666666666666666666666",
        file: "bk_6666666666666666666666"
      }]
    };
    const originalGetItem = env.storage.getItem.bind(env.storage);
    let progressReads = 0;
    env.storage.getItem = key => {
      if (String(key).startsWith("sg-progress:")) progressReads += 1;
      return originalGetItem(key);
    };

    const entries = readingState.volumeEntries(series);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].state, readingState.STATES.UNREAD);
    assert.equal(progressReads, readingState.volumeAliases(series.id, series.volumes[0], 0).length,
      "volumeEntries should perform one progress lookup pass across the canonical aliases");
  } finally { env.restore(); }
});

test("series cards derive Finished from their existing volume entries", () => {
  let entryCalls = 0;
  const states = { UNREAD: "unread", IN_PROGRESS: "in-progress", FINISHED: "finished" };
  const html = seriesCard({
    id: "finished-series",
    title: "Finished Series",
    author: "Author",
    year: 2026,
    genres: ["Fantasy"],
    volumes: [{ number: 1, title: "Volume 1" }]
  }, 0, {
    readingState: {
      STATES: states,
      volumeEntries() {
        entryCalls += 1;
        return [{ volume: { number: 1 }, index: 0, state: states.FINISHED, progress: null }];
      },
      seriesFinished() {
        throw new Error("seriesCard must not start a second finished-state scan");
      }
    },
    preferences: { isPinned: () => false },
    urls: { seriesUrl: id => `/series.html?id=${id}` },
    format: { escapeHtml: value => String(value ?? "") },
    translations: {
      primaryTranslator: () => null,
      normalizeTranslationStatus: value => String(value || "")
    }
  });

  assert.equal(entryCalls, 1);
  assert.match(html, /series-card is-finished/);
  assert.match(html, /✓ Finished/);
});

test("Library banner evaluates each volume entry once when choosing a suggestion", () => {
  const env = installBrowserEnv();
  try {
    const series = [
      {
        id: "banner-one",
        title: "Banner One",
        volumes: [{ number: 1, bookId: "bk_1111111111111111111112", file: "bk_1111111111111111111112" }]
      },
      {
        id: "banner-two",
        title: "Banner Two",
        volumes: [{ number: 1, bookId: "bk_2222222222222222222224", file: "bk_2222222222222222222224" }]
      }
    ];
    const expectedProgressReads = series.reduce((sum, item) =>
      sum + readingState.volumeAliases(item.id, item.volumes[0], 0).length, 0);
    const originalGetItem = env.storage.getItem.bind(env.storage);
    let progressReads = 0;
    env.storage.getItem = key => {
      if (String(key).startsWith("sg-progress:")) progressReads += 1;
      return originalGetItem(key);
    };

    const banner = readingState.libraryBannerEntry(series, 0);
    assert.equal(banner?.series.id, "banner-one");
    assert.equal(banner?.mode, "suggestion");
    assert.equal(progressReads, expectedProgressReads,
      "continue/next/random banner selection should share one materialized volume-entry pass");
  } finally { env.restore(); }
});
