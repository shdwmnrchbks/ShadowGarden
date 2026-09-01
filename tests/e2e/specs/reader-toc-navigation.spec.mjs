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
  const toggle = page.getByRole('button', { name: 'Search contents', exact: true });
  const search = page.getByRole('searchbox', { name: 'Search contents' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(search).toBeHidden();
  return { toggle, search };
}

async function expandSearch(page) {
  const toggle = page.getByRole('button', { name: 'Search contents', exact: true });
  const search = page.getByRole('searchbox', { name: 'Search contents' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(search).toBeVisible();
  await expect(search).toBeFocused();
  return { toggle, search };
}

test('Slice 3 Contents search stays collapsed behind the header icon until requested', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  const { toggle, search } = await openContents(page);

  expect(await toggle.evaluate(button => button.previousElementSibling?.dataset.panel || '')).toBe('bookmarks');
  await expandSearch(page);

  await search.fill('large');
  await expect(page.getByRole('button', { name: 'Large Chapter', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chapter One', exact: true })).toBeHidden();

  await search.fill('does not exist');
  await expect(page.getByText('No matching chapters.', { exact: true })).toBeVisible();

  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(search).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chapter One', exact: true })).toBeVisible();
  await expect(page.getByText('No matching chapters.', { exact: true })).toBeHidden();

  // With an empty search, Escape collapses the tray and then follows the Reader's existing
  // drawer Escape contract. Reopening Contents must return to the uncluttered collapsed state.
  await search.press('Escape');
  await expect(page.locator('#tocDrawer')).not.toHaveClass(/open/);
  await expect(page.locator('.toc-search-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.toc-search')).toBeHidden();
  await openContents(page);

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('Slice 3 search icon returns from Bookmarks to Contents and Current reveals the live chapter', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  await openContents(page);

  await page.getByRole('button', { name: 'Chapter Two', exact: true }).click();
  await expect(page.locator('#tocDrawer')).not.toHaveClass(/open/);
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter Two', { timeout: 8_000 });

  const { toggle } = await openContents(page);
  await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
  await expect(page.locator('#bookmarksPanel')).toBeVisible();
  await toggle.click();
  await expect(page.getByRole('tab', { name: 'Contents', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tocPanel')).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Search contents' });
  await expect(search).toBeVisible();
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
