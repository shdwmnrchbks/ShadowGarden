import { test, expect } from '../support/fixtures.mjs';

const clone = value => JSON.parse(JSON.stringify(value));

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const initialSeries = [
  {
    id: 'bulk-series-a',
    title: 'Moonlit Archive',
    author: 'Keeper A',
    year: '2024',
    status: 'Ongoing',
    genres: ['Fantasy'],
    tags: ['Regression'],
    description: 'First bulk-edit fixture.',
    audioAlignedUrl: 'https://audio.example/moonlit/',
    translationStatus: 'Ongoing',
    translations: [{ name: 'First TL', url: 'https://translator.example/first', coverage: 'Volumes 1-2' }],
    volumes: [{ title: 'Moonlit Archive 1', number: 1, size: 1024 }]
  },
  {
    id: 'bulk-series-b',
    title: 'Thornbound Ledger',
    author: 'Keeper B',
    year: '2025',
    status: 'Hiatus',
    genres: ['Romance'],
    tags: ['Second Fixture'],
    description: 'Second bulk-edit fixture.',
    audioAlignedUrl: '',
    translationStatus: '',
    translations: [],
    volumes: [{ title: 'Thornbound Ledger 1', number: 1, size: 2048 }]
  }
];

function libraryPayload(series) {
  return {
    main: clone(series),
    adult: [],
    counts: { main: series.length, adult: 0, series: series.length, volumes: series.reduce((count, item) => count + (item.volumes?.length || 0), 0) }
  };
}

async function fulfillJson(route, value, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(value)
  });
}

async function installKeeperRoutes(page, controls) {
  let series = clone(initialSeries);

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
    controls.requests.push({ path, method, body });

    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, libraryPayload(series));

    if (path === '/admin-api/maintenance' && method === 'POST' && body?.action === 'create-backup') {
      controls.backupCount += 1;
      controls.backupBody = body;
      await controls.backupGate.promise;
      return fulfillJson(route, { backups: [{ id: 'bulk-backup', reason: body.reason }] });
    }

    if (path === '/admin-api/library' && method === 'POST' && body?.action === 'update-series') {
      controls.updateBodies.push(clone(body));
      series = series.map(item => item.id === body.id ? {
        ...item,
        title: body.title,
        author: body.author,
        year: body.year,
        status: body.status,
        genres: clone(body.genres || []),
        tags: clone(body.tags || []),
        description: body.description,
        audioAlignedUrl: body.audioAlignedUrl,
        translationStatus: body.translationStatus,
        translations: clone(body.translations || [])
      } : item);
      return fulfillJson(route, libraryPayload(series));
    }

    return fulfillJson(route, { ok: true });
  });

  return () => clone(series);
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

test('Garden Keeper bulk series metadata previews diffs, backs up first, and keeps canonical saves single-submit', async ({ page, browserDiagnostics }) => {
  const controls = {
    requests: [],
    backupCount: 0,
    backupBody: null,
    updateBodies: [],
    backupGate: deferred()
  };
  const currentSeries = await installKeeperRoutes(page, controls);
  await unlockKeeper(page);

  const cards = page.locator('.manager-card');
  await cards.nth(0).locator('[data-bulk-series-select]').check();
  await cards.nth(1).locator('[data-bulk-series-select]').check();

  const openBulk = page.locator('#openBulkSeriesEdit');
  await expect(openBulk).toBeEnabled();
  await expect(openBulk).toHaveText('Batch edit (2)');
  await openBulk.click();

  const dialog = page.locator('#bulkSeriesEditor');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#bulkSeriesCount')).toHaveText('2 series selected');
  await expect(page.locator('#saveBulkSeriesEdit')).toBeDisabled();

  await page.locator('#bulkGenresMode').selectOption('add');
  await page.locator('#bulkGenresInput').fill('Adventure');
  await page.locator('#bulkTagsMode').selectOption('add');
  await page.locator('#bulkTagsInput').fill('Slow Burn');
  await page.locator('#bulkSeriesStatus').selectOption('Complete');
  await page.locator('#bulkTranslationStatus').selectOption('Partial');
  await page.locator('#bulkCreditMode').selectOption('append');
  await page.locator('#bulkTranslatorName').fill('Moon TL');
  await page.locator('#bulkTranslatorUrl').fill('https://translator.example/moon');
  await page.locator('#bulkTranslatorCoverage').fill('Volumes 3-4');

  await expect(page.locator('#bulkChangedCount')).toHaveText('2 series changing');
  await expect(page.locator('#bulkSeriesPreview')).toContainText('Moonlit Archive');
  await expect(page.locator('#bulkSeriesPreview')).toContainText('Thornbound Ledger');
  await expect(page.locator('#bulkSeriesPreview')).toContainText('Fantasy, Adventure');
  await expect(page.locator('#bulkSeriesPreview')).toContainText('Romance, Adventure');
  await expect(page.locator('#bulkSeriesPreview')).toContainText('Moon TL (Volumes 3-4)');

  const save = page.locator('#saveBulkSeriesEdit');
  await expect(save).toBeEnabled();
  await save.evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => controls.backupCount).toBe(1);
  await expect(save).toBeDisabled();
  expect(controls.updateBodies).toHaveLength(0);
  expect(controls.backupBody).toEqual({ action: 'create-backup', reason: 'before-bulk-series-metadata' });

  controls.backupGate.resolve();
  await expect.poll(() => controls.updateBodies.length).toBe(2);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.admin-toast', { hasText: 'Updated metadata for 2 series.' })).toBeVisible();

  const backupIndex = controls.requests.findIndex(entry => entry.path === '/admin-api/maintenance' && entry.body?.action === 'create-backup');
  const firstUpdateIndex = controls.requests.findIndex(entry => entry.path === '/admin-api/library' && entry.body?.action === 'update-series');
  expect(backupIndex).toBeGreaterThanOrEqual(0);
  expect(firstUpdateIndex).toBeGreaterThan(backupIndex);

  expect(controls.updateBodies[0]).toMatchObject({
    action: 'update-series',
    id: 'bulk-series-a',
    title: 'Moonlit Archive',
    author: 'Keeper A',
    status: 'Complete',
    genres: ['Fantasy', 'Adventure'],
    tags: ['Regression', 'Slow Burn'],
    description: 'First bulk-edit fixture.',
    audioAlignedUrl: 'https://audio.example/moonlit/',
    adult: false,
    translationStatus: 'Partial',
    translations: [
      { name: 'First TL', url: 'https://translator.example/first', coverage: 'Volumes 1-2' },
      { name: 'Moon TL', url: 'https://translator.example/moon', coverage: 'Volumes 3-4' }
    ]
  });
  expect(controls.updateBodies[1]).toMatchObject({
    action: 'update-series',
    id: 'bulk-series-b',
    title: 'Thornbound Ledger',
    author: 'Keeper B',
    status: 'Complete',
    genres: ['Romance', 'Adventure'],
    tags: ['Second Fixture', 'Slow Burn'],
    description: 'Second bulk-edit fixture.',
    adult: false,
    translationStatus: 'Partial',
    translations: [{ name: 'Moon TL', url: 'https://translator.example/moon', coverage: 'Volumes 3-4' }]
  });

  const saved = currentSeries();
  expect(saved.map(item => item.status)).toEqual(['Complete', 'Complete']);
  expect(saved.map(item => item.translationStatus)).toEqual(['Partial', 'Partial']);
  expect(browserDiagnostics).toEqual([]);
});
