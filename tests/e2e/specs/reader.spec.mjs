import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;
const progressKey = `sg-progress:${READER_BOOK_ID}`;
const bookmarkKey = `sg-bookmarks:${READER_BOOK_ID}`;

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#bookTitle')).toHaveText('Moonlit Reader Fixture');
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
}

async function clickRenderedCenter(page, locator) {
  const box = await locator.boundingBox();
  expect(box, 'EPUB image should expose a top-level rendered box').toBeTruthy();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function storedJson(page, key) {
  return page.evaluate(storageKey => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  }, key);
}

async function progress(page) {
  return storedJson(page, progressKey);
}

async function advanceUntilProgressChanges(page, previousUpdatedAt = 0) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.keyboard.press('ArrowRight');
    try {
      await expect.poll(async () => Number((await progress(page))?.updatedAt || 0), { timeout: 4_000 }).toBeGreaterThan(Number(previousUpdatedAt || 0));
      return;
    } catch {}
  }
  throw new Error('Reader progress did not advance after four page turns');
}

test('protected Reader session opens the deterministic EPUB in a real rendition', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);

  await expect(page.locator('body')).toHaveClass(/reader-flow-paginated/);
  await expect(page.locator('#chapterTitle')).toContainText('Chapter');
  const saved = await progress(page);
  expect(saved).toBeTruthy();
  expect(saved.file).toBe(READER_BOOK_ID);
  expect(String(saved.cfi || '')).toContain('epubcfi');
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('Pages progress and bookmark persist through a full Reader reload', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'desktop keyboard/Page-controls regression; mobile input follows in the Reader gesture slice');
  await waitForReader(page);

  const before = await progress(page);
  await advanceUntilProgressChanges(page, before?.updatedAt);
  const advanced = await progress(page);
  expect(Number(advanced?.updatedAt || 0)).toBeGreaterThan(Number(before?.updatedAt || 0));
  expect(String(advanced?.cfi || '')).toContain('epubcfi');

  await page.locator('#bookmarkButton').click();
  await expect(page.locator('#bookmarkButton')).toHaveAttribute('aria-pressed', 'true');
  const bookmarksBeforeReload = await storedJson(page, bookmarkKey);
  expect(bookmarksBeforeReload).toHaveLength(1);
  const bookmarkedCfi = bookmarksBeforeReload[0].cfi;

  await page.reload();
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  // Bookmark identity is anchored to the restored EPUB CFI. Device Page Map generation is
  // deliberately asynchronous and must not gate browser-local bookmark restoration.
  await expect.poll(async () => String((await progress(page))?.cfi || ''), { timeout: 15_000 }).toBe(bookmarkedCfi);
  await expect(page.locator('#bookmarkButton')).toHaveAttribute('aria-pressed', 'true');
  const bookmarksAfterReload = await storedJson(page, bookmarkKey);
  expect(bookmarksAfterReload).toHaveLength(1);
  expect(bookmarksAfterReload[0].cfi).toBe(bookmarkedCfi);
  const restored = await progress(page);
  expect(restored?.cfi).toBe(bookmarkedCfi);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('flow switching, image focus, and resize preserve a usable Reader location', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);

  const initial = await progress(page);
  const iframe = page.frameLocator('#viewer iframe');
  const illustration = iframe.getByRole('img', { name: 'A moonlit geometric garden used to test image focus' });
  await expect(illustration).toBeVisible();
  // The coordinate click follows the native top-level pointer path. On WebKit the Reader
  // supplies a parent-owned transparent image hit target because callbacks inside the
  // intentionally scriptless EPUB sandbox are blocked by the engine.
  await clickRenderedCenter(page, illustration);
  await expect(page.locator('#imageFocus')).not.toHaveClass(/hidden/);
  await expect(page.locator('#imageFocus')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#imageFocusClose').click();
  await expect(page.locator('#imageFocus')).toHaveClass(/hidden/);

  await page.locator('#settingsToggle').click();
  await expect(page.locator('#settingsDrawer')).toHaveClass(/open/);
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 12_000 });
  await expect.poll(async () => page.locator('#viewer iframe').count(), { timeout: 12_000 }).toBeGreaterThan(0);

  const continuous = await progress(page);
  expect(String(continuous?.cfi || '')).toContain('epubcfi');
  if (Number.isFinite(Number(initial?.percentage)) && Number.isFinite(Number(continuous?.percentage))) {
    expect(Math.abs(Number(continuous.percentage) - Number(initial.percentage))).toBeLessThan(0.25);
  }

  await page.locator('#flowSelect').selectOption('paginated');
  await expect(page.locator('body')).toHaveClass(/reader-flow-paginated/, { timeout: 12_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  const beforeResize = await progress(page);
  await page.setViewportSize({ width: 900, height: 620 });
  await page.waitForTimeout(450);
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  const afterResize = await progress(page);
  expect(String(afterResize?.cfi || '')).toContain('epubcfi');
  expect(String(beforeResize?.cfi || '')).toContain('epubcfi');
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});