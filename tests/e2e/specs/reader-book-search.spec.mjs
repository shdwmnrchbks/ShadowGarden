import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect(page.locator('#chapterTitle')).not.toHaveText('', { timeout: 10_000 });
}

async function openUnifiedSearch(page) {
  await page.locator('#tocToggle').click();
  await expect(page.locator('#tocDrawer')).toHaveClass(/open/);
  const toggle = page.getByRole('button', { name: 'Search contents and book', exact: true });
  await toggle.click();
  const input = page.getByRole('searchbox', { name: 'Search contents and book', exact: true });
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  return { toggle, input };
}

test('Unified search prioritizes Contents matches before book text and opens CFI results canonically', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  const { input } = await openUnifiedSearch(page);

  await input.fill('Chapter Two');
  await expect(page.getByRole('button', { name: 'Chapter Two', exact: true })).toBeVisible();
  await expect(page.locator('.book-search-result').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.toc-search-section-label')).toHaveText(['Contents', 'Book text']);
  const order = await page.evaluate(() => {
    const contents = document.querySelector('#tocTree');
    const book = document.querySelector('.toc-book-search-section');
    return Boolean(contents && book && (contents.compareDocumentPosition(book) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(order).toBe(true);

  await input.fill('Second chapter paragraph 17');
  await expect(page.getByText('No matching contents.', { exact: true })).toBeVisible();
  await expect(page.locator('.book-search-status')).toHaveText('1 book-text match.', { timeout: 20_000 });
  const result = page.locator('.book-search-result').first();
  await expect(result.locator('.book-search-result-chapter')).toHaveText('Chapter Two');
  await expect(result.locator('.book-search-result-excerpt')).toContainText('Second chapter paragraph 17');

  await result.click();
  await expect(page.locator('#tocDrawer')).not.toHaveClass(/open/);
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter Two', { timeout: 10_000 });

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('Ctrl/Cmd+F opens unified Contents search and preserves the bounded 100-result book scan', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f');
  const drawer = page.locator('#tocDrawer');
  const input = page.getByRole('searchbox', { name: 'Search contents and book', exact: true });
  await expect(drawer).toHaveClass(/open/);
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();

  await input.fill('stable reading position');
  await expect(page.locator('.book-search-status')).toHaveText('100+ book-text matches · Refine your search for more precise results.', { timeout: 20_000 });
  await expect(page.locator('.book-search-result')).toHaveCount(100);

  await input.press('Escape');
  await expect(input).toHaveValue('');
  await expect(page.locator('.book-search-result')).toHaveCount(0);
  await expect(drawer).toHaveClass(/open/);

  await input.press('Escape');
  await expect(drawer).not.toHaveClass(/open/);

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
