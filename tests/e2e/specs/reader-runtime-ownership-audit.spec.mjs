import fs from 'node:fs/promises';
import { test, expect } from '../support/fixtures.mjs';

const AUDIT_BOOK_ID = 'bk_4444444444444444444444';
const AUDIT_SERIES_ID = 'long-metadata-archive';
const AUDIT_MEDIA_PATH = '/media/shadow-garden/books/e2e-reader-audit-large.epub';
const auditEpub = await fs.readFile(new URL('../.generated/reader-audit-large.epub', import.meta.url));
const readerUrl = `/reader.html?book=${encodeURIComponent(AUDIT_BOOK_ID)}&series=${encodeURIComponent(AUDIT_SERIES_ID)}`;

async function fulfillAuditEpub(route, counters) {
  const headers = route.request().headers();
  const range = headers.range || headers.Range || '';
  const match = String(range).match(/^bytes=(\d+)-(\d*)$/i);
  counters.mediaRequests += 1;
  if (match) {
    const start = Math.min(Number(match[1]) || 0, auditEpub.length - 1);
    const requestedEnd = match[2] ? Number(match[2]) : auditEpub.length - 1;
    const end = Math.max(start, Math.min(Number.isFinite(requestedEnd) ? requestedEnd : auditEpub.length - 1, auditEpub.length - 1));
    const body = auditEpub.subarray(start, end + 1);
    counters.mediaBytesServed += body.length;
    await route.fulfill({
      status: 206,
      contentType: 'application/epub+zip',
      headers: {
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
        'content-range': `bytes ${start}-${end}/${auditEpub.length}`,
        'content-length': String(body.length)
      },
      body
    });
    return;
  }
  counters.mediaBytesServed += auditEpub.length;
  await route.fulfill({
    status: 200,
    contentType: 'application/epub+zip',
    headers: {
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
      'content-length': String(auditEpub.length)
    },
    body: auditEpub
  });
}

async function installAuditRoutes(page, counters) {
  await page.route('**/book-access', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    let body = null;
    try { body = route.request().postDataJSON(); } catch {}
    if (String(body?.bookId || '') !== AUDIT_BOOK_ID) return route.fallback();
    counters.accessRequests += 1;
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        bookId: AUDIT_BOOK_ID,
        url: `${AUDIT_MEDIA_PATH}?sig=v2.11-owner-audit&exp=${expiresAt}`,
        expiresAt,
        ttlSeconds: 3600
      })
    });
  });
  await page.route('**/media/shadow-garden/books/e2e-reader-audit-large.epub*', route => fulfillAuditEpub(route, counters));
}

async function waitForReadable(page) {
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 30_000 });
  await expect(page.locator('#bookTitle')).toHaveText('Shadow Garden Reader Audit — Large Volume');
  await expect.poll(async () => page.locator('#viewer iframe').count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(async () => page.locator('#viewer iframe').first().evaluate(frame => String(frame.contentDocument?.body?.innerText || '').length), { timeout: 20_000 }).toBeGreaterThan(120);
}

async function waitForPageMap(page) {
  await page.waitForFunction(() => Number(window.__sgCanonicalPageMap?.totalPages || 0) > 0, null, { timeout: 30_000 });
  await expect.poll(() => page.locator('iframe[data-sg-page-map-sandbox]').count(), { timeout: 10_000 }).toBe(0);
  await page.waitForTimeout(300);
}

async function ensureSettingsOpen(page) {
  const drawer = page.locator('#settingsDrawer');
  if (!String(await drawer.getAttribute('class') || '').includes('open')) await page.locator('#settingsToggle').click();
  await expect(drawer).toHaveClass(/open/);
}

async function closeSettings(page) {
  const drawer = page.locator('#settingsDrawer');
  if (!String(await drawer.getAttribute('class') || '').includes('open')) return;
  await page.getByRole('button', { name: 'Close reading settings' }).click();
  await expect(drawer).not.toHaveClass(/open/);
}

async function switchFlow(page, flow) {
  await ensureSettingsOpen(page);
  await page.locator('#flowSelect').selectOption(flow);
  await expect(page.locator('body')).toHaveClass(flow === 'scrolled-doc' ? /reader-flow-scrolled/ : /reader-flow-paginated/, { timeout: 20_000 });
  await expect.poll(async () => page.locator('#viewer iframe').count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await closeSettings(page);
}

async function openAuditChapter(page, chapter) {
  const name = `Audit Chapter ${chapter}`;
  await page.locator('#tocToggle').click();
  await expect(page.locator('#tocDrawer')).toHaveClass(/open/);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.locator('#tocDrawer')).not.toHaveClass(/open/);
  await expect(page.locator('#chapterTitle')).toHaveText(name, { timeout: 15_000 });
}

async function readerShape(page) {
  return page.evaluate(() => ({
    iframes: document.querySelectorAll('#viewer iframe').length,
    views: document.querySelectorAll('#viewer .epub-view').length,
    pageMapSandboxes: document.querySelectorAll('iframe[data-sg-page-map-sandbox]').length,
    flow: document.body.classList.contains('reader-flow-scrolled') ? 'scrolled-doc' : 'paginated',
    pageMapPages: Number(window.__sgCanonicalPageMap?.totalPages || 0),
    progressText: document.getElementById('progressText')?.textContent || ''
  }));
}

async function collectMetrics(page, cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(150);
  const response = await cdp.send('Performance.getMetrics');
  const wanted = new Set(['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'JSEventListeners', 'LayoutCount', 'RecalcStyleCount', 'TaskDuration', 'ScriptDuration']);
  const performance = Object.fromEntries(response.metrics.filter(metric => wanted.has(metric.name)).map(metric => [metric.name, metric.value]));
  return { ...performance, ...(await readerShape(page)) };
}

function delta(after, before) {
  const keys = ['JSHeapUsedSize', 'Nodes', 'Documents', 'JSEventListeners', 'LayoutCount', 'RecalcStyleCount', 'TaskDuration', 'ScriptDuration'];
  return Object.fromEntries(keys.map(key => [key, Number(after?.[key]) - Number(before?.[key])]));
}

test('v2.11B audit: isolate live-rendition churn from Page Map supersession retention', async ({ page, context, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'CDP ownership measurement is Chromium-desktop audit evidence');
  test.setTimeout(130_000);

  const counters = { accessRequests: 0, mediaRequests: 0, mediaBytesServed: 0 };
  await installAuditRoutes(page, counters);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  await page.goto(readerUrl);
  await waitForReadable(page);
  await waitForPageMap(page);
  const settledBaseline = await collectMetrics(page, cdp);

  // Phase 1: destroy/recreate the live rendition repeatedly while keeping canonical-map
  // geometry fixed. Capture both immediate churn pressure and retained resources after the
  // Continuous buffer/debounce/trim lifecycle has had time to drain.
  for (let cycle = 0; cycle < 6; cycle += 1) {
    await switchFlow(page, 'scrolled-doc');
    const scroller = page.locator('#viewer .epub-container');
    await expect(scroller).toBeVisible();
    await scroller.evaluate(node => {
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      node.scrollTop = Math.min(max, node.scrollTop + Math.max(180, node.clientHeight * 0.35));
      node.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(80);
    await switchFlow(page, 'paginated');
  }
  await page.waitForTimeout(350);
  const afterFlowChurn = await collectMetrics(page, cdp);
  await page.waitForTimeout(2200);
  const afterFlowSettle = await collectMetrics(page, cdp);

  // Phase 2: stay in Pages mode and alternate viewport geometry slowly enough for each
  // debounced map refresh to begin, but faster than a full large-volume map completes.
  // That deliberately exercises Page Map supersession without adding rendition flow churn.
  const sizes = [
    { width: 1180, height: 760 },
    { width: 1280, height: 720 },
    { width: 1160, height: 780 },
    { width: 1300, height: 700 },
    { width: 1200, height: 750 },
    { width: 1280, height: 720 }
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForTimeout(1150);
  }
  await waitForPageMap(page);
  const afterViewportChurn = await collectMetrics(page, cdp);

  const report = {
    fixture: { bytes: auditEpub.length, chapters: 18, paragraphsPerChapter: 72 },
    cycles: { flow: 6, viewport: sizes.length },
    requests: { ...counters },
    settledBaseline,
    afterFlowChurn,
    afterFlowSettle,
    afterViewportChurn,
    flowPeakDelta: delta(afterFlowChurn, settledBaseline),
    flowSettledDelta: delta(afterFlowSettle, settledBaseline),
    reclaimedDuringFlowSettle: delta(afterFlowSettle, afterFlowChurn),
    viewportDelta: delta(afterViewportChurn, afterFlowSettle),
    totalDelta: delta(afterViewportChurn, settledBaseline)
  };

  console.log(`READER_V2_11B_OWNERSHIP_AUDIT ${JSON.stringify(report)}`);
  await testInfo.attach('reader-v2.11B-ownership-audit.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json'
  });

  expect(afterViewportChurn.flow).toBe('paginated');
  expect(afterViewportChurn.iframes).toBe(1);
  expect(afterViewportChurn.pageMapSandboxes).toBe(0);
  expect(afterViewportChurn.pageMapPages).toBeGreaterThan(0);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('v2.11B audit: sustained Continuous traversal remains bounded after buffer trim', async ({ page, context, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'CDP long-session measurement is Chromium-desktop audit evidence');
  test.setTimeout(150_000);

  const counters = { accessRequests: 0, mediaRequests: 0, mediaBytesServed: 0 };
  await installAuditRoutes(page, counters);
  await page.addInitScript(() => {
    window.__sgReaderContinuousAuditLongTasks = [];
    try {
      if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__sgReaderContinuousAuditLongTasks.push({ startTime: entry.startTime, duration: entry.duration });
        });
        observer.observe({ entryTypes: ['longtask'] });
      }
    } catch {}
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto(readerUrl);
  await waitForReadable(page);
  await waitForPageMap(page);
  await switchFlow(page, 'scrolled-doc');

  // Let the initial Continuous neighborhood and trim timers settle before measuring the
  // traversal itself. This keeps one live rendition for the entire workload.
  await page.waitForTimeout(2200);
  const baseline = await collectMetrics(page, cdp);
  const accessAtBaseline = counters.accessRequests;
  let maxViews = baseline.views;
  let maxIframes = baseline.iframes;

  const chapters = [2, 4, 6, 8, 10, 12, 14, 16, 18];
  for (const chapter of chapters) {
    await openAuditChapter(page, chapter);
    const scroller = page.locator('#viewer .epub-container');
    await expect(scroller).toBeVisible();
    await scroller.evaluate(node => {
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      node.scrollTop = Math.min(max, node.scrollTop + Math.max(260, node.clientHeight * 0.55));
      node.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(280);
    const shape = await readerShape(page);
    maxViews = Math.max(maxViews, Number(shape.views) || 0);
    maxIframes = Math.max(maxIframes, Number(shape.iframes) || 0);
  }

  // Continuous owns a bounded neighbor buffer. Let its 1.4s idle trim and any queued view
  // work complete, then force GC so the final snapshot measures retained session state.
  await page.waitForTimeout(2200);
  const settled = await collectMetrics(page, cdp);
  const longTasks = await page.evaluate(() => Array.isArray(window.__sgReaderContinuousAuditLongTasks) ? window.__sgReaderContinuousAuditLongTasks : []);
  const report = {
    fixture: { bytes: auditEpub.length, chapters: 18, paragraphsPerChapter: 72 },
    chaptersVisited: chapters,
    requests: { ...counters },
    baseline,
    settled,
    retainedDelta: delta(settled, baseline),
    peakLiveShape: { views: maxViews, iframes: maxIframes },
    longTasks: {
      count: longTasks.length,
      totalDurationMs: longTasks.reduce((sum, entry) => sum + Number(entry.duration || 0), 0),
      maxDurationMs: longTasks.reduce((max, entry) => Math.max(max, Number(entry.duration || 0)), 0)
    }
  };

  console.log(`READER_V2_11B_CONTINUOUS_AUDIT ${JSON.stringify(report)}`);
  await testInfo.attach('reader-v2.11B-continuous-audit.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json'
  });

  expect(counters.accessRequests).toBe(accessAtBaseline);
  expect(settled.flow).toBe('scrolled-doc');
  expect(settled.pageMapSandboxes).toBe(0);
  expect(settled.pageMapPages).toBeGreaterThan(0);
  expect(settled.views).toBeLessThanOrEqual(12);
  expect(settled.iframes).toBeLessThanOrEqual(12);
  expect(String(settled.progressText)).toMatch(/%/);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
