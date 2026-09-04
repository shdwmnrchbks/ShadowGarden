import { test, expect } from '../support/fixtures.mjs';

async function waitForCatalog(page) {
  await expect(page.locator('.catalog-skeleton-card')).toHaveCount(0);
  await expect(page.locator('#resultCount')).not.toHaveText(/Opening the .* archive/);
}

test('active Library filter pills perform one canonical catalog render', async ({ page, browserDiagnostics }) => {
  await page.goto('/');
  await waitForCatalog(page);

  await page.locator('#searchInput').fill('moonlit conservatory');
  await expect(page.locator('.series-card')).toHaveCount(1);
  await expect(page.locator('#activeTags [data-clear-filter="query"]')).toHaveCount(1);

  await page.evaluate(() => {
    window.__sgFilterRenderCalls = 0;
    const original = Element.prototype.insertAdjacentHTML;
    window.__sgRestoreInsertAdjacentHTML = () => { Element.prototype.insertAdjacentHTML = original; };
    Element.prototype.insertAdjacentHTML = function(position, html) {
      if (this.id === 'catalogGrid') window.__sgFilterRenderCalls += 1;
      return original.call(this, position, html);
    };
  });

  await page.locator('#activeTags [data-clear-filter="query"]').click();
  await expect(page.locator('.series-card')).toHaveCount(2);

  const renderCalls = await page.evaluate(() => {
    const count = window.__sgFilterRenderCalls;
    window.__sgRestoreInsertAdjacentHTML?.();
    return count;
  });

  expect(renderCalls).toBe(1);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
