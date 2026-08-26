import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';
import { expectAccessibleChrome, expectTouchTarget, expectViewportReflow } from '../support/accessibility.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;
const seriesUrl = `/series.html?id=${encodeURIComponent(READER_SERIES_ID)}`;

async function waitForCatalog(page) {
  await expect(page.locator('.catalog-skeleton-card')).toHaveCount(0);
  await expect(page.locator('#resultCount')).not.toHaveText(/Opening the .* archive/);
}

async function waitForSeries(page) {
  await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy', 'false', { timeout: 12_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Moonlit Single' })).toBeVisible();
}

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
}

async function fulfillJson(route, value, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(value)
  });
}

async function installKeeperRoutes(page) {
  await page.route('**/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: `window.turnstile={render(host,options){const button=document.createElement('button');button.type='button';button.dataset.e2eTurnstile='1';button.textContent='Complete Keeper verification';button.addEventListener('click',()=>options.callback('e2e-turnstile-token'));host.replaceChildren(button);return'e2e-widget'},reset(){}};`
  }));
  await page.route('**/admin-access', route => {
    if (route.request().method() === 'GET') return fulfillJson(route, { siteKey: 'e2e-site-key', action: 'admin_access' });
    if (route.request().method() === 'POST') return fulfillJson(route, { ok: true });
    if (route.request().method() === 'DELETE') return fulfillJson(route, { ok: true });
    return route.fulfill({ status: 405, body: '' });
  });
  await page.route('**/admin-api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/admin-api/status' && method === 'POST') return fulfillJson(route, { ok: true });
    if (path === '/admin-api/library' && method === 'GET') return fulfillJson(route, { main: [], adult: [], counts: { main: 0, adult: 0, series: 0, volumes: 0 } });
    if (path === '/admin-api/maintenance' && method === 'GET') return fulfillJson(route, {
      health: { status: 'healthy', counts: { series: 0, volumes: 0 }, metrics: {}, issues: [], optimizationCandidates: [] },
      taxonomy: { totalSeries: 0, canonicalGenreCount: 35, affectedSeries: 0, preview: [] }
    });
    return fulfillJson(route, { ok: true });
  });
}

async function unlockKeeper(page) {
  await installKeeperRoutes(page);
  await page.goto('/admin.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 12_000 }).toBe(true);
  await page.locator('#unlockButton').click();
  await page.locator('#adminToken').fill('e2e-keeper-token');
  await page.locator('#unlockButton').click();
  await page.locator('[data-e2e-turnstile]').click();
  await expect(page.locator('#dashboardView')).toBeVisible();
}

test('Library, Series, Reader chrome, and unlocked Garden Keeper pass the bounded accessibility scan', async ({ page, browserDiagnostics }) => {
  await page.goto('/');
  await waitForCatalog(page);
  await expectAccessibleChrome(page, 'body');

  await page.goto(seriesUrl);
  await waitForSeries(page);
  await expectAccessibleChrome(page, 'body');

  await waitForReader(page);
  await expectAccessibleChrome(page, '#readerApp');

  await unlockKeeper(page);
  await expectAccessibleChrome(page, 'body');
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('public and Keeper chrome reflow at 200% and 400% equivalent viewport widths', async ({ page, browserDiagnostics }) => {
  await page.goto('/');
  await waitForCatalog(page);
  await expectViewportReflow(page, 640);
  await expectViewportReflow(page, 320);

  await unlockKeeper(page);
  await expectViewportReflow(page, 640);
  await expectViewportReflow(page, 320);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('Reader keyboard focus restores from drawers and forced-colors/contrast retain visible focus', async ({ page, browserDiagnostics }) => {
  await page.emulateMedia({ forcedColors: 'active', contrast: 'more' });
  await waitForReader(page);

  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-contrast: more)').matches)).toBe(true);

  await page.locator('#tocToggle').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tocDrawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#tocToggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#tocDrawer').getByRole('tab', { name: 'Contents' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tocDrawer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#tocToggle')).toBeFocused();

  await page.keyboard.press('Tab');
  const focusStyle = await page.evaluate(() => {
    const element = document.activeElement;
    const style = element ? getComputedStyle(element) : null;
    return { tag: element?.tagName || '', outlineStyle: style?.outlineStyle || '', outlineWidth: style?.outlineWidth || '' };
  });
  expect(focusStyle.tag).not.toBe('BODY');
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(parseFloat(focusStyle.outlineWidth || '0')).toBeGreaterThan(0);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('mobile Reader controls expose labelled 44px touch targets and allow browser zoom', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-project accessibility regression');
  await waitForReader(page);

  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute('content', /maximum-scale|user-scalable\s*=\s*no/i);
  const controls = [
    ['#tocToggle', 'Table of contents'],
    ['#bookmarkButton', 'Bookmark this location'],
    ['#settingsToggle', 'Reader settings'],
    ['#returnButton', 'Return to series'],
    ['#prevBottom', 'Previous page'],
    ['#nextBottom', 'Next page']
  ];
  for (const [selector, name] of controls) {
    const control = page.locator(selector);
    await expect(control).toHaveAccessibleName(name);
    await expectTouchTarget(control);
  }
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
