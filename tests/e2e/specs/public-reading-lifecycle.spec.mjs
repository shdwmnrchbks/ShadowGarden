import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const seriesUrl = `/series.html?id=${encodeURIComponent(READER_SERIES_ID)}`;
const progressKey = `sg-progress:${READER_BOOK_ID}`;
const bookmarkKey = `sg-bookmarks:${READER_BOOK_ID}`;
const finishedMarkerKey = `sg-finished:${READER_BOOK_ID}`;

async function storedJson(page, key) {
  return page.evaluate(storageKey => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  }, key);
}

async function progress(page) {
  return storedJson(page, progressKey);
}

async function waitForSeries(page) {
  await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy', 'false', { timeout: 12_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Moonlit Single' })).toBeVisible();
  await expect(page.locator('.volume-card')).toHaveCount(1);
}

async function waitForReader(page) {
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#bookTitle')).toHaveText('Moonlit Reader Fixture');
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect.poll(async () => String((await progress(page))?.cfi || ''), { timeout: 12_000 }).toContain('epubcfi');
}

async function openSeriesAction(page, label) {
  const action = page.locator('.series-actions .primary-button');
  await expect(action).toHaveText(label);
  await action.click();
}

async function advanceBeyondBeginning(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.locator('#nextBottom').click();
    try {
      await expect.poll(async () => {
        const saved = await progress(page);
        const mappedPage = Number(saved?.page);
        const percentage = Number(saved?.percentage);
        return (Number.isFinite(mappedPage) && mappedPage > 1) || (Number.isFinite(percentage) && percentage > 0.01);
      }, { timeout: 3_000 }).toBe(true);
      return progress(page);
    } catch {}
  }
  throw new Error('Reader never advanced beyond the canonical beginning state');
}

async function showPaginatedEndPage(page) {
  const range = page.locator('#progressRange');
  await range.evaluate(input => {
    input.value = '1000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const endPage = page.locator('#volumeEndPage');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await endPage.isVisible()) return;
    await page.locator('#nextBottom').click();
    await page.waitForTimeout(180);
  }
  await expect(endPage).toBeVisible();
}

test('Series → Reader → Continue → Finished → Read Again preserves bookmarks and route continuity', async ({ page, browserDiagnostics }) => {
  await page.goto(seriesUrl);
  await waitForSeries(page);
  await expect(page.locator('.series-actions .primary-button')).toHaveAttribute('data-volume-state', 'unread');

  await openSeriesAction(page, 'Read');
  await expect(page).toHaveURL(new RegExp(`/reader\\.html\\?book=${READER_BOOK_ID}.*series=${READER_SERIES_ID}`));
  await waitForReader(page);

  const advanced = await advanceBeyondBeginning(page);
  expect(String(advanced?.cfi || '')).toContain('epubcfi');

  await page.locator('#bookmarkButton').click();
  await expect(page.locator('#bookmarkButton')).toHaveAttribute('aria-pressed', 'true');
  const bookmarksBefore = await storedJson(page, bookmarkKey);
  expect(bookmarksBefore).toHaveLength(1);
  const bookmarkedCfi = bookmarksBefore[0].cfi;
  expect(bookmarkedCfi).toBe(advanced.cfi);

  await page.locator('#returnButton').click();
  await expect(page).toHaveURL(new RegExp(`/series\\.html\\?id=${READER_SERIES_ID}`));
  await waitForSeries(page);
  await expect(page.locator('.series-actions .primary-button')).toHaveAttribute('data-volume-state', 'in-progress');
  await expect(page.locator('.volume-card')).toHaveAttribute('data-reading-state', 'in-progress');

  await openSeriesAction(page, 'Continue');
  await waitForReader(page);
  await expect.poll(async () => String((await progress(page))?.cfi || ''), { timeout: 15_000 }).toBe(bookmarkedCfi);
  await expect(page.locator('#bookmarkButton')).toHaveAttribute('aria-pressed', 'true');

  await showPaginatedEndPage(page);
  const finishedToggle = page.locator('#finishedToggle');
  await expect(finishedToggle).toBeVisible();
  await finishedToggle.check();
  await expect(finishedToggle).toBeChecked();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), finishedMarkerKey)).toBe('1');
  const bookmarksFinished = await storedJson(page, bookmarkKey);
  expect(bookmarksFinished).toHaveLength(1);
  expect(bookmarksFinished[0].cfi).toBe(bookmarkedCfi);

  await page.locator('#completeReturnLink').click();
  await waitForSeries(page);
  await expect(page.locator('.series-actions .primary-button')).toHaveAttribute('data-volume-state', 'finished');
  await expect(page.locator('.volume-card')).toHaveAttribute('data-reading-state', 'finished');
  await expect(page.locator('.volume-state-pill')).toContainText('Finished');

  await openSeriesAction(page, 'Read Again');
  const dialog = page.locator('#readAgainDialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep My Place' })).toBeFocused();
  await page.getByRole('button', { name: 'Begin Again' }).click();
  await expect(page).toHaveURL(/\/reader\.html\?.*restart=1/);
  await waitForReader(page);

  await expect.poll(async () => {
    const saved = await progress(page);
    const mappedPage = Number(saved?.page);
    const percentage = Number(saved?.percentage);
    return (Number.isFinite(mappedPage) && mappedPage <= 1) || (Number.isFinite(percentage) && percentage <= 0.01);
  }, { timeout: 12_000 }).toBe(true);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), finishedMarkerKey)).toBeNull();
  const bookmarksRestarted = await storedJson(page, bookmarkKey);
  expect(bookmarksRestarted).toHaveLength(1);
  expect(bookmarksRestarted[0].cfi).toBe(bookmarkedCfi);

  await page.locator('#returnButton').click();
  await waitForSeries(page);
  await expect(page.locator('.series-actions .primary-button')).toHaveAttribute('data-volume-state', 'unread');
  await expect(page.locator('.series-actions .primary-button')).toHaveText('Read');

  await page.locator('#headerBack').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.catalog-skeleton-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Moonlit Single' })).toBeVisible();
  await expect(page.locator('.recent-volume[data-book-id="bk_1111111111111111111111"]')).toHaveAttribute('data-volume-state', 'unread');

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
