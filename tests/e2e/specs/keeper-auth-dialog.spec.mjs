import { test, expect } from '../support/fixtures.mjs';

const keeperLibrary = {
  main: [],
  adult: [],
  counts: { main: 0, adult: 0, series: 0, volumes: 0 }
};

async function fulfillJson(route, value, status = 200, headers = {}) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store', ...headers },
    body: JSON.stringify(value)
  });
}

async function installKeeperBoundaryRoutes(page, requests) {
  await page.route('**/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: `
      window.turnstile = {
        render(host, options) {
          window.__sgE2ETurnstileOptions = options;
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.e2eTurnstile = '1';
          button.textContent = 'Complete Keeper verification';
          button.addEventListener('click', () => options.callback('e2e-turnstile-token'));
          host.replaceChildren(button);
          return 'e2e-widget';
        },
        reset() {
          window.__sgE2ETurnstileReset = (window.__sgE2ETurnstileReset || 0) + 1;
        }
      };
    `
  }));

  await page.route('**/admin-access', async route => {
    const request = route.request();
    const method = request.method();
    let body = null;
    if (method === 'POST') {
      try { body = request.postDataJSON(); }
      catch { body = request.postData(); }
    }
    requests.push({ path: '/admin-access', method, headers: request.headers(), body });

    if (method === 'GET') return fulfillJson(route, { siteKey: 'e2e-site-key', action: 'admin_access' });
    if (method === 'POST') return fulfillJson(route, { ok: true });
    if (method === 'DELETE') return fulfillJson(route, { ok: true });
    return route.fulfill({ status: 405, body: '' });
  });

  await page.route('**/admin-api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let body = null;
    if (request.postData()) {
      try { body = request.postDataJSON(); }
      catch { body = request.postData(); }
    }
    requests.push({ path, method, headers: request.headers(), body });

    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, keeperLibrary);
    if (path === '/admin-api/maintenance' && method === 'GET') return fulfillJson(route, {
      health: { status: 'healthy', counts: { series: 0, volumes: 0 }, metrics: {}, issues: [], optimizationCandidates: [] },
      taxonomy: { totalSeries: 0, canonicalGenreCount: 35, affectedSeries: 0, preview: [] }
    });
    return fulfillJson(route, { ok: true });
  });
}

async function activeDialogId(page) {
  return page.evaluate(() => document.activeElement?.closest?.('dialog[open]')?.id || '');
}

test('Garden Keeper locked → verified → unlocked keeps modal keyboard and session ownership canonical', async ({ page, browserDiagnostics }) => {
  const requests = [];
  await installKeeperBoundaryRoutes(page, requests);
  await page.goto('/admin.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 12_000 }).toBe(true);

  const lockedView = page.locator('#lockedView');
  const dashboard = page.locator('#dashboardView');
  const authState = page.locator('#authState');
  const token = page.locator('#adminToken');
  const unlock = page.locator('#unlockButton');

  await expect(lockedView).toBeVisible();
  await expect(dashboard).toHaveClass(/hidden/);
  await expect(authState).toHaveText('LOCKED');

  await unlock.click();
  await expect(authState).toHaveText('TOKEN NEEDED');
  await expect(token).toBeFocused();

  await token.fill('e2e-keeper-token');
  await unlock.click();
  const challenge = page.locator('[data-e2e-turnstile]');
  await expect(challenge).toBeVisible();
  await expect(authState).toHaveText('CHECKING');
  await challenge.click();

  await expect(lockedView).toHaveClass(/hidden/);
  await expect(dashboard).toBeVisible();
  await expect(authState).toHaveText('UNLOCKED');
  await expect(page.locator('#manageSeriesCount')).toHaveText('0');
  await expect(page.locator('#manageVolumeCount')).toHaveText('0');
  await expect(page.locator('#manageEmpty')).toBeVisible();

  const accessPost = requests.find(entry => entry.path === '/admin-access' && entry.method === 'POST');
  expect(accessPost?.body).toEqual({ adminToken: 'e2e-keeper-token', turnstileToken: 'e2e-turnstile-token' });
  const statusPost = requests.find(entry => entry.path === '/admin-api/status' && entry.method === 'POST');
  expect(statusPost?.headers?.authorization).toBe('Bearer e2e-keeper-token');
  const libraryGet = requests.find(entry => entry.path === '/admin-api/library' && entry.method === 'GET');
  expect(libraryGet?.headers?.authorization).toBe('Bearer e2e-keeper-token');

  const openNewBooks = page.locator('#openNewBooks');
  await openNewBooks.click();
  const addBooks = page.locator('#addBooksDialog');
  await expect(addBooks).toBeVisible();
  await expect.poll(() => activeDialogId(page)).toBe('addBooksDialog');
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Tab');
    await expect.poll(() => activeDialogId(page)).toBe('addBooksDialog');
  }
  await page.keyboard.press('Escape');
  await expect(addBooks).not.toBeVisible();
  await expect(openNewBooks).toBeFocused();

  const openMaintenance = page.locator('#openMaintenance');
  await openMaintenance.click();
  const maintenance = page.locator('#maintenanceDialog');
  await expect(maintenance).toBeVisible();
  await expect.poll(() => activeDialogId(page)).toBe('maintenanceDialog');
  await expect(page.locator('#gardenHealthState')).toHaveText('HEALTHY');
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Tab');
    await expect.poll(() => activeDialogId(page)).toBe('maintenanceDialog');
  }
  await page.keyboard.press('Escape');
  await expect(maintenance).not.toBeVisible();
  await expect(openMaintenance).toBeFocused();

  await page.locator('#lockButton').click();
  await expect(lockedView).toBeVisible();
  await expect(dashboard).toHaveClass(/hidden/);
  await expect(authState).toHaveText('LOCKED');
  await expect(token).toHaveValue('');
  await expect.poll(() => requests.some(entry => entry.path === '/admin-access' && entry.method === 'DELETE')).toBe(true);

  expect(browserDiagnostics).toEqual([]);
});
