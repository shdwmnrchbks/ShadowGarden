import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../support/fixtures.mjs';

const epubPath = fileURLToPath(new URL('../.generated/reader-fixture.epub', import.meta.url));

async function fulfillJson(route, value, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(value)
  });
}

async function installKeeperRoutes(page, state) {
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
    state.requests.push({ path: url.pathname, method: request.method() });

    if (url.pathname === '/admin-api/status' && request.method() === 'POST') return fulfillJson(route, { ok: true });
    if (url.pathname === '/admin-api/library' && request.method() === 'GET') return fulfillJson(route, {
      main: [],
      adult: [],
      counts: { main: 0, adult: 0, series: 0, volumes: 0 }
    });

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
  await expect(page.locator('#dashboardView')).toBeVisible();
}

test('Garden Keeper aggregates import preflight warnings and blocked files into actionable review handoffs', async ({ page, browserDiagnostics }) => {
  const state = { requests: [] };
  await installKeeperRoutes(page, state);
  await unlockKeeper(page);

  await page.locator('#openNewBooks').click();
  const dialog = page.locator('#addBooksDialog');
  await expect(dialog).toBeVisible();

  const validEpub = await readFile(epubPath);
  await page.locator('#epubFile').setInputFiles([
    {
      name: 'reader-fixture.epub',
      mimeType: 'application/epub+zip',
      buffer: validEpub
    },
    {
      name: 'broken-report.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from('not a readable EPUB archive')
    }
  ]);

  await expect(page.locator('#fileState')).toHaveText('REVIEW', { timeout: 15_000 });
  await expect(page.locator('#batchList .batch-item')).toHaveCount(2);

  const report = page.locator('[data-import-preflight-report]');
  await expect(report).toBeVisible();
  await expect(report).toContainText('IMPORT REPORT');
  await expect(report).toContainText('Preflight & actions');
  await expect(report.locator('.import-report-head > b')).toHaveText('2 need review');
  await expect(report.locator('.import-report-metrics')).toContainText('1 ready');
  await expect(report.locator('.import-report-metrics')).toContainText('1 warning');
  await expect(report.locator('.import-report-metrics')).toContainText('1 blocked');

  const blocked = report.locator('.import-report-item.blocked', { hasText: 'broken-report.epub' });
  await expect(blocked).toContainText('This file is not a readable EPUB/ZIP archive.');
  await expect(blocked).toContainText('Upload is blocked.');
  await blocked.locator('[data-import-review]').click();

  const failedRow = page.locator('#batchList .batch-item.failed', { hasText: 'broken-report.epub' });
  await expect(failedRow).toBeFocused();

  const warning = report.locator('.import-report-item.warning', { hasText: 'Moonlit Reader Fixture' });
  await expect(warning).toContainText('WARNING');
  await warning.locator('[data-import-review]').click();

  const preflight = page.locator('#preflightCard');
  await expect(preflight).toBeVisible();
  await expect(preflight.locator('.preflight-collapse-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(preflight).toContainText('Readable with warnings');

  expect(state.requests.filter(entry => entry.path === '/admin-api/upload')).toEqual([]);
  expect(state.requests.filter(entry => entry.path === '/admin-api/catalog')).toEqual([]);
  expect(browserDiagnostics).toEqual([]);
});
