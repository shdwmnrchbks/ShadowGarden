import { test, expect } from '../support/fixtures.mjs';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function fulfillJson(route, value, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(value)
  });
}

function maintenanceSnapshot({ normalized = false } = {}) {
  return {
    health: {
      status: 'healthy',
      counts: { series: 1, volumes: 1 },
      metrics: {
        referencedObjects: 1,
        missingCovers: 0,
        missingThumbs: 0,
        legacyIdentity: 0,
        trashItems: 0
      },
      issues: [],
      objectKeys: ['shadow-garden/books/queued-operation.epub'],
      optimizationCandidates: []
    },
    taxonomy: {
      affectedSeries: normalized ? 0 : 1,
      totalSeries: 1,
      canonicalGenreCount: 35,
      preview: normalized ? [] : [{
        title: 'Queued Operation Fixture',
        beforeGenres: ['Fantasy', 'School Life'],
        beforeTags: [],
        genres: ['Fantasy'],
        tags: ['School Life']
      }]
    },
    backups: [],
    trash: []
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
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let body = null;
    if (request.postData()) {
      try { body = request.postDataJSON(); }
      catch { body = request.postData(); }
    }

    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, {
      main: [], adult: [], counts: { main: 0, adult: 0, series: 0, volumes: 0 }
    });
    if (path === '/admin-api/translations' && method === 'GET') return fulfillJson(route, { series: {} });
    if (path === '/admin-api/maintenance' && method === 'GET') return fulfillJson(route, maintenanceSnapshot({ normalized: state.normalized }));

    if (path === '/admin-api/maintenance' && method === 'POST' && body?.action === 'check-objects') {
      state.deepStarts += 1;
      state.concurrent += 1;
      state.maxConcurrent = Math.max(state.maxConcurrent, state.concurrent);
      state.order.push('deep-start');
      await state.deepGate.promise;
      state.order.push('deep-end');
      state.concurrent -= 1;
      return fulfillJson(route, { checked: Array.isArray(body.keys) ? body.keys.length : 0, missing: [] });
    }

    if (path === '/admin-api/maintenance' && method === 'POST' && body?.action === 'normalize-taxonomy') {
      state.taxonomyStarts += 1;
      state.concurrent += 1;
      state.maxConcurrent = Math.max(state.maxConcurrent, state.concurrent);
      state.order.push('taxonomy-start');
      await state.taxonomyGate.promise;
      state.normalized = true;
      state.order.push('taxonomy-end');
      state.concurrent -= 1;
      return fulfillJson(route, { ...maintenanceSnapshot({ normalized: true }), normalizedTaxonomy: 1 });
    }

    if (path === '/admin-api/maintenance' && method === 'POST') return fulfillJson(route, maintenanceSnapshot({ normalized: state.normalized }));
    if (path === '/admin-api/abuse' && method === 'GET') return fulfillJson(route, { activeCooldowns: 0, policy: {}, events: [] });
    if (path === '/admin-api/backup' && method === 'POST') return fulfillJson(route, { ok: true });
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

test('long Keeper maintenance work is explicit, removable while queued, and serialized in one tab', async ({ page, browserDiagnostics }) => {
  const state = {
    normalized: false,
    deepStarts: 0,
    taxonomyStarts: 0,
    concurrent: 0,
    maxConcurrent: 0,
    order: [],
    deepGate: deferred(),
    taxonomyGate: deferred()
  };
  await installRoutes(page, state);
  await unlockKeeper(page);
  await page.locator('#openMaintenance').click();

  await expect(page.locator('#maintenanceDialog')).toBeVisible();
  await expect(page.locator('#maintenanceOperationCard')).toBeVisible();
  await expect(page.locator('#maintenanceOperationState')).toHaveText('IDLE');
  await expect(page.locator('#maintenanceOperationCard')).toContainText('Reloading this page does not create background jobs.');
  await expect(page.locator('#normalizeCatalogTaxonomy')).toHaveText('Normalize 1 series');

  await page.evaluate(() => { window.confirm = () => true; });

  await page.locator('#deepHealthCheck').click();
  await expect.poll(() => state.deepStarts).toBe(1);
  await expect(page.locator('#deepHealthCheck')).toHaveText('Checking B2…');
  await expect(page.locator('#maintenanceOperationState')).toHaveText('RUNNING');

  await page.locator('#normalizeCatalogTaxonomy').click();
  await expect(page.locator('#normalizeCatalogTaxonomy')).toHaveText('Taxonomy normalization queued');
  await expect(page.locator('#normalizeCatalogTaxonomy')).toBeDisabled();
  await expect.poll(() => state.taxonomyStarts).toBe(0);

  const queuedTaxonomy = page.locator('.maintenance-operation-item', { hasText: 'Normalize taxonomy for 1 series' });
  await expect(queuedTaxonomy).toContainText('QUEUED');
  await expect(queuedTaxonomy).toContainText('Waiting for the current maintenance operation.');
  await queuedTaxonomy.locator('[data-remove-maintenance-operation]').click();
  await expect(page.locator('#normalizeCatalogTaxonomy')).toBeEnabled();
  await expect(page.locator('#normalizeCatalogTaxonomy')).toHaveText('Normalize 1 series');
  await expect.poll(() => state.taxonomyStarts).toBe(0);

  await page.locator('#normalizeCatalogTaxonomy').click();
  await expect(page.locator('#normalizeCatalogTaxonomy')).toHaveText('Taxonomy normalization queued');
  await expect(page.locator('.maintenance-operation-item', { hasText: 'Normalize taxonomy for 1 series' })).toContainText('QUEUED');

  state.deepGate.resolve();
  await expect(page.locator('#deepHealthProgress')).toContainText('All 1 referenced B2 objects were found.');
  await expect.poll(() => state.taxonomyStarts).toBe(1);
  expect(state.order.slice(0, 3)).toEqual(['deep-start', 'deep-end', 'taxonomy-start']);
  expect(state.maxConcurrent).toBe(1);
  await expect(page.locator('.maintenance-operation-item', { hasText: 'Normalize taxonomy for 1 series' })).toContainText('RUNNING');

  state.taxonomyGate.resolve();
  await expect(page.locator('.admin-toast', { hasText: 'Normalized taxonomy for 1 series.' })).toBeVisible();
  await expect(page.locator('#maintenanceOperationState')).toHaveText('IDLE');
  await expect(page.locator('#normalizeCatalogTaxonomy')).toHaveText('Taxonomy is current');
  await expect(page.locator('#maintenanceOperationList [data-operation-status="done"]')).toHaveCount(2);

  expect(state.deepStarts).toBe(1);
  expect(state.taxonomyStarts).toBe(1);
  expect(state.order).toEqual(['deep-start', 'deep-end', 'taxonomy-start', 'taxonomy-end']);
  expect(state.maxConcurrent).toBe(1);
  expect(browserDiagnostics).toEqual([]);
});
