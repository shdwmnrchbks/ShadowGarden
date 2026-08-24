import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import * as readingState from "../../src/assets/js/domain/reading-state.js";
import * as progress from "../../src/assets/js/domain/progress.js";
import * as format from "../../src/assets/js/domain/format.js";
import * as urls from "../../src/assets/js/domain/urls.js";
import { normalizeCatalogShape } from "../../src/assets/js/domain/catalog.js";
import { recentlyAdded } from "../../src/assets/js/library-model.js";
import { renderReadingBanner, renderRecentlyAdded, seriesCard } from "../../src/assets/js/library-renderers.js";
import { installBrowserEnv } from "../helpers/browser-env.mjs";
import { FakeElement, installFakeDocument } from "../helpers/fake-dom.mjs";

const fixture = async name => JSON.parse(await fs.readFile(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
const preferences = { isPinned: id => id === "long-metadata-archive" };

test("Grid/Compact series card markup keeps long metadata, pin, and volume badges", async () => {
  const env = installBrowserEnv();
  try {
    const main = normalizeCatalogShape(await fixture("catalog-main.json")).catalog;
    const series = main.series.find(item => item.id === "long-metadata-archive");
    const html = seriesCard(series, 0, { readingState, preferences, urls, format });
    assert.match(html, /class="series-card/);
    assert.match(html, /The Extremely Long Archive Title/);
    assert.match(html, /compact-card-badge pinned/);
    assert.match(html, />3 VOLS</);
    assert.match(html, /series\.html\?id=long-metadata-archive/);
  } finally { env.restore(); }
});

test("Recently Added renderer emits canonical Continue state from browser-local progress", async () => {
  const env = installBrowserEnv();
  try {
    const main = normalizeCatalogShape(await fixture("catalog-main.json")).catalog;
    const series = main.series.find(item => item.id === "long-metadata-archive");
    const volume = series.volumes[2];
    progress.writeProgress(volume.file, { page: 15, totalPages: 100, percentage: 0.15, updatedAt: Date.now() });
    const entries = recentlyAdded([series], 3);
    const section = new FakeElement("section");
    section.classList.add("hidden");
    const container = new FakeElement("div");
    renderRecentlyAdded(section, container, entries, { readingState, urls, format });
    assert.equal(section.classList.contains("hidden"), false);
    assert.match(container.innerHTML, /CONTINUE · 15%/);
    assert.match(container.innerHTML, /data-volume-state="in-progress"/);
    assert.match(container.innerHTML, /data-volume-action="open"/);
  } finally { env.restore(); }
});

test("reading banner owns artwork and canonical action without post-render repair", async () => {
  const env = installBrowserEnv();
  const restoreDocument = installFakeDocument();
  try {
    const main = normalizeCatalogShape(await fixture("catalog-main.json")).catalog;
    const series = main.series[0];
    const volume = series.volumes[0];
    progress.writeProgress(volume.file, { page: 8, totalPages: 80, percentage: 0.1, updatedAt: 500 });
    const panel = new FakeElement("div");
    panel.classList.add("hidden");
    const intro = new FakeElement("section");
    renderReadingBanner(panel, intro, {
      series,
      volume,
      index: 0,
      progress: readingState.volumeProgress(series.id, volume, 0),
      state: readingState.volumeState(series.id, volume, 0)
    }, { readingState, format });

    assert.equal(panel.dataset.readingState, "in-progress");
    assert.equal(panel.classList.contains("hidden"), false);
    assert.match(panel.innerHTML, />Continue</);
    assert.match(panel.innerHTML, /Volume 1 · 10%/);
    const art = intro.querySelector(":scope > .intro-banner-art");
    assert.ok(art);
    assert.match(art.style.backgroundImage, /cv_fixturemain/);
  } finally {
    restoreDocument();
    env.restore();
  }
});
