import { test, expect } from '../support/fixtures.mjs';

async function waitForCatalog(page) {
  await expect(page.locator('.catalog-skeleton-card')).toHaveCount(0);
  await expect(page.locator('#resultCount')).not.toHaveText(/Opening the .* archive/);
}

async function installCatalogInsertCounter(page) {
  await page.evaluate(() => {
    window.__sgFilterRenderCalls = 0;
    const original = Element.prototype.insertAdjacentHTML;
    window.__sgRestoreInsertAdjacentHTML = () => { Element.prototype.insertAdjacentHTML = original; };
    Element.prototype.insertAdjacentHTML = function(position, html) {
      if (this.id === 'catalogGrid') window.__sgFilterRenderCalls += 1;
      return original.call(this, position, html);
    };
  });
}

async function readCatalogInsertCounter(page) {
  return page.evaluate(() => {
    const count = window.__sgFilterRenderCalls;
    window.__sgRestoreInsertAdjacentHTML?.();
    return count;
  });
}

test('active Library filter pills perform one canonical catalog render', async ({ page, browserDiagnostics }) => {
  await page.goto('/');
  await waitForCatalog(page);

  await page.locator('#searchInput').fill('moonlit conservatory');
  await expect(page.locator('.series-card')).toHaveCount(1);
  await expect(page.locator('#activeTags [data-clear-filter="query"]')).toHaveCount(1);

  await installCatalogInsertCounter(page);
  await page.locator('#activeTags [data-clear-filter="query"]').click();
  await expect(page.locator('.series-card')).toHaveCount(2);

  expect(await readCatalogInsertCounter(page)).toBe(1);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('recent View all clears Library filters through one canonical catalog render', async ({ page, browserDiagnostics }) => {
  await page.goto('/');
  await waitForCatalog(page);

  await page.locator('#searchInput').fill('moonlit conservatory');
  await expect(page.locator('.series-card')).toHaveCount(1);
  await expect(page.locator('#activeTags [data-clear-filter="query"]')).toHaveCount(1);

  await installCatalogInsertCounter(page);
  await page.locator('#recentViewAll').evaluate(button => button.click());
  await expect(page.locator('.series-card')).toHaveCount(2);
  await expect(page.locator('#activeTags button')).toHaveCount(0);
  await expect(page).not.toHaveURL(/(?:\?|&)q=/);

  expect(await readCatalogInsertCounter(page)).toBe(1);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
