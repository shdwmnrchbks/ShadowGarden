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

function maintenanceSnapshot() {
  return {
    health: {
      status: 'healthy',
      counts: { series: 1, volumes: 1 },
      metrics: { referencedObjects: 1, missingCovers: 0, missingThumbs: 0, legacyIdentity: 0, trashItems: 0 },
      issues: [], objectKeys: ['shadow-garden/books/recovery-ready.epub'], optimizationCandidates: []
    },
    taxonomy: { affectedSeries: 0, totalSeries: 1, canonicalGenreCount: 35, preview: [] },
    backups: [], trash: []
  };
}

function readinessReport(mode) {
  const anchor = {
    id: 'backup-ready', createdAt: '2026-09-03T12:00:00Z', reason: 'before-recovery-test',
    status: 'verified', verified: true, objectCount: 3
  };
  if (mode === 'recovery-required') return {
    ok: true,
    policy: { maxSnapshots: 30, checksum: 'sha256' },
    summary: { total: 2, recoverable: 1, verified: 1, legacyUnverified: 0, damaged: 1, missing: 0, unreadable: 1, incomplete: 0, checksumMismatch: 0, checkFailed: 0 },
    live: {
      status: 'recovery-required', readable: false,
      entries: [
        { scope: 'main', status: 'invalid-json', readable: false, detail: 'Live catalog object is not valid JSON.' },
        { scope: 'adult', status: 'readable', readable: true, detail: 'Live catalog JSON and series structure are readable.', series: 0 }
      ]
    },
    readiness: {
      status: 'recovery-required', ready: false,
      detail: 'At least one live catalog requires recovery before destructive maintenance can be considered safe.',
      anchor, checkedSnapshots: 1, staleSnapshots: 0, uncertainSnapshots: 0
    },
    items: []
  };
  return {
    ok: true,
    policy: { maxSnapshots: 30, checksum: 'sha256' },
    summary: { total: 2, recoverable: 2, verified: 2, legacyUnverified: 0, damaged: 0, missing: 0, unreadable: 0, incomplete: 0, checksumMismatch: 0, checkFailed: 0 },
    live: {
      status: 'readable', readable: true,
      entries: [
        { scope: 'main', status: 'readable', readable: true, detail: 'Live catalog JSON and series structure are readable.', series: 1 },
        { scope: 'adult', status: 'readable', readable: true, detail: 'Live catalog JSON and series structure are readable.', series: 0 }
      ]
    },
    readiness: {
      status: 'ready', ready: true,
      detail: 'Live catalogs are readable and a checksum-verified, object-complete recovery anchor is available.',
      anchor, checkedSnapshots: 1, staleSnapshots: 0, uncertainSnapshots: 0
    },
    items: []
  };
}

async function installRoutes(page, state) {
  await page.route('**/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: `window.turnstile={render(host,options){const b=document.createElement('button');b.type='button';b.dataset.e2eTurnstile='1';b.textContent='Complete Keeper verification';b.addEventListener('click',()=>options.callback('e2e-turnstile-token'));host.replaceChildren(b);return 'e2e-widget'},reset(){}};`
  }));

  await page.route('**/admin-access', async route => {
    const method = route.request().method();
    if (method === 'GET') return fulfillJson(route, { siteKey: 'e2e-site-key', action: 'admin_access' });
    if (method === 'POST' || method === 'DELETE') return fulfillJson(route, { ok: true });
    return route.fulfill({ status: 405, body: '' });
  });

  await page.route('**/admin-api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
    state.requests.push({ path, method });
    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, { main: [], adult: [], counts: { main: 0, adult: 0, series: 0, volumes: 0 } });
    if (path === '/admin-api/translations' && method === 'GET') return fulfillJson(route, { series: {} });
    if (path === '/admin-api/maintenance' && method === 'GET') return fulfillJson(route, maintenanceSnapshot());
    if (path === '/admin-api/abuse' && method === 'GET') return fulfillJson(route, { activeCooldowns: 0, policy: {}, events: [] });
    if (path === '/admin-api/recovery-readiness' && method === 'GET') {
      state.readinessGets += 1;
      const gate = state.gate;
      await gate.promise;
      return fulfillJson(route, readinessReport(state.mode));
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

test('Recovery Readiness stays on-demand, single-submit, invalidation-safe, and never reports READY for damaged live catalogs', async ({ page, browserDiagnostics }) => {
  const state = { requests: [], readinessGets: 0, mode: 'ready', gate: deferred() };
  await installRoutes(page, state);
  await unlockKeeper(page);
  await page.locator('#openMaintenance').click();

  const dialog = page.locator('#maintenanceDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#recoveryReadinessCard')).toBeVisible();
  await expect(page.locator('#recoveryReadinessState')).toHaveText('NOT CHECKED');
  await expect(page.locator('#recoveryReadinessDetail')).toContainText('not been checked');
  expect(state.readinessGets).toBe(0);

  const check = page.locator('#checkRecoveryReadiness');
  await check.evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => state.readinessGets).toBe(1);
  await expect(check).toBeDisabled();
  await expect(page.locator('#recoveryReadinessState')).toHaveText('CHECKING');
  state.gate.resolve();

  await expect(page.locator('#recoveryReadinessState')).toHaveText('READY');
  await expect(page.locator('#recoveryReadinessDetail')).toContainText('checksum-verified, object-complete recovery anchor');
  await expect(page.locator('#recoveryReadinessMetrics')).toContainText('3');
  await expect(page.locator('#recoveryReadinessList')).toContainText('Object-complete recovery anchor');
  await expect(page.locator('#recoveryReadinessList')).toContainText('SHA-256 verified');
  await expect(page.locator('#recoveryReadinessList')).toContainText('Main catalog');
  await expect(page.locator('#recoveryReadinessList')).toContainText('Adult catalog');
  await expect(check).toHaveText('Check again');

  await page.evaluate(() => window.ShadowGardenKeeper.events.dispatchEvent(new Event('history:changed')));
  await expect(page.locator('#recoveryReadinessState')).toHaveText('NOT CHECKED');
  expect(state.readinessGets).toBe(1);

  state.mode = 'recovery-required';
  state.gate = deferred();
  await check.click();
  await expect.poll(() => state.readinessGets).toBe(2);
  await expect(page.locator('#recoveryReadinessState')).toHaveText('CHECKING');
  await page.evaluate(() => window.ShadowGardenKeeper.events.dispatchEvent(new Event('history:changed')));
  await expect(page.locator('#recoveryReadinessState')).toHaveText('NOT CHECKED');
  state.gate.resolve();
  await expect(page.locator('#recoveryReadinessState')).toHaveText('NOT CHECKED');

  state.gate = deferred();
  await check.click();
  await expect.poll(() => state.readinessGets).toBe(3);
  state.gate.resolve();
  await expect(page.locator('#recoveryReadinessState')).toHaveText('RECOVER NOW');
  await expect(page.locator('#recoveryReadinessDetail')).toContainText('requires recovery');
  await expect(page.locator('#recoveryReadinessList')).toContainText('invalid json');
  await expect(page.locator('#recoveryReadinessList')).toContainText('CHECK');

  const recoveryRequests = state.requests.filter(item => item.path === '/admin-api/recovery-readiness');
  expect(recoveryRequests).toHaveLength(3);
  expect(recoveryRequests.every(item => item.method === 'GET')).toBe(true);
  expect(browserDiagnostics).toEqual([]);
});
