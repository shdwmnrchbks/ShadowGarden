import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect(page.locator('#chapterTitle')).not.toHaveText('', { timeout: 10_000 });
}

async function openContents(page) {
  await page.locator('#tocToggle').click();
  await expect(page.locator('#tocDrawer')).toHaveClass(/open/);
  await expect(page.getByRole('searchbox', { name: 'Search contents' })).toBeVisible();
}

test('Slice 3 filters long-book contents without changing the canonical reading position', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  await openContents(page);

  const search = page.getByRole('searchbox', { name: 'Search contents' });
  await search.fill('large');
  await expect(page.getByRole('button', { name: 'Large Chapter', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chapter One', exact: true })).toBeHidden();

  await search.fill('does not exist');
  await expect(page.getByText('No matching chapters.', { exact: true })).toBeVisible();

  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Chapter One', exact: true })).toBeVisible();
  await expect(page.getByText('No matching chapters.', { exact: true })).toBeHidden();

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('Slice 3 Current clears filtering and reveals the live TOC chapter', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  await openContents(page);

  await page.getByRole('button', { name: 'Chapter Two', exact: true }).click();
  await expect(page.locator('#tocDrawer')).not.toHaveClass(/open/);
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter Two', { timeout: 8_000 });

  await openContents(page);
  const search = page.getByRole('searchbox', { name: 'Search contents' });
  await search.fill('visual');
  await expect(page.getByRole('button', { name: 'Visual Plate', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chapter Two', exact: true })).toBeHidden();

  const current = page.getByRole('button', { name: 'Current', exact: true });
  await expect(current).toBeEnabled();
  await current.click();
  await expect(search).toHaveValue('');

  const active = page.locator('#tocPanel .toc-entry-link[aria-current="location"]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveText('Chapter Two');
  await expect(active).toBeVisible();
  await expect(active).toBeFocused();

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
