import fs from 'node:fs/promises';
import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;
const progressKey = `sg-progress:${READER_BOOK_ID}`;
const imperfectEpub = await fs.readFile(new URL('../.generated/reader-imperfect.epub', import.meta.url));
const corruptEpub = await fs.readFile(new URL('../.generated/reader-corrupt.epub', import.meta.url));

async function fulfillEpub(route, bytes) {
  const headers = route.request().headers();
  const range = headers.range || headers.Range || '';
  const match = String(range).match(/^bytes=(\d+)-(\d*)$/i);
  if (match) {
    const start = Math.min(Number(match[1]) || 0, Math.max(0, bytes.length - 1));
    const requestedEnd = match[2] ? Number(match[2]) : bytes.length - 1;
    const end = Math.max(start, Math.min(Number.isFinite(requestedEnd) ? requestedEnd : bytes.length - 1, bytes.length - 1));
    const body = bytes.subarray(start, end + 1);
    await route.fulfill({
      status: 206,
      contentType: 'application/epub+zip',
      headers: {
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
        'content-range': `bytes ${start}-${end}/${bytes.length}`,
        'content-length': String(body.length)
      },
      body
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/epub+zip',
    headers: {
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
      'content-length': String(bytes.length)
    },
    body: bytes
  });
}

async function overrideReaderEpub(page, bytes) {
  await page.route('**/media/shadow-garden/books/e2e-reader.epub*', route => fulfillEpub(route, bytes));
}

test('Reader opens a common imperfect EPUB with missing title and navigation metadata', async ({ page, browserDiagnostics }) => {
  await overrideReaderEpub(page, imperfectEpub);
  await page.goto(readerUrl);

  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#bookTitle')).toHaveText('Untitled EPUB');
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect(page.frameLocator('#viewer iframe').getByRole('heading', { name: 'Readable Imperfect Chapter' })).toBeVisible();

  await page.locator('#tocToggle').click();
  await expect(page.locator('#tocDrawer')).toHaveClass(/open/);
  await expect(page.locator('#tocPanel .toc-link')).toHaveCount(0);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('Reader discards one stale saved CFI and opens first readable content', async ({ page, browserDiagnostics }) => {
  const staleCfi = 'epubcfi(/6/999!/4/999/2:999)';
  await page.addInitScript(({ key, bookId, cfi }) => {
    localStorage.setItem(key, JSON.stringify({
      file: bookId,
      cfi,
      percentage: 0.61,
      page: null,
      totalPages: null,
      pageMapFingerprint: null,
      updatedAt: Date.now()
    }));
  }, { key: progressKey, bookId: READER_BOOK_ID, cfi: staleCfi });

  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect(page.frameLocator('#viewer iframe').getByRole('heading', { name: 'Chapter One' })).toBeVisible();
  await expect.poll(async () => page.evaluate(key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null')?.cfi || ''; }
    catch { return ''; }
  }, progressKey), { timeout: 12_000 }).not.toBe(staleCfi);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('Reader contains corrupt EPUB parser failures in actionable chrome', async ({ page, browserDiagnostics }) => {
  await overrideReaderEpub(page, corruptEpub);
  await page.goto(readerUrl);

  const loading = page.locator('#readerLoading');
  await expect(loading).not.toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(loading).toHaveAttribute('role', 'alert');
  await expect(loading.getByRole('heading')).toHaveText(/EPUB appears incomplete or damaged|could not open this EPUB/);
  await expect(loading.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(loading.getByRole('link', { name: 'Return to library' })).toHaveAttribute('href', `/series.html?id=${encodeURIComponent(READER_SERIES_ID)}`);
  await expect(loading).not.toContainText(/central directory|JSZip|stack|TypeError/i);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
