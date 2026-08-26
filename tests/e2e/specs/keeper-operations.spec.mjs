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

function maintenanceSnapshot(state) {
  return {
    health: {
      status: 'healthy',
      counts: { series: 2, volumes: 4 },
      metrics: {
        referencedObjects: 2,
        missingCovers: 0,
        missingThumbs: 0,
        legacyIdentity: 0,
        trashItems: state.trash.length
      },
      issues: [],
      objectKeys: ['shadow-garden/books/e2e-one.epub', 'shadow-garden/covers/e2e-one.webp'],
      optimizationCandidates: []
    },
    taxonomy: {
      affectedSeries: 0,
      totalSeries: 2,
      canonicalGenreCount: 35,
      preview: []
    },
    backups: state.backups.map(item => ({ ...item })),
    trash: state.trash.map(item => ({ ...item }))
  };
}

function abuseSnapshot(state) {
  return {
    activeCooldowns: state.abuseReleased ? 0 : 1,
    policy: { windowSeconds: 900, cooldownSeconds: 3600 },
    events: [{
      kind: 'public_cooldown',
      clientId: 'client_e2e_1234567890',
      trigger: 'media_ticket_burst',
      score: 8,
      createdAt: '2026-08-26T06:00:00Z',
      cooldownUntil: Math.floor(Date.now() / 1000) + 3600,
      ...(state.abuseReleased ? { releasedAt: '2026-08-26T07:00:00Z' } : {})
    }]
  };
}

async function installKeeperOperationsRoutes(page, state) {
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
    state.requests.push({ path, method, headers: request.headers(), body });

    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, {
      main: [], adult: [], counts: { main: 0, adult: 0, series: 0, volumes: 0 }
    });
    if (path === '/admin-api/translations' && method === 'GET') return fulfillJson(route, { series: {} });

    if (path === '/admin-api/maintenance' && method === 'GET') {
      state.maintenanceGets += 1;
      return fulfillJson(route, maintenanceSnapshot(state));
    }

    if (path === '/admin-api/maintenance' && method === 'POST') {
      if (body?.action === 'check-objects') {
        state.deepCheckCount += 1;
        await state.gates.deep.promise;
        return fulfillJson(route, { checked: Array.isArray(body.keys) ? body.keys.length : 0, missing: [] });
      }
      if (body?.action === 'create-backup') {
        state.createBackupCount += 1;
        await state.gates.create.promise;
        if (!state.backups.some(item => item.id === 'backup-created')) state.backups.unshift({
          id: 'backup-created', reason: 'manual-backup', createdAt: '2026-08-26T06:30:00Z', counts: { mainSeries: 2, adultSeries: 0, volumes: 4 }
        });
        return fulfillJson(route, maintenanceSnapshot(state));
      }
      if (body?.action === 'restore-backup') {
        state.restoreBackupCount += 1;
        await state.gates.restoreBackup.promise;
        return fulfillJson(route, maintenanceSnapshot(state));
      }
      if (body?.action === 'restore-trash') {
        state.restoreTrashCount += 1;
        await state.gates.restoreTrash.promise;
        state.trash = state.trash.filter(item => item.id !== body.id);
        return fulfillJson(route, maintenanceSnapshot(state));
      }
      if (body?.action === 'purge-trash') {
        state.purgeTrashCount += 1;
        await state.gates.purgeTrash.promise;
        const ids = Array.isArray(body.ids) ? body.ids : [];
        state.trash = ids.length ? state.trash.filter(item => !ids.includes(item.id)) : [];
        return fulfillJson(route, maintenanceSnapshot(state));
      }
      return fulfillJson(route, maintenanceSnapshot(state));
    }

    if (path === '/admin-api/abuse' && method === 'GET') {
      state.abuseGets += 1;
      if (state.failNextAbuseLoad) {
        state.failNextAbuseLoad = false;
        return fulfillJson(route, { error: 'E2E gate ledger unavailable' }, 503);
      }
      return fulfillJson(route, abuseSnapshot(state));
    }
    if (path === '/admin-api/abuse' && method === 'POST' && body?.action === 'release') {
      state.releaseAbuseCount += 1;
      await state.gates.releaseAbuse.promise;
      state.abuseReleased = true;
      return fulfillJson(route, abuseSnapshot(state));
    }

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

function makeState({ failNextAbuseLoad = false } = {}) {
  return {
    requests: [],
    maintenanceGets: 0,
    abuseGets: 0,
    deepCheckCount: 0,
    createBackupCount: 0,
    restoreBackupCount: 0,
    restoreTrashCount: 0,
    purgeTrashCount: 0,
    releaseAbuseCount: 0,
    failNextAbuseLoad,
    abuseReleased: false,
    backups: [{
      id: 'backup-initial', reason: 'before-e2e', createdAt: '2026-08-26T05:00:00Z', counts: { mainSeries: 2, adultSeries: 0, volumes: 4 }
    }],
    trash: [
      { id: 'trash-a', type: 'series', scope: 'main', title: 'Restorable Moonflower', subtitle: '2 volumes', removedAt: '2026-08-26T05:10:00Z' },
      { id: 'trash-b', type: 'volume', scope: 'main', title: 'Purgeable Thorn', subtitle: 'Volume 2', removedAt: '2026-08-26T05:20:00Z' }
    ],
    gates: {
      deep: deferred(), create: deferred(), restoreBackup: deferred(), restoreTrash: deferred(), purgeTrash: deferred(), releaseAbuse: deferred()
    }
  };
}

test('Garden Keeper Maintenance, History, Trash, and Abuse Watch remain single-submit while busy', async ({ page, browserDiagnostics }) => {
  const state = makeState();
  await installKeeperOperationsRoutes(page, state);
  await unlockKeeper(page);
  await page.locator('#openMaintenance').click();

  const dialog = page.locator('#maintenanceDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#gardenHealthState')).toHaveText('HEALTHY');
  await expect(page.locator('#backupCount')).toHaveText('1');
  await expect(page.locator('#trashCount')).toHaveText('2');
  await expect(page.locator('#abuseWatchState')).toHaveText('1 ACTIVE');
  await expect(page.locator('#abuseWatchList')).toContainText('Public access cooldown');

  const deepCheck = page.locator('#deepHealthCheck');
  await deepCheck.evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => state.deepCheckCount).toBe(1);
  await expect(deepCheck).toBeDisabled();
  await expect(deepCheck).toHaveText('Checking B2…');
  state.gates.deep.resolve();
  await expect(page.locator('#deepHealthProgress')).toContainText('All 2 referenced B2 objects were found.');
  await expect(deepCheck).toBeEnabled();

  const createBackup = page.locator('#createCatalogBackup');
  await createBackup.evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => state.createBackupCount).toBe(1);
  await expect(createBackup).toBeDisabled();
  await expect(createBackup).toHaveText('Creating backup…');
  state.gates.create.resolve();
  await expect(page.locator('#backupCount')).toHaveText('2');
  await expect(createBackup).toBeEnabled();

  await page.evaluate(() => { window.confirm = () => true; });

  const restoreBackup = page.locator('[data-restore-backup="backup-created"]');
  await restoreBackup.evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => state.restoreBackupCount).toBe(1);
  await expect(restoreBackup).toBeDisabled();
  await expect(restoreBackup).toHaveText('Restoring…');
  state.gates.restoreBackup.resolve();
  await expect(page.locator('.admin-toast', { hasText: 'Catalog snapshot restored.' })).toBeVisible();
  await expect(page.locator('[data-restore-backup="backup-created"]')).toBeEnabled();

  const restoreTrash = page.locator('[data-restore-trash="trash-a"]');
  await restoreTrash.evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => state.restoreTrashCount).toBe(1);
  await expect(restoreTrash).toBeDisabled();
  await expect(restoreTrash).toHaveText('Restoring…');
  state.gates.restoreTrash.resolve();
  await expect(page.locator('#trashCount')).toHaveText('1');
  await expect(page.locator('.admin-toast', { hasText: 'Restored “Restorable Moonflower”.' })).toBeVisible();

  const purgeTrash = page.locator('[data-purge-trash="trash-b"]');
  await purgeTrash.evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => state.purgeTrashCount).toBe(1);
  await expect(page.locator('[data-purge-trash="trash-b"]')).toBeDisabled();
  await expect(page.locator('[data-purge-trash="trash-b"]')).toHaveText('Purging…');
  state.gates.purgeTrash.resolve();
  await expect(page.locator('#trashCount')).toHaveText('0');
  await expect(page.locator('#trashList')).toContainText('Nothing is resting in Trash.');
  await expect(page.locator('#purgeAllTrash')).toBeDisabled();

  const release = page.locator('[data-release-abuse="client_e2e_1234567890"]');
  await release.evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => state.releaseAbuseCount).toBe(1);
  await expect(page.locator('[data-release-abuse="client_e2e_1234567890"]')).toBeDisabled();
  await expect(page.locator('[data-release-abuse="client_e2e_1234567890"]')).toHaveText('Releasing…');
  state.gates.releaseAbuse.resolve();
  await expect(page.locator('#abuseWatchState')).toHaveText('MONITORING');
  await expect(page.locator('#abuseWatchList')).toContainText('released');
  await expect(page.locator('.admin-toast', { hasText: 'Public cooldown released.' })).toBeVisible();

  expect(state.deepCheckCount).toBe(1);
  expect(state.createBackupCount).toBe(1);
  expect(state.restoreBackupCount).toBe(1);
  expect(state.restoreTrashCount).toBe(1);
  expect(state.purgeTrashCount).toBe(1);
  expect(state.releaseAbuseCount).toBe(1);
  const protectedRequests = state.requests.filter(entry => entry.path.startsWith('/admin-api/'));
  expect(protectedRequests.length).toBeGreaterThan(0);
  expect(protectedRequests.every(entry => entry.headers.authorization === 'Bearer e2e-keeper-token')).toBe(true);
  expect(browserDiagnostics).toEqual([]);
});

test('Abuse Watch exposes a failed load and recovers cleanly on refresh', async ({ page, browserDiagnostics }) => {
  const state = makeState({ failNextAbuseLoad: true });
  for (const gate of Object.values(state.gates)) gate.resolve();
  await installKeeperOperationsRoutes(page, state);
  await unlockKeeper(page);
  await page.locator('#openMaintenance').click();

  await expect(page.locator('#maintenanceDialog')).toBeVisible();
  await expect(page.locator('#abuseWatchState')).toHaveText('FAILED');
  await expect(page.locator('#abuseWatchList')).toContainText('E2E gate ledger unavailable');
  await expect(page.locator('#refreshAbuseWatch')).toBeEnabled();

  await page.locator('#refreshAbuseWatch').click();
  await expect(page.locator('#abuseWatchState')).toHaveText('1 ACTIVE');
  await expect(page.locator('#abuseWatchList')).toContainText('Public access cooldown');
  expect(state.abuseGets).toBeGreaterThanOrEqual(2);

  const diagnosticPath = entry => {
    try { return new URL(entry.sourceUrl).pathname; }
    catch { return String(entry.sourceUrl || '').split('?')[0]; }
  };
  const expectedAppErrors = browserDiagnostics.filter(entry =>
    entry.type === 'console' &&
    diagnosticPath(entry).endsWith('/assets/js/admin/abuse-workflow.js') &&
    /^Abuse Watch load failed Error(?:$|:|\n)/.test(entry.message)
  );
  expect(expectedAppErrors).toHaveLength(1);
  const expectedHttpErrors = browserDiagnostics.filter(entry =>
    entry.type === 'console' &&
    !expectedAppErrors.includes(entry) &&
    diagnosticPath(entry) === '/admin-api/abuse' &&
    entry.message.includes('503')
  );
  expect(expectedHttpErrors.length).toBeLessThanOrEqual(1);
  const expected = new Set([...expectedAppErrors, ...expectedHttpErrors]);
  expect(browserDiagnostics.filter(entry => !expected.has(entry))).toEqual([]);
});
