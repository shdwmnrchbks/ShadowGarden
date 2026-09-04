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
        url: `${AUDIT_MEDIA_PATH}?sig=v2.11-audit&exp=${expiresAt}`,
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
  await expect.poll(async () => String(await page.evaluate(id => {
    try { return JSON.parse(localStorage.getItem(`sg-progress:${id}`) || 'null')?.cfi || ''; }
    catch { return ''; }
  }, AUDIT_BOOK_ID)), { timeout: 20_000 }).toContain('epubcfi');
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
  return page.evaluate(() => {
    const sandboxes = [...document.querySelectorAll('iframe[data-sg-page-map-sandbox]')];
    let sandboxNestedIframes = 0;
    let sandboxViews = 0;
    for (const frame of sandboxes) {
      try {
        sandboxNestedIframes += frame.contentDocument?.querySelectorAll('iframe').length || 0;
        sandboxViews += frame.contentDocument?.querySelectorAll('.epub-view').length || 0;
      } catch {}
    }
    return {
      iframes: document.querySelectorAll('#viewer iframe').length,
      views: document.querySelectorAll('#viewer .epub-view').length,
      pageMapSandboxes: sandboxes.length,
      pageMapSandboxIframes: sandboxNestedIframes,
      pageMapSandboxViews: sandboxViews,
      flow: document.body.classList.contains('reader-flow-scrolled') ? 'scrolled-doc' : 'paginated',
      pageMapPages: Number(window.__sgCanonicalPageMap?.totalPages || 0),
      progressText: document.getElementById('progressText')?.textContent || ''
    };
  });
}

async function collectRuntimeMetrics(page, cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(120);
  const response = await cdp.send('Performance.getMetrics');
  const wanted = new Set(['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'JSEventListeners', 'LayoutCount', 'RecalcStyleCount', 'TaskDuration', 'ScriptDuration']);
  const performance = Object.fromEntries(response.metrics.filter(metric => wanted.has(metric.name)).map(metric => [metric.name, metric.value]));
  const shape = await readerShape(page);
  return { ...performance, ...shape };
}

function numericDelta(after, before, key) {
  const right = Number(after?.[key]);
  const left = Number(before?.[key]);
  return Number.isFinite(right) && Number.isFinite(left) ? right - left : null;
}

function metricDelta(after, before) {
  return {
    JSHeapUsedSize: numericDelta(after, before, 'JSHeapUsedSize'),
    Nodes: numericDelta(after, before, 'Nodes'),
    Documents: numericDelta(after, before, 'Documents'),
    JSEventListeners: numericDelta(after, before, 'JSEventListeners'),
    LayoutCount: numericDelta(after, before, 'LayoutCount'),
    RecalcStyleCount: numericDelta(after, before, 'RecalcStyleCount'),
    TaskDuration: numericDelta(after, before, 'TaskDuration'),
    ScriptDuration: numericDelta(after, before, 'ScriptDuration')
  };
}

test('v2.11B audit: large EPUB startup and repeated Reader lifecycle remain bounded', async ({ page, context, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'CDP runtime measurement is Chromium-desktop audit evidence');
  test.setTimeout(150_000);

  const counters = { accessRequests: 0, mediaRequests: 0, mediaBytesServed: 0 };
  await installAuditRoutes(page, counters);
  await page.addInitScript(() => {
    window.__sgReaderAuditLongTasks = [];
    try {
      if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__sgReaderAuditLongTasks.push({ startTime: entry.startTime, duration: entry.duration });
        });
        observer.observe({ entryTypes: ['longtask'] });
      }
    } catch {}
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  const startedAt = Date.now();
  await page.goto(readerUrl);
  await waitForReadable(page);
  const firstReadableMs = Date.now() - startedAt;
  let pageMapReadyObservedMs = null;
  const observePageMap = async () => {
    const pages = Number(await page.evaluate(() => window.__sgCanonicalPageMap?.totalPages || 0));
    if (pages > 0 && pageMapReadyObservedMs === null) pageMapReadyObservedMs = Date.now() - startedAt;
    return pages;
  };
  await observePageMap();

  const baseline = await collectRuntimeMetrics(page, cdp);
  const accessAtBaseline = counters.accessRequests;
  expect(accessAtBaseline).toBe(1);

  const chapters = [4, 7, 10, 13, 16, 18];
  for (let index = 0; index < chapters.length; index += 1) {
    await switchFlow(page, 'scrolled-doc');
    await openAuditChapter(page, chapters[index]);
    const scroller = page.locator('#viewer .epub-container');
    await expect(scroller).toBeVisible();
    await scroller.evaluate(node => {
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      node.scrollTop = Math.min(max, node.scrollTop + Math.max(280, node.clientHeight * 0.65));
      node.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(90);

    // Fresh lifecycle signals must use the cached signed ticket rather than creating request churn.
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await page.waitForTimeout(50);

    await switchFlow(page, 'paginated');
    await page.setViewportSize(index % 2 ? { width: 1180, height: 760 } : { width: 1280, height: 720 });
    await page.waitForTimeout(180);
    await observePageMap();
  }

  expect(counters.accessRequests).toBe(accessAtBaseline);

  const beforeExpiredWake = counters.accessRequests;
  await page.evaluate(() => {
    const realNow = Date.now;
    const wakeAt = realNow() + 3_700_000;
    Date.now = () => wakeAt;
    try { window.dispatchEvent(new Event('pageshow')); }
    finally { Date.now = realNow; }
  });
  await expect.poll(() => counters.accessRequests, { timeout: 10_000 }).toBe(beforeExpiredWake + 1);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/);
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await observePageMap();

  // This snapshot intentionally captures the Reader while background canonical Page Map work may
  // still be live. The settled snapshot below distinguishes temporary mapping pressure from retained
  // resources after the page-map sandbox has completed and its finally teardown has run.
  const activeGeneration = await collectRuntimeMetrics(page, cdp);
  const requestsAtActiveGeneration = { ...counters };
  let pageMapSettled = false;
  try {
    await page.waitForFunction(() => Number(window.__sgCanonicalPageMap?.totalPages || 0) > 0, null, { timeout: 70_000 });
    pageMapSettled = true;
    await observePageMap();
  } catch {}
  await page.waitForTimeout(300);
  const settled = await collectRuntimeMetrics(page, cdp);

  const longTasks = await page.evaluate(() => Array.isArray(window.__sgReaderAuditLongTasks) ? window.__sgReaderAuditLongTasks : []);
  const report = {
    fixture: {
      bytes: auditEpub.length,
      chapters: 18,
      paragraphsPerChapter: 72
    },
    firstReadableMs,
    pageMapReadyObservedMs,
    pageMapSettled,
    cycles: chapters.length,
    requestsAtActiveGeneration,
    requestsAfterSettleWait: { ...counters },
    baseline,
    activeGeneration,
    settled,
    deltaWhileGenerating: metricDelta(activeGeneration, baseline),
    deltaAfterSettle: metricDelta(settled, baseline),
    reclaimedAfterSettle: metricDelta(settled, activeGeneration),
    longTasks: {
      count: longTasks.length,
      totalDurationMs: longTasks.reduce((sum, entry) => sum + Number(entry.duration || 0), 0),
      maxDurationMs: longTasks.reduce((max, entry) => Math.max(max, Number(entry.duration || 0)), 0)
    }
  };

  console.log(`READER_V2_11B_RUNTIME_AUDIT ${JSON.stringify(report)}`);
  await testInfo.attach('reader-v2.11B-runtime-audit.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json'
  });

  expect(settled.flow).toBe('paginated');
  expect(settled.iframes).toBe(1);
  expect(String(settled.progressText)).toMatch(/%/);
  expect(counters.mediaRequests).toBeGreaterThan(0);
  expect(counters.mediaBytesServed).toBeGreaterThan(0);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
