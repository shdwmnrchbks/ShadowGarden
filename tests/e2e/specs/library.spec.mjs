import { test, expect } from '../support/fixtures.mjs';

async function waitForCatalog(page) {
  await expect(page.locator('.catalog-skeleton-card')).toHaveCount(0);
  await expect(page.locator('#resultCount')).not.toHaveText(/Opening the .* archive/);
}

async function acknowledgeAdult(page) {
  await page.evaluate(() => localStorage.setItem('sg-adult-ack', '1'));
}

async function openNavLayerState(page) {
  return page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const drawer = document.querySelector('#siteNav');
    if (!header || !drawer) return null;
    const rect = header.getBoundingClientRect();
    const x = Math.max(1, Math.min(window.innerWidth - 1, window.innerWidth / 2));
    const y = Math.max(1, Math.min(window.innerHeight - 1, rect.top + Math.max(1, rect.height / 2)));
    const topmost = document.elementFromPoint(x, y);
    return {
      position: getComputedStyle(header).position,
      headerOwnsTopPoint: Boolean(topmost && (topmost === header || header.contains(topmost)))
    };
  });
}

test('Main and Adult libraries hydrate from isolated fixture catalogs', async ({ page, browserDiagnostics }) => {
  await page.goto('/');
  await waitForCatalog(page);
  await expect(page.locator('.series-card')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Moonlit Single' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Night Orchid' })).toHaveCount(0);
  await expect(page.locator('#resultCount')).toContainText('2 series · 4 volumes');

  await acknowledgeAdult(page);
  await page.goto('/nsfw.html');
  await waitForCatalog(page);
  await expect(page.locator('.series-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Night Orchid' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Moonlit Single' })).toHaveCount(0);
  await expect(page.locator('#resultCount')).toContainText('1 series · 2 volumes');
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('search, compact view, and Back navigation restore rendered Library state', async ({ page, browserDiagnostics }) => {
  await page.goto('/');
  await waitForCatalog(page);

  await page.locator('#searchInput').fill('moonlit conservatory');
  await expect(page.locator('.series-card')).toHaveCount(1);
  await expect(page.locator('.series-card h2')).toContainText('Extremely Long Archive');
  await expect(page).toHaveURL(/q=moonlit\+conservatory|q=moonlit%20conservatory/);

  await page.getByRole('button', { name: 'Compact' }).click();
  await expect(page.locator('#catalogGrid')).toHaveClass(/compact/);
  await expect(page.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/view=compact/);

  await acknowledgeAdult(page);
  await page.goto('/nsfw.html');
  await waitForCatalog(page);
  await page.goBack();
  await waitForCatalog(page);
  await expect(page.locator('#searchInput')).toHaveValue('moonlit conservatory');
  await expect(page.locator('#catalogGrid')).toHaveClass(/compact/);
  await expect(page.locator('.series-card')).toHaveCount(1);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('reading suggestion reroll advances smoothly and pinned series remain available in the navigation drawer', async ({ page, browserDiagnostics }) => {
  await page.addInitScript(() => localStorage.setItem('sg-pinned', JSON.stringify(['moonlit-single'])));
  await page.goto('/');
  await waitForCatalog(page);

  const suggestion = page.locator('#continuePanel strong');
  const reroll = page.getByRole('button', { name: 'Show another reading suggestion' });
  await expect(reroll).toHaveText('↻');
  const before = await suggestion.textContent();
  await reroll.focus();
  await reroll.click();
  await expect(suggestion).not.toHaveText(before || '');
  await expect(page.getByRole('button', { name: 'Show another reading suggestion' })).toBeFocused();
  await expect(page.locator('#suggestionNotice')).toHaveCount(0);

  const header = page.locator('.site-header');
  const menu = page.locator('.brand-mark');
  await menu.click();
  await expect(page.locator('#siteNav')).toBeVisible();
  await expect(header).toBeVisible();
  const layers = await openNavLayerState(page);
  expect(layers).not.toBeNull();
  expect(layers?.position).toBe('fixed');
  expect(layers?.headerOwnsTopPoint).toBe(true);

  const pinnedToggle = page.getByRole('button', { name: /Pinned series/ });
  const pinnedEntry = page.locator('.nav-pinned-entry', { hasText: 'Moonlit Single' });
  await expect(pinnedEntry).toBeVisible();
  await expect(page.locator('.series-card[href*="moonlit-single"] .pinned-indicator')).toContainText('Pinned');

  await pinnedToggle.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(pinnedToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(pinnedEntry).toBeHidden();
  await pinnedToggle.click();
  await expect(pinnedEntry).toBeVisible();
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('reading suggestion reroll explains when the Garden has no alternate path', async ({ page, browserDiagnostics }) => {
  await page.route('**/data/catalog.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify({
      version: 1,
      series: [{
        id: 'last-path',
        title: 'The Last Moonlit Path',
        author: 'Fixture Keeper',
        year: 2026,
        status: 'Ongoing',
        tags: ['Fantasy'],
        description: 'A single remaining recommendation used to verify reroll feedback.',
        volumes: [{
          number: 1,
          title: 'Only One Path Remains',
          year: 2026,
          bookId: 'bk_5555555555555555555555',
          file: 'bk_5555555555555555555555',
          added: '2026-08-26T00:00:00Z'
        }]
      }]
    })
  }));

  await page.goto('/');
  await waitForCatalog(page);
  const suggestion = page.locator('#continuePanel strong');
  const reroll = page.getByRole('button', { name: 'Show another reading suggestion' });
  await expect(suggestion).toHaveText('Only One Path Remains');
  await reroll.focus();
  await reroll.click();

  await expect(suggestion).toHaveText('Only One Path Remains');
  await expect(page.getByRole('button', { name: 'Show another reading suggestion' })).toBeFocused();
  const notice = page.locator('#suggestionNotice');
  await expect(notice).toHaveText('The Garden has no other path to suggest just now.');
  await expect(notice).toHaveClass(/is-visible/);
  await expect(notice).toHaveAttribute('role', 'status');
  expect(browserDiagnostics).toEqual([]);
});

test('mobile navigation remains viewport-owned across resize and reduced motion', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-project regression');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await waitForCatalog(page);

  const header = page.locator('.site-header');
  const menu = page.locator('.brand-mark');
  await expect(menu).toHaveAttribute('aria-label', 'Open navigation');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();

  await expect(menu).toHaveAttribute('aria-label', 'Close navigation');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#siteNav')).toHaveClass(/site-nav-drawer/);
  await expect(page.locator('#siteNav')).toBeVisible();
  await expect(header).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/site-nav-open/);
  await expect(page.locator('body')).toHaveClass(/site-nav-open/);
  expect(await page.locator('html').evaluate(node => getComputedStyle(node).overflow)).toBe('hidden');

  const initialLayers = await openNavLayerState(page);
  expect(initialLayers?.position).toBe('fixed');
  expect(initialLayers?.headerOwnsTopPoint).toBe(true);

  const before = await header.boundingBox();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#siteNav')).toBeVisible();
  const after = await header.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs((after?.y || 0) - (before?.y || 0))).toBeLessThan(2);
  const resizedLayers = await openNavLayerState(page);
  expect(resizedLayers?.headerOwnsTopPoint).toBe(true);

  await menu.click();
  await expect(menu).toHaveAttribute('aria-label', 'Open navigation');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('html')).not.toHaveClass(/site-nav-open/);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
