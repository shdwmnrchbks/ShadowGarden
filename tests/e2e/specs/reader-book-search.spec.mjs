import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect(page.locator('#chapterTitle')).not.toHaveText('', { timeout: 10_000 });
}

test('Slice 4 searches the EPUB spine and opens a matching CFI through the canonical Reader navigation path', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);

  const toggle = page.getByRole('button', { name: 'Search this book', exact: true });
  await toggle.click();
  await expect(page.locator('#bookSearchDrawer')).toHaveClass(/open/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const input = page.getByRole('searchbox', { name: 'Search this book', exact: true });
  await expect(input).toBeFocused();
  await input.fill('Second chapter paragraph 17');
  await input.press('Enter');

  const status = page.locator('#bookSearchStatus');
  await expect(status).toHaveText('1 match in this book.', { timeout: 20_000 });
  const result = page.locator('.book-search-result').first();
  await expect(result.locator('.book-search-result-chapter')).toHaveText('Chapter Two');
  await expect(result.locator('.book-search-result-excerpt')).toContainText('Second chapter paragraph 17');

  await result.click();
  await expect(page.locator('#bookSearchDrawer')).not.toHaveClass(/open/);
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter Two', { timeout: 10_000 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('Slice 4 maps Ctrl/Cmd+F to bounded whole-book search and Escape clears then closes the drawer', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f');
  const drawer = page.locator('#bookSearchDrawer');
  const input = page.getByRole('searchbox', { name: 'Search this book', exact: true });
  await expect(drawer).toHaveClass(/open/);
  await expect(input).toBeFocused();

  await input.fill('stable reading position');
  await input.press('Enter');
  await expect(page.locator('#bookSearchStatus')).toHaveText('100+ matches · Refine your search for more precise results.', { timeout: 20_000 });
  await expect(page.locator('.book-search-result')).toHaveCount(100);

  await input.press('Escape');
  await expect(input).toHaveValue('');
  await expect(page.locator('.book-search-result')).toHaveCount(0);
  await expect(drawer).toHaveClass(/open/);

  await input.press('Escape');
  await expect(drawer).not.toHaveClass(/open/);

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
