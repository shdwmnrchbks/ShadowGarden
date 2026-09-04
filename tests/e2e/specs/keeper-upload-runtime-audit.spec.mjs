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

async function installRoutes(page, requests) {
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
          button.addEventListener('click', () => options.callback('keeper-upload-audit-token'));
          host.replaceChildren(button);
          return 'keeper-upload-audit-widget';
        },
        reset() {}
      };
    `
  }));

  await page.route('**/admin-access', async route => {
    const method = route.request().method();
    if (method === 'GET') return fulfillJson(route, { siteKey: 'keeper-upload-audit-site-key', action: 'admin_access' });
    if (method === 'POST' || method === 'DELETE') return fulfillJson(route, { ok: true });
    return route.fulfill({ status: 405, body: '' });
  });

  await page.route('**/admin-api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    requests.push({ path, method });

    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, {
      main: [],
      adult: [],
      counts: { main: 0, adult: 0, series: 0, volumes: 0 }
    });
    if (path === '/admin-api/translations' && method === 'GET') return fulfillJson(route, { series: {} });
    return fulfillJson(route, { ok: true });
  });
}

function libraryGetCount(requests) {
  return requests.filter(request => request.path === '/admin-api/library' && request.method === 'GET').length;
}

async function unlockKeeper(page) {
  await page.goto('/admin.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 12_000 }).toBe(true);
  await page.locator('#adminToken').fill('keeper-upload-audit-token');
  await page.locator('#unlockButton').click();
  await page.locator('[data-e2e-turnstile]').click();
  await expect(page.locator('#authState')).toHaveText('UNLOCKED');
  await expect(page.locator('#dashboardView')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper?.state?.management !== null)).toBe(true);
}

async function preflightFixture(page) {
  await page.locator('#openNewBooks').click();
  await expect(page.locator('#addBooksDialog')).toBeVisible();
  await page.locator('#epubFile').setInputFiles(epubPath);
  await expect(page.locator('#fileState')).toHaveText('READY', { timeout: 15_000 });
  await expect(page.locator('#metadataCard')).toBeVisible();
}

test('v2.11D audit: Keeper upload preflight reuses the unlocked Library snapshot', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Chromium desktop request ownership audit');

  const requests = [];
  await installRoutes(page, requests);
  await unlockKeeper(page);

  const afterUnlock = libraryGetCount(requests);
  expect(afterUnlock).toBe(1);

  await preflightFixture(page);

  const afterPreflight = libraryGetCount(requests);
  console.log('KEEPER_V2_11D_UPLOAD_LIBRARY_AUDIT', JSON.stringify({
    libraryGets: {
      afterUnlock,
      afterPreflight,
      preflightDelta: afterPreflight - afterUnlock
    }
  }));

  expect(afterPreflight).toBe(1);
  expect(browserDiagnostics).toEqual([]);
});

test('v2.11D audit: Keeper upload preflight fetches once when no Library snapshot is available', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Chromium desktop request ownership audit');

  const requests = [];
  await installRoutes(page, requests);
  await unlockKeeper(page);

  const afterUnlock = libraryGetCount(requests);
  expect(afterUnlock).toBe(1);
  await page.evaluate(() => {
    window.ShadowGardenKeeper.state.management = null;
    window.ShadowGardenKeeper.state.batch.library = null;
  });

  await preflightFixture(page);

  const afterFallback = libraryGetCount(requests);
  console.log('KEEPER_V2_11D_UPLOAD_LIBRARY_FALLBACK_AUDIT', JSON.stringify({
    libraryGets: {
      afterUnlock,
      afterFallback,
      preflightDelta: afterFallback - afterUnlock
    }
  }));

  expect(afterFallback).toBe(2);
  expect(browserDiagnostics).toEqual([]);
});
