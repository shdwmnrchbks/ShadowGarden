import { test, expect } from '../support/fixtures.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const initialSeries = {
  id: 'series-keeper-e2e',
  title: 'Keeper Test Series',
  author: 'Original Author',
  year: '2024',
  status: 'Ongoing',
  genres: ['Fantasy'],
  tags: ['Regression'],
  description: 'Original series description.',
  audioAlignedUrl: '',
  translationStatus: 'Ongoing',
  translations: [
    { name: 'First Translator', url: 'https://translator.example/first', coverage: 'Volumes 1-2' }
  ],
  volumes: [
    {
      title: 'Keeper Test Volume 1',
      number: 1,
      date: '2024-01-01',
      publisher: 'Shadow Garden Fixture',
      description: 'Fixture volume.',
      size: 1024,
      translations: []
    }
  ]
};

function libraryPayload(series) {
  return {
    main: [clone(series)],
    adult: [],
    counts: { main: 1, adult: 0, series: 1, volumes: 1 }
  };
}

async function fulfillJson(route, value, status = 200, headers = {}) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store', ...headers },
    body: JSON.stringify(value)
  });
}

async function installKeeperRoutes(page, requests, controls) {
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
    const request = route.request();
    const method = request.method();
    let body = null;
    if (request.postData()) {
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
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, libraryPayload(series));
    if (path === '/admin-api/series-banner' && method === 'GET') return fulfillJson(route, {
      id: series.id,
      current: '',
      choices: []
    });

    if (path === '/admin-api/library' && method === 'POST' && body?.action === 'update-series') {
      controls.seriesSaveCount += 1;
      controls.seriesSaveBody = body;
      await controls.waitForSeriesSave;
      series = {
        ...series,
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
      };
      return fulfillJson(route, { ...libraryPayload(series), changedId: series.id });
    }

    if (path === '/admin-api/translations' && method === 'POST' && body?.target === 'volume') {
      controls.volumeSaveCount += 1;
      controls.volumeSaveBody = body;
      await controls.waitForVolumeSave;
      const volumeIndex = Number(body.volumeIndex);
      series.volumes[volumeIndex] = {
        ...series.volumes[volumeIndex],
        translations: clone(body.translations || [])
      };
      return fulfillJson(route, { ok: true });
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
  await expect(page.locator('#dashboardView')).toBeVisible();
  await expect(page.locator('#manageSeriesCount')).toHaveText('1');
  await expect(page.locator('#manageVolumeCount')).toHaveText('1');
}

test('Garden Keeper series and translation saves remain single-owner, single-submit real-browser flows', async ({ page, browserDiagnostics }) => {
  let releaseSeriesSave;
  let releaseVolumeSave;
  const controls = {
    seriesSaveCount: 0,
    volumeSaveCount: 0,
    seriesSaveBody: null,
    volumeSaveBody: null,
    waitForSeriesSave: new Promise(resolve => { releaseSeriesSave = resolve; }),
    waitForVolumeSave: new Promise(resolve => { releaseVolumeSave = resolve; })
  };
  const requests = [];
  const currentSeries = await installKeeperRoutes(page, requests, controls);
  await unlockKeeper(page);

  const managerCard = page.locator('.manager-card').filter({ hasText: 'Keeper Test Series' });
  await expect(managerCard).toBeVisible();
  const openSeries = managerCard.locator('[data-manager-open]');
  await openSeries.click();

  const editor = page.locator('#seriesEditor');
  await expect(editor).toBeVisible();
  await expect(page.locator('#seriesEditorHeading')).toHaveText('Keeper Test Series');
  await expect(page.locator('#manageTranslationSection')).toBeVisible();
  await expect(page.locator('#seriesSaveState')).toHaveText('No changes', { timeout: 3_000 });

  await page.locator('#manageTitle').fill('Keeper Test Series Revised');
  await page.locator('#manageAuthor').fill('Revised Author');
  await page.locator('#manageStatus').selectOption('Complete');
  await page.locator('#manageTags').fill('Regression, Translation');
  await page.locator('#manageDescription').fill('Revised by the Slice 8 real-browser matrix.');
  await page.locator('#manageAudioAlignedUrl').fill('https://audio.example/keeper-test/');
  await page.locator('#manageTranslationStatus').selectOption('Complete');

  const seriesCredits = page.locator('#manageTranslations [data-translation-row]');
  await expect(seriesCredits).toHaveCount(1);
  await seriesCredits.first().locator('[data-t-name]').fill('Primary Translator');
  await seriesCredits.first().locator('[data-t-url]').fill('https://translator.example/primary');
  await seriesCredits.first().locator('[data-t-coverage]').fill('Volumes 1-4');
  await page.locator('#addTranslationCredit').click();
  await expect(seriesCredits).toHaveCount(2);
  await seriesCredits.nth(1).locator('[data-t-name]').fill('Second Translator');
  await seriesCredits.nth(1).locator('[data-t-url]').fill('https://translator.example/second');
  await seriesCredits.nth(1).locator('[data-t-coverage]').fill('Volumes 5-6');

  await expect(page.locator('#seriesSaveState')).toHaveText('Unsaved changes');
  const saveSeries = page.locator('#saveSeries');
  await expect(saveSeries).toBeEnabled();
  await saveSeries.evaluate(button => { button.click(); button.click(); });

  await expect.poll(() => controls.seriesSaveCount).toBe(1);
  await expect(saveSeries).toBeDisabled();
  await expect(saveSeries).toHaveText('Saving…');
  expect(controls.seriesSaveBody).toMatchObject({
    action: 'update-series',
    id: 'series-keeper-e2e',
    title: 'Keeper Test Series Revised',
    author: 'Revised Author',
    status: 'Complete',
    tags: ['Regression', 'Translation'],
    description: 'Revised by the Slice 8 real-browser matrix.',
    audioAlignedUrl: 'https://audio.example/keeper-test/',
    translationStatus: 'Complete',
    translations: [
      { name: 'Primary Translator', url: 'https://translator.example/primary', coverage: 'Volumes 1-4' },
      { name: 'Second Translator', url: 'https://translator.example/second', coverage: 'Volumes 5-6' }
    ]
  });
  expect(controls.seriesSaveBody?.genres).toEqual(['Fantasy']);

  releaseSeriesSave();
  await expect(editor).not.toBeVisible();
  await expect(page.locator('.manager-card').filter({ hasText: 'Keeper Test Series Revised' })).toBeVisible();
  await expect(openSeries).toBeFocused();
  await expect.poll(() => page.locator('.admin-toast').last().textContent()).toContain('Saved');

  const revisedCard = page.locator('.manager-card').filter({ hasText: 'Keeper Test Series Revised' });
  await revisedCard.locator('[data-manager-open]').click();
  await expect(editor).toBeVisible();
  await expect(page.locator('#manageTranslationStatus')).toHaveValue('Complete');
  await expect(page.locator('#manageTranslations [data-t-name]').first()).toHaveValue('Primary Translator');
  await expect(page.locator('#manageTranslations [data-t-name]').nth(1)).toHaveValue('Second Translator');

  const firstVolume = page.locator('#manageVolumes .manage-volume').first();
  await firstVolume.locator('[data-volume-toggle]').click();
  const addOverride = firstVolume.locator('[data-add-volume-translation]');
  await expect(addOverride).toBeVisible();
  await addOverride.click();
  const volumeCredit = firstVolume.locator('[data-volume-translations] [data-translation-row]').last();
  await volumeCredit.locator('[data-t-name]').fill('Volume Translator');
  await volumeCredit.locator('[data-t-url]').fill('https://translator.example/volume');
  await volumeCredit.locator('[data-t-coverage]').fill('Volume 1');

  const saveOverride = firstVolume.locator('[data-save-volume-translation]');
  await saveOverride.evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => controls.volumeSaveCount).toBe(1);
  await expect(saveOverride).toBeDisabled();
  await expect(saveOverride).toHaveText('Saving…');
  expect(controls.volumeSaveBody).toEqual({
    id: 'series-keeper-e2e',
    target: 'volume',
    volumeIndex: 0,
    translations: [
      { name: 'Volume Translator', url: 'https://translator.example/volume', coverage: 'Volume 1' }
    ]
  });

  releaseVolumeSave();
  await expect(saveOverride).toBeEnabled();
  await expect(saveOverride).toHaveText('Save translation override');
  await expect.poll(() => requests.filter(entry => entry.path === '/admin-api/library' && entry.method === 'GET').length).toBeGreaterThan(1);
  await expect.poll(() => page.locator('.admin-toast').last().textContent()).toContain('translation override saved');
  expect(currentSeries().volumes[0].translations).toEqual([
    { name: 'Volume Translator', url: 'https://translator.example/volume', coverage: 'Volume 1' }
  ]);

  const libraryPosts = requests.filter(entry => entry.path === '/admin-api/library' && entry.method === 'POST');
  const translationPosts = requests.filter(entry => entry.path === '/admin-api/translations' && entry.method === 'POST');
  expect(libraryPosts).toHaveLength(1);
  expect(translationPosts).toHaveLength(1);
  expect(libraryPosts[0]?.headers?.authorization).toBe('Bearer e2e-keeper-token');
  expect(translationPosts[0]?.headers?.authorization).toBe('Bearer e2e-keeper-token');
  expect(browserDiagnostics).toEqual([]);
});
