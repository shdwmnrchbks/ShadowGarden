import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../support/fixtures.mjs';

const epubPath = fileURLToPath(new URL('../.generated/reader-fixture.epub', import.meta.url));
const epubSize = statSync(epubPath).size;

async function fulfillJson(route, value, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(value)
  });
}

function libraryPayload() {
  return {
    main: [{
      id: 'moonlit-reader-fixture',
      title: 'Moonlit Reader Fixture',
      author: 'Existing Keeper',
      status: 'Ongoing',
      genres: ['Fantasy'],
      tags: [],
      volumes: [{
        title: 'Moonlit Reader Fixture Volume 2',
        number: 2,
        size: Math.max(1, Math.round(epubSize * 0.99)),
        originalFilename: 'moonlit-reader-fixture-volume-2.epub'
      }]
    }],
    adult: [],
    counts: { main: 1, adult: 0, series: 1, volumes: 1 }
  };
}

async function installRoutes(page, state) {
  await page.route('**/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: `
      window.turnstile = {
        render(host, options) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.e2eTurnstile = '1';
          button.textContent = 'Complete Keeper verification';
          button.addEventListener('click', () => options.callback('e2e-turnstile-token'));
          host.replaceChildren(button);
          return 'e2e-widget';
        },
        reset() {}
      };
    `
  }));

  await page.route('**/admin-access', async route => {
    const method = route.request().method();
    if (method === 'GET') return fulfillJson(route, { siteKey: 'e2e-site-key', action: 'admin_access' });
    if (method === 'POST' || method === 'DELETE') return fulfillJson(route, { ok: true });
    return route.fulfill({ status: 405, body: '' });
  });

  await page.route('**/admin-api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let body = null;
    if (request.postData()) {
      try { body = request.postDataJSON(); }
      catch { body = request.postData(); }
    }
    state.requests.push({ path, method, body });

    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, libraryPayload());
    if (path === '/admin-api/upload' && method === 'POST') {
      state.uploadCount += 1;
      return fulfillJson(route, { ok: true, key: url.searchParams.get('key') || '' });
    }
    if (path === '/admin-api/catalog' && method === 'POST') {
      state.catalogCount += 1;
      state.catalogBody = body;
      return fulfillJson(route, { ok: true, seriesId: 'moonlit-reader-fixture', seriesTitle: 'Moonlit Reader Fixture' });
    }
    return fulfillJson(route, { ok: true });
  });
}

async function unlockKeeper(page) {
  await page.goto('/admin.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 12_000 }).toBe(true);
  await page.locator('#adminToken').fill('e2e-keeper-token');
  await page.locator('#unlockButton').click();
  await page.locator('[data-e2e-turnstile]').click();
  await expect(page.locator('#authState')).toHaveText('UNLOCKED');
}

test('Garden Keeper warns on a high-confidence adjacent similar volume without blocking upload', async ({ page, browserDiagnostics }) => {
  const state = { requests: [], uploadCount: 0, catalogCount: 0, catalogBody: null };
  await installRoutes(page, state);
  await unlockKeeper(page);

  await page.locator('#openNewBooks').click();
  await page.locator('#epubFile').setInputFiles(epubPath);
  await expect(page.locator('#fileState')).toHaveText('READY', { timeout: 15_000 });
  await expect(page.locator('#titleInput')).toHaveValue('Moonlit Reader Fixture');
  await expect(page.locator('#volumeInput')).toHaveValue('1');

  const card = page.locator('#batchList .batch-item').first();
  await expect(card).toHaveAttribute('data-action', 'new');
  await expect(page.locator('[data-similar-volume-badge]')).toHaveText('SIMILAR');
  await expect(page.locator('[data-similar-volume-warning]')).toContainText('Possible similar volume: Moonlit Reader Fixture · Moonlit Reader Fixture Volume 2');
  await expect(page.locator('[data-similar-volume-warning]')).toContainText('adjacent volume 2');
  await expect(page.locator('[data-similar-volume-warning]')).toContainText('matching title pattern');
  await expect(page.locator('[data-similar-volume-warning]')).toContainText('Upload remains allowed.');
  await expect(page.locator('#batchSummary')).toContainText('1 similar warning');
  await expect(page.locator('#uploadButton')).toBeEnabled();

  await page.locator('#volumeInput').fill('4');
  await expect(page.locator('[data-similar-volume-badge]')).toHaveCount(0);
  await expect(page.locator('[data-similar-volume-warning]')).toHaveCount(0);
  await expect(page.locator('#batchSummary')).not.toContainText('similar warning');
  await expect(card).toHaveAttribute('data-action', 'new');
  await expect(page.locator('#uploadButton')).toBeEnabled();

  await page.locator('#volumeInput').fill('1');
  await expect(page.locator('[data-similar-volume-badge]')).toHaveText('SIMILAR');
  await expect(page.locator('[data-similar-volume-warning]')).toContainText('Upload remains allowed.');
  await expect(card).toHaveAttribute('data-action', 'new');

  await page.locator('#uploadButton').click();
  await expect.poll(() => state.catalogCount).toBe(1);
  expect(state.uploadCount).toBeGreaterThanOrEqual(1);
  expect(state.catalogBody).toMatchObject({
    series: 'Moonlit Reader Fixture',
    number: 1,
    duplicatePolicy: 'reject'
  });
  expect(state.requests.filter(entry => entry.path === '/admin-api/catalog' && entry.method === 'POST')).toHaveLength(1);
  expect(browserDiagnostics).toEqual([]);
});
