import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const seriesUrl = `/series.html?id=${encodeURIComponent(READER_SERIES_ID)}`;
const progressKey = `sg-progress:${READER_BOOK_ID}`;
const bookmarkKey = `sg-bookmarks:${READER_BOOK_ID}`;
const finishedMarkerKey = `sg-finished:${READER_BOOK_ID}`;
const MULTI_SERIES_ID = 'long-metadata-archive';
const MULTI_SERIES_URL = `/series.html?id=${encodeURIComponent(MULTI_SERIES_ID)}`;
const FIRST_BOOK_ID = 'bk_2222222222222222222222';
const SECOND_BOOK_ID = 'bk_3333333333333333333333';
const LAST_BOOK_ID = 'bk_4444444444444444444444';
const FIRST_TITLE = 'A Long Beginning Beneath the Moonlit Conservatory';
const SECOND_TITLE = 'The Western Continent and the Glass Garden';
const LAST_TITLE = 'An Ancient Archive Opens Again';

async function storedJson(page, key) {
  return page.evaluate(storageKey => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  }, key);
}

async function progress(page) {
  return storedJson(page, progressKey);
}

async function progressFor(page, bookId) {
  return storedJson(page, `sg-progress:${bookId}`);
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

async function waitForReaderBook(page, bookId) {
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#bookTitle')).toHaveText('Moonlit Reader Fixture');
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect.poll(async () => String((await progressFor(page, bookId))?.cfi || ''), { timeout: 12_000 }).toContain('epubcfi');
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

async function seedFinished(page, bookId) {
  await page.evaluate(id => {
    let state = {};
    try { state = JSON.parse(localStorage.getItem('sg-finished-books') || '{}') || {}; } catch {}
    const stamp = Date.now();
    state[id] = stamp;
    localStorage.setItem('sg-finished-books', JSON.stringify(state));
    localStorage.setItem(`sg-finished:${id}`, '1');
    localStorage.setItem(`sg-progress:${id}`, JSON.stringify({ file: id, percentage: 0.94, page: 9, totalPages: 10, updatedAt: stamp }));
  }, bookId);
}

async function expectAtBeginning(page, bookId) {
  await expect.poll(async () => {
    const saved = await progressFor(page, bookId);
    const mappedPage = Number(saved?.page);
    const percentage = Number(saved?.percentage);
    return (Number.isFinite(mappedPage) && mappedPage <= 1) || (Number.isFinite(percentage) && percentage <= 0.01);
  }, { timeout: 12_000 }).toBe(true);
}

// The shared Read Again dialog must render with the same public Library presentation at every
// entry point. Reader pages load the shared volume-actions stylesheet and pin the effective
// public palette tokens (nav.css :root values) on the dialog element because Reader interface
// themes re-skin --text/--muted/--line per theme; these computed-style assertions fail if
// either half of that contract regresses. Both call sites must stay identical.
async function expectLibraryDialogPresentation(page) {
  const styles = await page.evaluate(() => {
    const dialog = document.getElementById('readAgainDialog');
    const cs = getComputedStyle(dialog);
    const h2 = getComputedStyle(dialog.querySelector('.read-again-card h2'));
    const copy = getComputedStyle(dialog.querySelector('.read-again-copy'));
    return { color: cs.color, background: cs.backgroundColor, radius: cs.borderRadius, copyColor: copy.color, h2Font: h2.fontFamily, h2Size: h2.fontSize };
  });
  expect(styles.background).toBe('rgb(13, 11, 18)');
  expect(styles.color).toBe('rgb(240, 237, 245)'); // effective public --text #f0edf5
  expect(styles.copyColor).toBe('rgb(170, 162, 181)'); // effective public --muted #aaa2b5
  expect(styles.radius).toBe('16px');
  expect(styles.h2Font).toContain('Georgia');
  expect(styles.h2Size).toBe('24.8px'); // 1.55rem serif heading, proving --serif resolves
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
  await expectLibraryDialogPresentation(page);
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

test('#162 completion pages keep live series context across pre-mounted clones', async ({ page, browserDiagnostics }) => {
  await page.addInitScript(() => {
    const install = () => {
      const source = document.getElementById('volumeEndPage');
      const host = document.getElementById('viewerShell');
      if (!source || !host || host.querySelector('[data-e2e-stale-completion]')) return false;
      const clone = source.cloneNode(true);
      clone.removeAttribute('id');
      clone.removeAttribute('aria-labelledby');
      clone.removeAttribute('aria-describedby');
      clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      clone.classList.remove('hidden', 'active');
      clone.classList.add('continuous-end', 'volume-end-page-continuous');
      clone.dataset.e2eStaleCompletion = '1';
      host.appendChild(clone);
      return true;
    };
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document, { childList: true, subtree: true });
    install();
  });

  await page.goto(`/reader.html?book=${FIRST_BOOK_ID}&series=${MULTI_SERIES_ID}`);
  await waitForReaderBook(page, FIRST_BOOK_ID);

  const clone = page.locator('[data-e2e-stale-completion]');
  await expect(clone).toHaveCount(1);
  await expect(clone.locator('.volume-complete-card h2 span')).toHaveText(FIRST_TITLE);
  await expect(clone.locator('.volume-complete-return')).toHaveAttribute('href', MULTI_SERIES_URL);
  await expect(clone.locator('.volume-complete-next')).toHaveText(`Read ${SECOND_TITLE} ▶`);

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('#162 finished-next and last-volume actions restart from the beginning', async ({ page, browserDiagnostics }) => {
  await page.goto(MULTI_SERIES_URL);
  await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy', 'false', { timeout: 12_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'The Extremely Long Archive Title That Exercises Wrapping, Search, Sorting, and Metadata Boundaries Across Shadow Garden' })).toBeVisible();

  await seedFinished(page, SECOND_BOOK_ID);
  await page.goto(`/reader.html?book=${FIRST_BOOK_ID}&series=${MULTI_SERIES_ID}`);
  await waitForReaderBook(page, FIRST_BOOK_ID);
  await showPaginatedEndPage(page);

  await expect(page.locator('#volumeCompleteTitle')).toHaveText(FIRST_TITLE);
  await expect(page.locator('#completeReturnLink')).toHaveAttribute('href', MULTI_SERIES_URL);
  await expect(page.locator('#nextVolumeLink')).toHaveText(`Read ${SECOND_TITLE} ▶`);
  await page.locator('#nextVolumeLink').click();

  const nextDialog = page.locator('#readAgainDialog');
  await expect(nextDialog).toBeVisible();
  await expect(nextDialog.locator('[data-read-again-title]')).toHaveText(SECOND_TITLE);
  await expectLibraryDialogPresentation(page);
  await page.getByRole('button', { name: 'Begin Again' }).click();
  await expect(page).toHaveURL(new RegExp(`/reader\\.html\\?book=${SECOND_BOOK_ID}.*restart=1`));
  await waitForReaderBook(page, SECOND_BOOK_ID);
  await expect.poll(() => page.evaluate(id => localStorage.getItem(`sg-finished:${id}`), SECOND_BOOK_ID)).toBeNull();
  await expectAtBeginning(page, SECOND_BOOK_ID);

  await seedFinished(page, FIRST_BOOK_ID);
  await page.goto(`/reader.html?book=${LAST_BOOK_ID}&series=${MULTI_SERIES_ID}`);
  await waitForReaderBook(page, LAST_BOOK_ID);
  await showPaginatedEndPage(page);

  await expect(page.locator('#volumeCompleteTitle')).toHaveText(LAST_TITLE);
  await expect(page.locator('#volumeCompleteDetail')).toContainText('last volume');
  await expect(page.locator('#nextVolumeLink')).toBeVisible();
  await expect(page.locator('#nextVolumeLink')).toHaveText('Begin the series again ↺');
  await expect(page.locator('#completeReturnLink')).toHaveAttribute('href', MULTI_SERIES_URL);
  await page.locator('#nextVolumeLink').click();

  const restartDialog = page.locator('#readAgainDialog');
  await expect(restartDialog).toBeVisible();
  await expect(restartDialog.locator('[data-read-again-title]')).toHaveText(FIRST_TITLE);
  await page.getByRole('button', { name: 'Begin Again' }).click();
  await expect(page).toHaveURL(new RegExp(`/reader\\.html\\?book=${FIRST_BOOK_ID}.*restart=1`));
  await waitForReaderBook(page, FIRST_BOOK_ID);
  await expect.poll(() => page.evaluate(id => localStorage.getItem(`sg-finished:${id}`), FIRST_BOOK_ID)).toBeNull();
  await expectAtBeginning(page, FIRST_BOOK_ID);

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
