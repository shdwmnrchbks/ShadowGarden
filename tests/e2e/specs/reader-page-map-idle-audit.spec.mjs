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
        url: `${AUDIT_MEDIA_PATH}?sig=v2.11-idle-audit&exp=${expiresAt}`,
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

async function collectMetrics(page, cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(120);
  const response = await cdp.send('Performance.getMetrics');
  const wanted = new Set(['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'JSEventListeners', 'LayoutCount', 'RecalcStyleCount', 'TaskDuration', 'ScriptDuration']);
  const metrics = Object.fromEntries(response.metrics.filter(metric => wanted.has(metric.name)).map(metric => [metric.name, metric.value]));
  const shape = await page.evaluate(() => ({
    viewerIframes: document.querySelectorAll('#viewer iframe').length,
    viewerViews: document.querySelectorAll('#viewer .epub-view').length,
    pageMapSandboxes: document.querySelectorAll('iframe[data-sg-page-map-sandbox]').length,
    pageMapPages: Number(window.__sgCanonicalPageMap?.totalPages || 0),
    progressText: document.getElementById('progressText')?.textContent || ''
  }));
  return { ...metrics, ...shape };
}

function metricDelta(after, before) {
  const keys = ['JSHeapUsedSize', 'Nodes', 'Documents', 'JSEventListeners', 'LayoutCount', 'RecalcStyleCount', 'TaskDuration', 'ScriptDuration'];
  return Object.fromEntries(keys.map(key => [key, Number(after?.[key]) - Number(before?.[key])]));
}

test('v2.11B audit: one stable large-EPUB Page Map generation has measurable completion cost', async ({ page, context, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'CDP Page Map measurement is Chromium-desktop audit evidence');
  test.setTimeout(125_000);

  const counters = { accessRequests: 0, mediaRequests: 0, mediaBytesServed: 0 };
  await installAuditRoutes(page, counters);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  const startedAt = Date.now();
  await page.goto(readerUrl);
  await waitForReadable(page);
  const firstReadableMs = Date.now() - startedAt;
  const readable = await collectMetrics(page, cdp);

  let pageMapReadyMs = null;
  try {
    await page.waitForFunction(() => Number(window.__sgCanonicalPageMap?.totalPages || 0) > 0, null, { timeout: 90_000 });
    pageMapReadyMs = Date.now() - startedAt;
  } catch {}
  await page.waitForTimeout(300);
  const afterWait = await collectMetrics(page, cdp);

  const report = {
    fixture: { bytes: auditEpub.length, chapters: 18, paragraphsPerChapter: 72 },
    firstReadableMs,
    pageMapReadyMs,
    waitedMs: Date.now() - startedAt,
    requests: { ...counters },
    readable,
    afterWait,
    delta: metricDelta(afterWait, readable)
  };

  console.log(`READER_V2_11B_PAGE_MAP_IDLE_AUDIT ${JSON.stringify(report)}`);
  await testInfo.attach('reader-v2.11B-page-map-idle-audit.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json'
  });

  expect(afterWait.viewerIframes).toBe(1);
  expect(String(afterWait.progressText)).toMatch(/%/);
  expect(counters.accessRequests).toBe(1);
  expect(counters.mediaRequests).toBeGreaterThan(0);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
