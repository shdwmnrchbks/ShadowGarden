import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import * as readingState from "../../src/assets/js/domain/reading-state.js";
import * as progress from "../../src/assets/js/domain/progress.js";
import * as bookmarks from "../../src/assets/js/domain/bookmarks.js";
import { installBrowserEnv } from "../helpers/browser-env.mjs";

const fixture = async name => JSON.parse(await fs.readFile(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
const volume = { number: 1, title: "A Long Beginning Beneath the Moonlit Conservatory", bookId: "bk_2222222222222222222222", file: "bk_2222222222222222222222" };

test("fixture state matrix preserves Unread → In Progress → Finished semantics", async () => {
  const env = installBrowserEnv();
  try {
    const matrix = await fixture("reading-states.json");
    for (const scenario of matrix.cases) {
      env.storage.clear();
      if (scenario.progress) assert.equal(progress.writeProgress(volume.file, scenario.progress), true);
      if (scenario.finished) assert.equal(readingState.setVolumeFinished(matrix.seriesId, volume, true, 0), true);
      const state = readingState.volumeState(matrix.seriesId, volume, 0);
      assert.equal(state, scenario.expectedState, scenario.name);
      assert.equal(readingState.actionLabelForState(state), scenario.expectedAction, scenario.name);
    }
  } finally { env.restore(); }
});

test("Finished overrides an active progress record", () => {
  const env = installBrowserEnv();
  try {
    assert.equal(progress.writeProgress(volume.file, { page: 40, totalPages: 100, percentage: 0.4, updatedAt: 10 }), true);
    assert.equal(readingState.volumeState("long-metadata-archive", volume, 0), readingState.STATES.IN_PROGRESS);
    assert.equal(readingState.setVolumeFinished("long-metadata-archive", volume, true, 0), true);
    assert.equal(readingState.volumeState("long-metadata-archive", volume, 0), readingState.STATES.FINISHED);
  } finally { env.restore(); }
});

test("Read Again primitives clear Finished and progress while preserving bookmarks", () => {
  const env = installBrowserEnv();
  try {
    const aliases = readingState.volumeAliases("long-metadata-archive", volume, 0);
    const marks = [{ cfi: "epubcfi(/6/4!/4/2)", label: "Keep this bookmark", createdAt: 123 }];
    assert.equal(bookmarks.writeBookmarksAliases(aliases, marks), true);
    assert.equal(progress.writeProgressAliases(aliases, { page: 77, totalPages: 100, percentage: 0.77, updatedAt: 20 }, { canonicalIdentity: volume.bookId }), true);
    assert.equal(readingState.setVolumeFinished("long-metadata-archive", volume, true, 0), true);

    assert.equal(readingState.setVolumeFinished("long-metadata-archive", volume, false, 0), true);
    assert.equal(readingState.clearVolumeProgress("long-metadata-archive", volume, 0), true);

    assert.equal(readingState.volumeState("long-metadata-archive", volume, 0), readingState.STATES.UNREAD);
    assert.equal(readingState.volumeProgress("long-metadata-archive", volume, 0), null);
    assert.deepEqual(bookmarks.readBookmarksAliases(aliases), marks);
  } finally { env.restore(); }
});

test("preferred series entry selects newest active volume before unread/finished fallbacks", () => {
  const env = installBrowserEnv();
  try {
    const series = {
      id: "fixture-series",
      volumes: [
        { number: 1, bookId: "bk_7777777777777777777777", file: "bk_7777777777777777777777" },
        { number: 2, bookId: "bk_8888888888888888888888", file: "bk_8888888888888888888888" },
        { number: 3, bookId: "bk_9999999999999999999999", file: "bk_9999999999999999999999" }
      ]
    };
    progress.writeProgress(series.volumes[0].file, { page: 10, percentage: 0.1, updatedAt: 100 });
    progress.writeProgress(series.volumes[1].file, { page: 12, percentage: 0.12, updatedAt: 200 });
    assert.equal(readingState.preferredSeriesEntry(series)?.volume.number, 2);
    readingState.setVolumeFinished(series.id, series.volumes[1], true, 1);
    assert.equal(readingState.preferredSeriesEntry(series)?.volume.number, 1);
  } finally { env.restore(); }
});
