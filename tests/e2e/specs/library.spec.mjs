import { test, expect } from '../support/fixtures.mjs';

async function waitForCatalog(page) {
  await expect(page.locator('.catalog-skeleton-card')).toHaveCount(0);
  await expect(page.locator('#resultCount')).not.toHaveText(/Opening the .* archive/);
}

test('Main and Adult libraries hydrate from isolated fixture catalogs', async ({ page, browserDiagnostics }) => {
  await page.goto('/');
  await waitForCatalog(page);
  await expect(page.locator('.series-card')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Moonlit Single' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Night Orchid' })).toHaveCount(0);
  await expect(page.locator('#resultCount')).toContainText('2 series · 4 volumes');

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

  await page.goto('/nsfw.html');
  await waitForCatalog(page);
  await page.goBack();
  await waitForCatalog(page);
  await expect(page.locator('#searchInput')).toHaveValue('moonlit conservatory');
  await expect(page.locator('#catalogGrid')).toHaveClass(/compact/);
  await expect(page.locator('.series-card')).toHaveCount(1);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('reading suggestion reroll advances and pinned series remain available in the navigation drawer', async ({ page, browserDiagnostics }) => {
  await page.addInitScript(() => localStorage.setItem('sg-pinned', JSON.stringify(['moonlit-single'])));
  await page.goto('/');
  await waitForCatalog(page);

  const suggestion = page.locator('#continuePanel strong');
  const reroll = page.getByRole('button', { name: 'Show another reading suggestion' });
  await expect(reroll).toHaveText('↻');
  const before = await suggestion.textContent();
  await reroll.click();
  await expect(suggestion).not.toHaveText(before || '');

  const menu = page.locator('.brand-mark');
  await menu.click();
  await expect(page.locator('#siteNav')).toBeVisible();
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
  await expect(page.locator('html')).toHaveClass(/site-nav-open/);
  await expect(page.locator('body')).toHaveClass(/site-nav-open/);
  expect(await page.locator('html').evaluate(node => getComputedStyle(node).overflow)).toBe('hidden');

  const before = await header.boundingBox();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#siteNav')).toBeVisible();
  const after = await header.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs((after?.y || 0) - (before?.y || 0))).toBeLessThan(2);

  await menu.click();
  await expect(menu).toHaveAttribute('aria-label', 'Open navigation');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('html')).not.toHaveClass(/site-nav-open/);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});