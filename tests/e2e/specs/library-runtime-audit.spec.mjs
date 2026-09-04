import { test, expect } from '../support/fixtures.mjs';
import { syntheticCatalog } from '../../../tools/performance-sanity.mjs';

const SERIES_COUNT = 300;

function auditCatalog() {
  return {
    version: 1,
    series: syntheticCatalog(SERIES_COUNT).map((series, seriesIndex) => ({
      ...series,
      status: seriesIndex % 3 === 0 ? 'Complete' : 'Ongoing',
      nsfw: false,
      volumes: series.volumes.map((volume, volumeIndex) => {
        const bookId = `bk_${String(seriesIndex * 20 + volumeIndex + 1).padStart(22, '0')}`;
        return { ...volume, bookId, file: bookId };
      })
    }))
  };
}

async function cdpSnapshot(page, session) {
  try { await session.send('HeapProfiler.collectGarbage'); } catch {}
  const response = await session.send('Performance.getMetrics');
  const metrics = Object.fromEntries(response.metrics.map(metric => [metric.name, metric.value]));
  const dom = await page.evaluate(() => ({
    elements: document.querySelectorAll('*').length,
    seriesCards: document.querySelectorAll('.series-card').length,
    volumeCards: document.querySelectorAll('.volume-card').length,
    options: document.querySelectorAll('select option').length,
    activeFilters: document.querySelectorAll('#activeTags button').length
  }));
  return {
    Documents: metrics.Documents,
    JSEventListeners: metrics.JSEventListeners,
    Nodes: metrics.Nodes,
    LayoutCount: metrics.LayoutCount,
    RecalcStyleCount: metrics.RecalcStyleCount,
    ScriptDuration: metrics.ScriptDuration,
    TaskDuration: metrics.TaskDuration,
    JSHeapUsedSize: metrics.JSHeapUsedSize,
    JSHeapTotalSize: metrics.JSHeapTotalSize,
    ...dom
  };
}

async function timed(action, settled) {
  const started = performance.now();
  await action();
  await settled();
  return Math.round((performance.now() - started) * 10) / 10;
}

async function waitForLibrary(page, count = 36) {
  await expect(page.locator('.catalog-skeleton-card')).toHaveCount(0);
  await expect(page.locator('#resultCount')).toContainText(`${SERIES_COUNT} series`);
  await expect(page.locator('.series-card')).toHaveCount(count);
}

test('v2.11C audit: 300-series Library and Series interaction runtime is measurable', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Chromium desktop runtime audit');

  const catalog = auditCatalog();
  let catalogPhase = 'library';
  const catalogRequests = { total: 0, library: 0, series: 0 };
  await page.route('**/data/catalog.json', route => {
    catalogRequests.total += 1;
    catalogRequests[catalogPhase] += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(catalog)
    });
  });

  await page.addInitScript(() => {
    window.__sgV211CLongTasks = [];
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          window.__sgV211CLongTasks.push({ duration: entry.duration, startTime: entry.startTime });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {}

    const emptyReads = () => ({ total: 0, finishedIndex: 0, finishedMarkers: 0, progress: 0, pinned: 0, otherShadowGarden: 0, other: 0 });
    window.__sgV211CStorageReads = emptyReads();
    window.__sgV211CStorageReset = () => { window.__sgV211CStorageReads = emptyReads(); };
    window.__sgV211CStorageSnapshot = () => ({ ...window.__sgV211CStorageReads });
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      const value = originalGetItem.call(this, key);
      try {
        if (this === localStorage) {
          const name = String(key || '');
          const reads = window.__sgV211CStorageReads;
          reads.total += 1;
          if (name === 'sg-finished-books') reads.finishedIndex += 1;
          else if (name.startsWith('sg-finished:')) reads.finishedMarkers += 1;
          else if (name.startsWith('sg-progress:')) reads.progress += 1;
          else if (name === 'sg-pinned') reads.pinned += 1;
          else if (name.startsWith('sg-')) reads.otherShadowGarden += 1;
          else reads.other += 1;
        }
      } catch {}
      return value;
    };
  });

  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');

  const hydrateMs = await timed(
    () => page.goto('/'),
    () => waitForLibrary(page)
  );
  const hydrated = await cdpSnapshot(page, session);
  const hydrationStorageReads = await page.evaluate(() => window.__sgV211CStorageSnapshot());
  await page.evaluate(() => window.__sgV211CStorageReset());

  const searchMs = await timed(
    () => page.locator('#searchInput').fill('Synthetic Series 250'),
    async () => {
      await expect(page.locator('.series-card')).toHaveCount(1);
      await expect(page.locator('.series-card h2')).toHaveText('Synthetic Series 250');
    }
  );

  const clearSearchMs = await timed(
    () => page.locator('#searchInput').fill(''),
    () => waitForLibrary(page)
  );

  const authorFilterMs = await timed(
    () => page.locator('#authorSelect').selectOption('Author 4'),
    async () => {
      await expect(page.locator('#resultCount')).toContainText('15 series');
      await expect(page.locator('.series-card')).toHaveCount(15);
      await expect(page.locator('#activeTags [data-clear-filter="author"]')).toHaveCount(1);
    }
  );

  await page.evaluate(() => {
    window.__sgV211CCatalogInsertCalls = 0;
    const original = Element.prototype.insertAdjacentHTML;
    window.__sgV211CRestoreInsertAdjacentHTML = () => { Element.prototype.insertAdjacentHTML = original; };
    Element.prototype.insertAdjacentHTML = function(position, html) {
      if (this.id === 'catalogGrid') window.__sgV211CCatalogInsertCalls += 1;
      return original.call(this, position, html);
    };
  });
  const clearAuthorPillMs = await timed(
    () => page.locator('#activeTags [data-clear-filter="author"]').click(),
    () => waitForLibrary(page)
  );
  const activePillCatalogInsertCalls = await page.evaluate(() => {
    const count = window.__sgV211CCatalogInsertCalls || 0;
    window.__sgV211CRestoreInsertAdjacentHTML?.();
    return count;
  });

  const sortMs = await timed(
    () => page.locator('#sortSelect').selectOption('title'),
    async () => {
      await expect(page.locator('.series-card')).toHaveCount(36);
      await expect(page.locator('.series-card h2').first()).toHaveText('Synthetic Series 001');
    }
  );

  const compactMs = await timed(
    () => page.getByRole('button', { name: 'Compact' }).click(),
    async () => {
      await expect(page.locator('#catalogGrid')).toHaveClass(/compact/);
      await expect(page.locator('.series-card')).toHaveCount(60);
    }
  );

  const loadMoreMs = await timed(
    () => page.evaluate(() => document.querySelector('#loadMore')?.click()),
    () => expect(page.locator('.series-card')).toHaveCount(120)
  );

  const afterInteractions = await cdpSnapshot(page, session);
  const interactionStorageReads = await page.evaluate(() => window.__sgV211CStorageSnapshot());
  const libraryLongTasks = await page.evaluate(() => window.__sgV211CLongTasks || []);

  catalogPhase = 'series';
  const seriesMs = await timed(
    () => page.goto('/series.html?id=perf-series-300'),
    async () => {
      await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy', 'false');
      await expect(page.getByRole('heading', { name: 'Synthetic Series 300' })).toBeVisible();
      await expect(page.locator('.volume-card')).toHaveCount(12);
    }
  );
  const seriesSnapshot = await cdpSnapshot(page, session);
  const seriesStorageReads = await page.evaluate(() => window.__sgV211CStorageSnapshot());
  const seriesLongTasks = await page.evaluate(() => window.__sgV211CLongTasks || []);

  const summarizeLongTasks = entries => ({
    count: entries.length,
    totalDurationMs: Math.round(entries.reduce((sum, entry) => sum + Number(entry.duration || 0), 0) * 10) / 10,
    maxDurationMs: Math.round(Math.max(0, ...entries.map(entry => Number(entry.duration || 0))) * 10) / 10
  });

  console.log('LIBRARY_V2_11C_RUNTIME_AUDIT', JSON.stringify({
    fixture: {
      series: catalog.series.length,
      volumes: catalog.series.reduce((sum, series) => sum + series.volumes.length, 0)
    },
    timingsMs: { hydrateMs, searchMs, clearSearchMs, authorFilterMs, clearAuthorPillMs, sortMs, compactMs, loadMoreMs, seriesMs },
    ownership: { activePillCatalogInsertCalls },
    requests: catalogRequests,
    storageReads: { hydration: hydrationStorageReads, interactions: interactionStorageReads, series: seriesStorageReads },
    hydrated,
    afterInteractions,
    seriesSnapshot,
    libraryLongTasks: summarizeLongTasks(libraryLongTasks),
    seriesLongTasks: summarizeLongTasks(seriesLongTasks)
  }));

  expect(catalogRequests.library).toBe(1);
  expect(catalogRequests.series).toBe(1);
  expect(activePillCatalogInsertCalls).toBe(1);
  expect(hydrated.seriesCards).toBe(36);
  expect(afterInteractions.seriesCards).toBe(120);
  expect(seriesSnapshot.volumeCards).toBe(12);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
