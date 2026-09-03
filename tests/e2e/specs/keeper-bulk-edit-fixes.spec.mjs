import { test, expect } from '../support/fixtures.mjs';

const clone = value => JSON.parse(JSON.stringify(value));

const initialSeries = [
  {
    id: 'bulk-fix-a',
    title: 'Moonlit Archive',
    author: 'Keeper A',
    year: '2024',
    status: 'Ongoing',
    genres: ['Fantasy'],
    tags: ['Regression'],
    description: 'First deterministic-fix fixture.',
    translationStatus: '',
    translations: [],
    volumes: [{ title: 'Moonlit Archive 1', number: 1, size: 1024 }]
  },
  {
    id: 'bulk-fix-b',
    title: 'Thornbound Ledger',
    author: 'Keeper B',
    year: '2025',
    status: 'Hiatus',
    genres: ['Romance'],
    tags: ['Regression'],
    description: 'Second deterministic-fix fixture.',
    translationStatus: '',
    translations: [],
    volumes: [{ title: 'Thornbound Ledger 1', number: 1, size: 2048 }]
  }
];

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
    main: clone(initialSeries),
    adult: [],
    counts: { main: 2, adult: 0, series: 2, volumes: 2 }
  };
}

async function installKeeperRoutes(page, controls) {
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
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let body = null;
    if (request.postData()) {
      try { body = request.postDataJSON(); }
      catch { body = request.postData(); }
    }

    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, libraryPayload());
    if (path === '/admin-api/maintenance' && method === 'POST' && body?.action === 'create-backup') controls.writeRequests.push({ path, body });
    if (path === '/admin-api/library' && method === 'POST' && body?.action === 'update-series') controls.writeRequests.push({ path, body });
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
  await expect(page.locator('#manageSeriesCount')).toHaveText('2');
  await expect(page.locator('.manager-card')).toHaveCount(2);
}

test('Keeper one-click genre fix removes only ignored values, previews canonically, and undoes without writes', async ({ page, browserDiagnostics }) => {
  const controls = { writeRequests: [] };
  await installKeeperRoutes(page, controls);
  await unlockKeeper(page);

  const cards = page.locator('.manager-card');
  await cards.nth(0).locator('[data-bulk-series-select]').check();
  await cards.nth(1).locator('[data-bulk-series-select]').check();
  await page.locator('#openBulkSeriesEdit').click();

  const dialog = page.locator('#bulkSeriesEditor');
  await expect(dialog).toBeVisible();
  await page.locator('#bulkGenresMode').selectOption('add');

  const raw = 'Adventure, Definitely Not A Genre';
  const input = page.locator('#bulkGenresInput');
  await input.fill(raw);
  await expect(page.locator('#bulkSeriesValidation')).toContainText('Ignored non-canonical genres: Definitely Not A Genre.');

  const fix = page.getByRole('button', { name: 'Remove ignored genres' });
  await expect(fix).toBeVisible();
  expect(controls.writeRequests).toEqual([]);

  await fix.click();
  await expect(input).toHaveValue('Adventure');
  await expect(page.locator('#bulkSeriesValidation')).not.toContainText('Ignored non-canonical genres');
  await expect(page.locator('#bulkSeriesPreview')).toContainText('Fantasy, Adventure');
  await expect(page.locator('#bulkSeriesPreview')).toContainText('Romance, Adventure');
  await expect(page.getByRole('button', { name: 'Undo genre fix' })).toBeVisible();
  expect(controls.writeRequests).toEqual([]);

  await page.getByRole('button', { name: 'Undo genre fix' }).click();
  await expect(input).toHaveValue(raw);
  await expect(page.locator('#bulkSeriesValidation')).toContainText('Ignored non-canonical genres: Definitely Not A Genre.');
  await expect(page.getByRole('button', { name: 'Remove ignored genres' })).toBeVisible();
  expect(controls.writeRequests).toEqual([]);
  expect(browserDiagnostics).toEqual([]);
});
