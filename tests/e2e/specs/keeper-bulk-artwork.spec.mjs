import { test, expect } from '../support/fixtures.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const BOOK_ONE = 'bk_1111111111111111111111';
const BOOK_TWO = 'bk_2222222222222222222222';
const BOOK_THREE = 'bk_3333333333333333333333';
const COVER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nC8AAAAASUVORK5CYII=', 'base64');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const initialSeries = [
  {
    id: 'artwork-alpha',
    title: 'Artwork Alpha',
    author: 'Keeper A',
    status: 'Ongoing',
    cover: '/media/shadow-garden/covers/alpha-old-detail.webp',
    coverThumb: '/media/shadow-garden/covers/alpha-old-thumb.webp',
    bannerBookId: BOOK_ONE,
    volumes: [
      {
        title: 'Artwork Alpha 1', number: 1,
        file: '/media/shadow-garden/books/artwork-alpha/one.epub', bookId: BOOK_ONE,
        cover: '/media/shadow-garden/covers/alpha-old-detail.webp', coverThumb: '/media/shadow-garden/covers/alpha-old-thumb.webp'
      },
      {
        title: 'Artwork Alpha 2', number: 2,
        file: '/media/shadow-garden/books/artwork-alpha/two.epub', bookId: BOOK_TWO,
        cover: '/media/shadow-garden/covers/alpha-two-detail.webp', coverThumb: '/media/shadow-garden/covers/alpha-two-thumb.webp'
      }
    ]
  },
  {
    id: 'artwork-beta',
    title: 'Artwork Beta',
    author: 'Keeper B',
    status: 'Complete',
    cover: '/media/shadow-garden/covers/beta-detail.webp',
    coverThumb: '/media/shadow-garden/covers/beta-thumb.webp',
    bannerBookId: BOOK_THREE,
    volumes: [{
      title: 'Artwork Beta 1', number: 1,
      file: '/media/shadow-garden/books/artwork-beta/one.epub', bookId: BOOK_THREE,
      cover: '/media/shadow-garden/covers/beta-detail.webp', coverThumb: '/media/shadow-garden/covers/beta-thumb.webp'
    }]
  }
];

function libraryPayload() {
  return {
    main: clone(initialSeries),
    adult: [],
    counts: { main: 2, adult: 0, series: 2, volumes: 3 }
  };
}

function bannerPayload(id) {
  if (id === 'artwork-alpha') return {
    ok: true, id, current: BOOK_ONE,
    choices: [
      { bookId: BOOK_ONE, number: 1, title: 'Artwork Alpha 1', cover: '/media/shadow-garden/covers/alpha-old-detail.webp' },
      { bookId: BOOK_TWO, number: 2, title: 'Artwork Alpha 2', cover: '/media/shadow-garden/covers/alpha-two-detail.webp' }
    ]
  };
  return {
    ok: true, id, current: BOOK_THREE,
    choices: [{ bookId: BOOK_THREE, number: 1, title: 'Artwork Beta 1', cover: '/media/shadow-garden/covers/beta-detail.webp' }]
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
    if (request.postData() && String(request.headers()['content-type'] || '').includes('application/json')) {
      try { body = request.postDataJSON(); }
      catch { body = null; }
    }
    controls.requests.push({ path, method, body, url: request.url() });

    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, libraryPayload());
    if (path === '/admin-api/series-banner' && method === 'GET') return fulfillJson(route, bannerPayload(url.searchParams.get('id')));

    if (path === '/admin-api/upload' && method === 'POST') {
      controls.uploadKeys.push(url.searchParams.get('key') || '');
      if (controls.uploadKeys.length === 1) await controls.firstUploadGate.promise;
      return fulfillJson(route, { ok: true, key: url.searchParams.get('key') || '' });
    }

    if (path === '/admin-api/artwork' && method === 'POST') {
      controls.artworkBodies.push(clone(body));
      return fulfillJson(route, { ok: true, updatedArtwork: { series: 2, covers: 1, banners: 2 } });
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
  await expect(page.locator('.manager-card')).toHaveCount(2);
}

test('Garden Keeper batch artwork previews cover/banner changes and commits once while busy', async ({ page, browserDiagnostics }) => {
  const controls = {
    requests: [],
    uploadKeys: [],
    artworkBodies: [],
    firstUploadGate: deferred()
  };
  await installKeeperRoutes(page, controls);
  await unlockKeeper(page);

  const cards = page.locator('.manager-card');
  await cards.nth(0).locator('[data-bulk-series-select]').check();
  await cards.nth(1).locator('[data-bulk-series-select]').check();

  const open = page.locator('#openBulkArtwork');
  await expect(open).toBeEnabled();
  await expect(open).toHaveText('Batch artwork (2)');
  await open.click();

  const dialog = page.locator('#bulkArtworkEditor');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#bulkArtworkCount')).toHaveText('2 series selected');
  await expect(page.locator('.bulk-artwork-row')).toHaveCount(2);

  const alpha = page.locator('[data-artwork-series="artwork-alpha"]');
  await alpha.locator('[data-artwork-target]').selectOption('volume:0');
  await alpha.locator('[data-artwork-file]').setInputFiles({ name: 'alpha-replacement.png', mimeType: 'image/png', buffer: COVER_PNG });
  await alpha.locator('[data-artwork-banner]').selectOption(`book:${BOOK_TWO}`);

  const beta = page.locator('[data-artwork-series="artwork-beta"]');
  await beta.locator('[data-artwork-banner]').selectOption('__random__');

  await expect(page.locator('#bulkArtworkChangedCount')).toHaveText('2 series changing');
  await expect(page.locator('#bulkArtworkPreview')).toContainText('Artwork Alpha');
  await expect(page.locator('#bulkArtworkPreview')).toContainText('Volume 1 — Artwork Alpha 1');
  await expect(page.locator('#bulkArtworkPreview')).toContainText('alpha-replacement.png');
  await expect(page.locator('#bulkArtworkPreview')).toContainText('Volume 2 — Artwork Alpha 2');
  await expect(page.locator('#bulkArtworkPreview')).toContainText('Artwork Beta');
  await expect(page.locator('#bulkArtworkPreview')).toContainText('Random — any volume cover');

  const save = page.locator('#saveBulkArtwork');
  await expect(save).toBeEnabled();
  await save.evaluate(button => { button.click(); button.click(); });

  await expect.poll(() => controls.uploadKeys.length, { timeout: 15_000 }).toBe(1);
  await expect(save).toBeDisabled();
  await expect(dialog).toBeVisible();
  expect(controls.artworkBodies).toHaveLength(0);

  controls.firstUploadGate.resolve();
  await expect.poll(() => controls.uploadKeys.length, { timeout: 15_000 }).toBe(2);
  await expect.poll(() => controls.artworkBodies.length, { timeout: 15_000 }).toBe(1);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.admin-toast', { hasText: 'Updated artwork for 2 series.' })).toBeVisible();

  expect(controls.uploadKeys[0]).toMatch(/^shadow-garden\/covers\/cv_[A-Za-z0-9_-]{20,64}-detail\.webp$/);
  expect(controls.uploadKeys[1]).toMatch(/^shadow-garden\/covers\/cv_[A-Za-z0-9_-]{20,64}-thumb\.webp$/);

  const [body] = controls.artworkBodies;
  expect(body?.updates).toHaveLength(2);
  expect(body.updates[0]).toMatchObject({
    seriesId: 'artwork-alpha',
    scope: 'main',
    coverTarget: 'volume',
    volumeFile: '/media/shadow-garden/books/artwork-alpha/one.epub',
    coverKey: controls.uploadKeys[0],
    coverThumbKey: controls.uploadKeys[1],
    bannerBookId: BOOK_TWO
  });
  expect(body.updates[1]).toEqual({
    seriesId: 'artwork-beta',
    scope: 'main',
    bannerBookId: ''
  });

  const artworkPosts = controls.requests.filter(entry => entry.path === '/admin-api/artwork' && entry.method === 'POST');
  expect(artworkPosts).toHaveLength(1);
  expect(browserDiagnostics).toEqual([]);
});
