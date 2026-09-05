import { test, expect } from '../support/fixtures.mjs';

async function fulfillJson(route, value, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(value)
  });
}

function maintenanceSnapshot({ trash } = {}) {
  const trashItems = trash || [
    { id: 'keeper-audit-trash-series', type: 'series', scope: 'main', title: 'Audit Series', subtitle: '12 volumes', removedAt: '2026-09-04T00:10:00Z' },
    { id: 'keeper-audit-trash-volume', type: 'volume', scope: 'main', title: 'Audit Volume', subtitle: 'Volume 4', removedAt: '2026-09-04T00:20:00Z' }
  ];
  return {
    health: {
      status: 'healthy',
      counts: { series: 300, volumes: 1950 },
      metrics: {
        referencedObjects: 3900,
        missingCovers: 0,
        missingThumbs: 0,
        legacyIdentity: 0,
        trashItems: trashItems.length
      },
      issues: [],
      objectKeys: [],
      optimizationCandidates: []
    },
    taxonomy: {
      affectedSeries: 0,
      totalSeries: 300,
      canonicalGenreCount: 35,
      preview: []
    },
    backups: [{
      id: 'keeper-audit-backup',
      reason: 'keeper-audit',
      createdAt: '2026-09-04T00:00:00Z',
      counts: { mainSeries: 300, adultSeries: 0, volumes: 1950 }
    }],
    trash: trashItems
  };
}

function abuseSnapshot() {
  return {
    activeCooldowns: 0,
    policy: { windowSeconds: 900, cooldownSeconds: 3600 },
    events: []
  };
}

async function installKeeperAuditRoutes(page, requests) {
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
          button.addEventListener('click', () => options.callback('keeper-audit-turnstile-token'));
          host.replaceChildren(button);
          return 'keeper-audit-widget';
        },
        reset() {}
      };
    `
  }));

  await page.route('**/admin-access', async route => {
    const method = route.request().method();
    if (method === 'GET') return fulfillJson(route, { siteKey: 'keeper-audit-site-key', action: 'admin_access' });
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
      main: [], adult: [], counts: { main: 0, adult: 0, series: 0, volumes: 0 }
    });
    if (path === '/admin-api/translations' && method === 'GET') return fulfillJson(route, { series: {} });
    if (path === '/admin-api/maintenance' && method === 'GET') return fulfillJson(route, maintenanceSnapshot());
    if (path === '/admin-api/maintenance' && method === 'POST') {
      let body = {};
      try { body = request.postDataJSON() || {}; } catch {}
      if (body.action === 'restore-trash') {
        return fulfillJson(route, maintenanceSnapshot({
          trash: [{ id: 'keeper-audit-trash-volume', type: 'volume', scope: 'main', title: 'Audit Volume', subtitle: 'Volume 4', removedAt: '2026-09-04T00:20:00Z' }]
        }));
      }
      return fulfillJson(route, maintenanceSnapshot());
    }
    if (path === '/admin-api/abuse' && method === 'GET') return fulfillJson(route, abuseSnapshot());
    return fulfillJson(route, { ok: true });
  });
}

async function unlockKeeper(page) {
  await page.goto('/admin.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 12_000 }).toBe(true);
  await page.locator('#adminToken').fill('keeper-audit-token');
  await page.locator('#unlockButton').click();
  await page.locator('[data-e2e-turnstile]').click();
  await expect(page.locator('#authState')).toHaveText('UNLOCKED');
  await expect(page.locator('#dashboardView')).toBeVisible();
}

async function cdpSnapshot(page, session) {
  try { await session.send('HeapProfiler.collectGarbage'); } catch {}
  const response = await session.send('Performance.getMetrics');
  const metrics = Object.fromEntries(response.metrics.map(metric => [metric.name, metric.value]));
  return {
    Documents: metrics.Documents,
    JSEventListeners: metrics.JSEventListeners,
    Nodes: metrics.Nodes,
    LayoutCount: metrics.LayoutCount,
    RecalcStyleCount: metrics.RecalcStyleCount,
    ScriptDuration: metrics.ScriptDuration,
    TaskDuration: metrics.TaskDuration,
    JSHeapUsedSize: metrics.JSHeapUsedSize,
    JSHeapTotalSize: metrics.JSHeapTotalSize,
    elements: await page.locator('*').count()
  };
}

async function timed(action, settled) {
  const started = performance.now();
  await action();
  await settled();
  return Math.round((performance.now() - started) * 10) / 10;
}

function requestCounts(requests) {
  return requests.reduce((counts, request) => {
    const key = `${request.method} ${request.path}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

test('v2.11D audit: Keeper maintenance dialog has one canonical snapshot request owner', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Chromium desktop runtime audit');

  const requests = [];
  await installKeeperAuditRoutes(page, requests);
  await unlockKeeper(page);

  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  requests.length = 0;
  const beforeOpen = await cdpSnapshot(page, session);

  const firstOpenMs = await timed(
    () => page.locator('#openMaintenance').click(),
    async () => {
      await expect(page.locator('#maintenanceDialog')).toBeVisible();
      await expect(page.locator('#gardenHealthState')).toHaveText('HEALTHY');
      await expect(page.locator('#backupCount')).toHaveText('1');
      await expect(page.locator('#trashCount')).toHaveText('2');
      await expect(page.locator('#abuseWatchState')).toHaveText('QUIET');
    }
  );
  const firstOpen = await cdpSnapshot(page, session);
  const firstOpenRequests = requestCounts(requests);

  await page.locator('#closeMaintenance').click();
  await expect(page.locator('#maintenanceDialog')).toBeHidden();
  const beforeReopenRequestCount = requests.length;

  const reopenMs = await timed(
    () => page.locator('#openMaintenance').click(),
    async () => {
      await expect(page.locator('#maintenanceDialog')).toBeVisible();
      await expect(page.locator('#gardenHealthState')).toHaveText('HEALTHY');
      await expect(page.locator('#backupCount')).toHaveText('1');
      await expect(page.locator('#trashCount')).toHaveText('2');
      await expect(page.locator('#abuseWatchState')).toHaveText('QUIET');
    }
  );
  const afterReopen = await cdpSnapshot(page, session);
  const reopenRequests = requestCounts(requests.slice(beforeReopenRequestCount));

  console.log('KEEPER_V2_11D_RUNTIME_AUDIT', JSON.stringify({
    timingsMs: { firstOpenMs, reopenMs },
    requests: { firstOpen: firstOpenRequests, reopen: reopenRequests },
    beforeOpen,
    firstOpen,
    afterReopen
  }));

  expect(firstOpenRequests['GET /admin-api/maintenance']).toBe(1);
  expect(reopenRequests['GET /admin-api/maintenance']).toBe(1);
  expect(firstOpenRequests['GET /admin-api/abuse']).toBe(1);
  expect(reopenRequests['GET /admin-api/abuse']).toBe(1);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('v2.11D audit: Trash reuses its own mutation snapshot but externally invalidated Trash reloads once', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Chromium desktop runtime audit');

  const requests = [];
  await installKeeperAuditRoutes(page, requests);
  await unlockKeeper(page);
  await page.locator('#openMaintenance').click();
  await expect(page.locator('#trashCount')).toHaveText('2');
  await page.evaluate(() => { window.confirm = () => true; });

  requests.length = 0;
  await page.locator('[data-restore-trash="keeper-audit-trash-series"]').click();
  await expect(page.locator('#trashCount')).toHaveText('1');
  await expect(page.locator('.admin-toast', { hasText: 'Restored “Audit Series”.' })).toBeVisible();
  const ownMutationRequests = requestCounts(requests);
  expect(ownMutationRequests['POST /admin-api/maintenance']).toBe(1);
  expect(ownMutationRequests['GET /admin-api/maintenance'] || 0).toBe(0);

  requests.length = 0;
  await page.evaluate(() => window.ShadowGardenKeeper.events.dispatchEvent(new Event('trash:changed')));
  await expect.poll(() => requests.filter(request => request.path === '/admin-api/maintenance' && request.method === 'GET').length).toBe(1);
  const externalInvalidationRequests = requestCounts(requests);
  expect(externalInvalidationRequests['GET /admin-api/maintenance']).toBe(1);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
