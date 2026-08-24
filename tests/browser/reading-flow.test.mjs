import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { normalizeCatalogShape } from "../../src/assets/js/domain/catalog.js";
import * as readingState from "../../src/assets/js/domain/reading-state.js";
import * as progress from "../../src/assets/js/domain/progress.js";
import * as bookmarks from "../../src/assets/js/domain/bookmarks.js";
import * as urls from "../../src/assets/js/domain/urls.js";
import { resetFinishedVolume, volumeActionFor } from "../../src/assets/js/public/volume-actions.js";
import { installBrowserEnv } from "../helpers/browser-env.mjs";

const fixture = async name => JSON.parse(await fs.readFile(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

test("browser smoke: Read → Continue → Finished → Read Again preserves bookmarks", async () => {
  const env = installBrowserEnv();
  try {
    const catalog = normalizeCatalogShape(await fixture("catalog-main.json")).catalog;
    const series = catalog.series.find(item => item.id === "long-metadata-archive");
    const volume = series.volumes[0];
    window.ShadowGardenData = { loadCatalog: async adult => { assert.equal(adult, false); return catalog; } };

    let action = volumeActionFor(series, volume, 0);
    assert.equal(action.state, readingState.STATES.UNREAD);
    assert.equal(action.label, "Read");

    const aliases = readingState.volumeAliases(series.id, volume, 0);
    const savedBookmarks = [{ cfi: "epubcfi(/6/8!/4/2)", label: "Persistent bookmark", createdAt: 1000 }];
    assert.equal(bookmarks.writeBookmarksAliases(aliases, savedBookmarks), true);
    assert.equal(progress.writeProgressAliases(aliases, { page: 2, totalPages: 100, percentage: 0.02, updatedAt: 2000 }, { canonicalIdentity: volume.bookId }), true);

    action = volumeActionFor(series, volume, 0);
    assert.equal(action.state, readingState.STATES.IN_PROGRESS);
    assert.equal(action.label, "Continue");

    assert.equal(readingState.setVolumeFinished(series.id, volume, true, 0), true);
    action = volumeActionFor(series, volume, 0);
    assert.equal(action.state, readingState.STATES.FINISHED);
    assert.equal(action.label, "Read Again");

    assert.equal(await resetFinishedVolume(series.id, volume.bookId), true);
    action = volumeActionFor(series, volume, 0);
    assert.equal(action.state, readingState.STATES.UNREAD);
    assert.equal(action.label, "Read");
    assert.equal(readingState.volumeProgress(series.id, volume, 0), null);
    assert.deepEqual(bookmarks.readBookmarksAliases(aliases), savedBookmarks);

    const restart = urls.readerUrl(volume.bookId, series.id, { restart: true });
    assert.match(restart, /restart=1/);
    assert.match(restart, /book=bk_2222222222222222222222/);
  } finally {
    delete globalThis.ShadowGardenData;
    env.restore();
  }
});

test("browser smoke: Adult Read Again resolves only the Adult catalog", async () => {
  const env = installBrowserEnv();
  try {
    const adultCatalog = normalizeCatalogShape(await fixture("catalog-adult.json")).catalog;
    const series = adultCatalog.series[0];
    const volume = series.volumes[0];
    const scopes = [];
    window.ShadowGardenData = { loadCatalog: async adult => { scopes.push(adult); return adultCatalog; } };
    progress.writeProgress(volume.file, { page: 9, percentage: 0.09, updatedAt: 3000 });
    readingState.setVolumeFinished(series.id, volume, true, 0);
    assert.equal(await resetFinishedVolume(series.id, volume.bookId), true);
    assert.deepEqual(scopes, [true]);
    assert.equal(readingState.volumeState(series.id, volume, 0), readingState.STATES.UNREAD);
  } finally {
    delete globalThis.ShadowGardenData;
    env.restore();
  }
});
