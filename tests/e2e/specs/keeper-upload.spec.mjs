import { fileURLToPath } from 'node:url';
import { test, expect } from '../support/fixtures.mjs';

const epubPath = fileURLToPath(new URL('../.generated/reader-fixture.epub', import.meta.url));

async function fulfillJson(route, value, status = 200, headers = {}) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store', ...headers },
    body: JSON.stringify(value)
  });
}

async function installKeeperUploadRoutes(page, state) {
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
    const request = route.request();
    const method = request.method();
    if (method === 'GET') return fulfillJson(route, { siteKey: 'e2e-site-key', action: 'admin_access' });
    if (method === 'POST') return fulfillJson(route, { ok: true });
    if (method === 'DELETE') return fulfillJson(route, { ok: true });
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
    state.requests.push({ path, method, url: request.url(), headers: request.headers(), body });

    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, {
      main: [],
      adult: [],
      counts: { main: 0, adult: 0, series: 0, volumes: 0 }
    });

    if (path === '/admin-api/upload' && method === 'POST') {
      state.uploadCount += 1;
      state.uploadKey = url.searchParams.get('key') || '';
      state.uploadHeaders = request.headers();
      if (state.failUpload) return fulfillJson(route, { error: 'E2E storage unavailable' }, 503);
      await state.waitForUpload;
      return fulfillJson(route, { ok: true, key: state.uploadKey });
    }

    if (path === '/admin-api/catalog' && method === 'POST') {
      state.catalogCount += 1;
      state.catalogBody = body;
      state.catalogHeaders = request.headers();
      return fulfillJson(route, {
        ok: true,
        seriesId: 'moonlit-reader-fixture',
        seriesTitle: 'Moonlit Reader Fixture'
      });
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
  await expect(page.locator('#dashboardView')).toBeVisible();
}

async function chooseFixture(page) {
  await page.locator('#openNewBooks').click();
  const dialog = page.locator('#addBooksDialog');
  await expect(dialog).toBeVisible();
  await page.locator('#epubFile').setInputFiles(epubPath);

  await expect(page.locator('#fileState')).toHaveText('READY', { timeout: 15_000 });
  await expect(page.locator('#preflightCard')).toBeVisible();
  await expect(page.locator('#preflightState')).toHaveText('WARNING');
  await expect(page.locator('#preflightTitle')).toHaveText('Readable with warnings');
  await expect(page.locator('#metadataCard')).toBeVisible();
  await expect(page.locator('#titleInput')).toHaveValue('Moonlit Reader Fixture');
  await expect(page.locator('#seriesInput')).toHaveValue('Moonlit Reader Fixture');
  await expect(page.locator('#volumeInput')).toHaveValue('1');
  await expect(page.locator('#batchList .batch-item')).toHaveCount(1);
  await expect(page.locator('#uploadReviewSummary')).toBeVisible();
  await expect(page.locator('#uploadReviewSummary')).toContainText('1 ready');
  await expect(page.locator('#uploadButton')).toBeEnabled();
  return dialog;
}

test('Garden Keeper performs real EPUB preflight → reviewed upload → completion once while busy', async ({ page, browserDiagnostics }) => {
  let releaseUpload;
  const state = {
    requests: [],
    uploadCount: 0,
    catalogCount: 0,
    uploadKey: '',
    uploadHeaders: null,
    catalogBody: null,
    catalogHeaders: null,
    failUpload: false,
    waitForUpload: new Promise(resolve => { releaseUpload = resolve; })
  };
  await installKeeperUploadRoutes(page, state);
  await unlockKeeper(page);
  const dialog = await chooseFixture(page);

  const upload = page.locator('#uploadButton');
  await upload.evaluate(button => { button.click(); button.click(); });

  await expect.poll(() => state.uploadCount).toBe(1);
  await expect(upload).toBeDisabled();
  await expect(page.locator('#uploadState')).toHaveText('UPLOADING');
  await expect(page.locator('#uploadWorkflowStage')).toBeVisible();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('Uploading to the Garden');
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper?.state?.batch?.running)).toBe(true);
  expect(state.uploadKey).toMatch(/^shadow-garden\/books\/moonlit-reader-fixture\/.+\.epub$/);
  expect(state.uploadHeaders?.authorization).toBe('Bearer e2e-keeper-token');
  expect(state.catalogCount).toBe(0);

  releaseUpload();

  await expect.poll(() => state.catalogCount).toBe(1);
  await expect(page.locator('#uploadState')).toHaveText('COMPLETE');
  await expect(page.locator('#uploadWorkflowStage')).toContainText('The new books have taken root.');
  await expect(page.locator('#uploadWorkflowStage')).toContainText('1 book was uploaded successfully');
  await expect(page.locator('#workflowOpenSeries')).toBeVisible();
  await expect(page.locator('#workflowNextBatch')).toHaveText('Upload another batch');
  await expect(page.locator('#batchList .batch-item')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper?.state?.batch?.running)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper?.state?.uploading)).toBe(false);

  expect(state.catalogBody).toMatchObject({
    adult: false,
    series: 'Moonlit Reader Fixture',
    title: 'Moonlit Reader Fixture',
    number: 1,
    duplicatePolicy: 'reject',
    epubKey: state.uploadKey,
    originalFilename: 'reader-fixture.epub'
  });
  expect(state.catalogBody?.status).toBe('Ongoing');
  expect(state.catalogHeaders?.authorization).toBe('Bearer e2e-keeper-token');
  expect(state.uploadCount).toBe(1);
  expect(state.catalogCount).toBe(1);
  await expect(dialog).toBeVisible();
  expect(browserDiagnostics).toEqual([]);
});

test('Garden Keeper upload failure preserves the reviewed queue and restores retry controls', async ({ page, browserDiagnostics }) => {
  const state = {
    requests: [],
    uploadCount: 0,
    catalogCount: 0,
    uploadKey: '',
    uploadHeaders: null,
    catalogBody: null,
    catalogHeaders: null,
    failUpload: true,
    waitForUpload: Promise.resolve()
  };
  await installKeeperUploadRoutes(page, state);
  await unlockKeeper(page);
  await chooseFixture(page);

  const upload = page.locator('#uploadButton');
  await upload.evaluate(button => { button.click(); button.click(); });

  await expect.poll(() => state.uploadCount).toBe(1);
  await expect(page.locator('#uploadState')).toHaveText('COMPLETE WITH ERRORS');
  await expect(page.locator('#uploadWorkflowStage')).toContainText('Some books need attention.');
  await expect(page.locator('#uploadWorkflowStage')).toContainText('0 uploaded · 1 failed');
  await expect(page.locator('#workflowNextBatch')).toHaveText('Review upload queue');
  expect(state.catalogCount).toBe(0);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper?.state?.batch?.running)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper?.state?.uploading)).toBe(false);

  await page.locator('#workflowNextBatch').click();
  await expect(page.locator('#uploadWorkflowStage')).toHaveClass(/hidden/);
  await expect(page.locator('#batchList .batch-item')).toHaveCount(1);
  await expect(page.locator('#batchList .batch-item')).toHaveAttribute('data-status', 'failed');
  await expect(upload).toBeEnabled();
  await expect(upload).toHaveText('Upload 1 Book');
  await expect(page.locator('#uploadState')).toHaveText('READY');

  const expectedUploadErrors = browserDiagnostics.filter(entry =>
    entry.type === 'console' &&
    String(entry.sourceUrl || '').includes('/assets/js/admin-batch.js') &&
    (entry.message === 'Error' || entry.message.includes('E2E storage unavailable'))
  );
  const expectedHttpErrors = browserDiagnostics.filter(entry =>
    entry.type === 'console' &&
    entry.message.includes('503') &&
    entry.message.includes('Failed to load resource')
  );
  expect(expectedUploadErrors).toHaveLength(1);
  expect(expectedHttpErrors.length).toBeLessThanOrEqual(1);
  const expectedDiagnostics = new Set([...expectedUploadErrors, ...expectedHttpErrors]);
  expect(browserDiagnostics.filter(entry => !expectedDiagnostics.has(entry))).toEqual([]);
});
