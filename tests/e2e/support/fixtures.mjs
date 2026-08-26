import fs from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';

const fixtureUrl = name => new URL(`../../fixtures/${name}`, import.meta.url);
const mainCatalog = JSON.parse(await fs.readFile(fixtureUrl('catalog-main.json'), 'utf8'));
const adultCatalog = JSON.parse(await fs.readFile(fixtureUrl('catalog-adult.json'), 'utf8'));
const readerEpub = await fs.readFile(new URL('../.generated/reader-fixture.epub', import.meta.url));
const transparentSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="12" viewBox="0 0 8 12"><rect width="8" height="12" fill="#151a17"/></svg>';

export const READER_BOOK_ID = 'bk_1111111111111111111111';
export const READER_SERIES_ID = 'moonlit-single';
export const READER_MEDIA_PATH = '/media/shadow-garden/books/e2e-reader.epub';

async function fulfillJson(route, value) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(value)
  });
}

async function fulfillReaderEpub(route) {
  const headers = route.request().headers();
  const range = headers.range || headers.Range || '';
  const match = String(range).match(/^bytes=(\d+)-(\d*)$/i);
  if (match) {
    const start = Math.min(Number(match[1]) || 0, readerEpub.length - 1);
    const requestedEnd = match[2] ? Number(match[2]) : readerEpub.length - 1;
    const end = Math.max(start, Math.min(Number.isFinite(requestedEnd) ? requestedEnd : readerEpub.length - 1, readerEpub.length - 1));
    const body = readerEpub.subarray(start, end + 1);
    await route.fulfill({
      status: 206,
      contentType: 'application/epub+zip',
      headers: {
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
        'content-range': `bytes ${start}-${end}/${readerEpub.length}`,
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
      'content-length': String(readerEpub.length)
    },
    body: readerEpub
  });
}

async function installFixtureRoutes(page) {
  await page.route('**/data/source.json', route => fulfillJson(route, { mode: 'local' }));
  await page.route('**/data/catalog.json', route => fulfillJson(route, mainCatalog));
  await page.route('**/data/adult-catalog.json', route => fulfillJson(route, adultCatalog));
  await page.route('**/data/version.json', route => fulfillJson(route, { version: '2.6.0-e2e', commit: 'fixture' }));
  await page.route('**/media/shadow-garden/covers/**', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: transparentSvg }));
  await page.route('**/book-access', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    return fulfillJson(route, {
      ok: true,
      bookId: READER_BOOK_ID,
      url: `${READER_MEDIA_PATH}?sig=e2e&exp=${expiresAt}`,
      expiresAt,
      ttlSeconds: 3600
    });
  });
  await page.route('**/media/shadow-garden/books/e2e-reader.epub*', fulfillReaderEpub);
}

export const test = base.extend({
  fixtureRoutes: [async ({ page }, use) => {
    await installFixtureRoutes(page);
    await use();
  }, { auto: true }],
  browserDiagnostics: [async ({ page }, use, testInfo) => {
    const diagnostics = [];
    page.on('pageerror', error => diagnostics.push({ type: 'pageerror', message: error.message, stack: error.stack || '', url: page.url() }));
    page.on('console', message => {
      if (message.type() === 'error') diagnostics.push({ type: 'console', message: message.text(), url: page.url() });
    });
    page.on('requestfailed', request => diagnostics.push({
      type: 'requestfailed',
      url: request.url(),
      message: request.failure()?.errorText || 'request failed'
    }));
    await use(diagnostics);
    if (testInfo.status !== testInfo.expectedStatus || diagnostics.length) {
      await testInfo.attach('browser-diagnostics.json', {
        body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
        contentType: 'application/json'
      });
    }
  }, { auto: true }]
});

export { expect };
