import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
}

async function openChapter(page, name) {
  await page.locator('#tocToggle').click();
  await expect(page.locator('#tocDrawer')).toHaveClass(/open/);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.locator('#tocDrawer')).not.toHaveClass(/open/);
  await expect(page.locator('#chapterTitle')).toHaveText(name, { timeout: 10_000 });
}

async function storedProgress(page) {
  return page.evaluate(bookId => {
    try { return JSON.parse(localStorage.getItem(`sg-progress:${bookId}`) || 'null'); }
    catch { return null; }
  }, READER_BOOK_ID);
}

async function waitForStoredChapter(page, chapter) {
  await expect.poll(async () => (await storedProgress(page))?.chapter || '', { timeout: 10_000 }).toBe(chapter);
  return storedProgress(page);
}

test('v2.8 resume: reload restores the same canonical reading place', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  await openChapter(page, 'Large Chapter');
  await page.locator('#nextPage').click();
  const before = await waitForStoredChapter(page, 'Large Chapter');
  expect(before?.cfi).toBeTruthy();

  await page.reload();
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#chapterTitle')).toHaveText('Large Chapter', { timeout: 10_000 });
  const after = await waitForStoredChapter(page, 'Large Chapter');

  expect(after?.cfi).toBeTruthy();
  expect(Math.abs(Number(after?.percentage || 0) - Number(before?.percentage || 0))).toBeLessThanOrEqual(0.04);
  if (Number(before?.page) > 0 && Number(after?.page) > 0) {
    expect(Math.abs(Number(after.page) - Number(before.page))).toBeLessThanOrEqual(1);
  }
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('v2.8 resume: mobile orientation change reanchors instead of resetting progress', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile orientation regression');
  await waitForReader(page);
  await openChapter(page, 'Large Chapter');
  await page.locator('#nextPage').click();
  const before = await waitForStoredChapter(page, 'Large Chapter');
  expect(before?.cfi).toBeTruthy();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expect(page.locator('#chapterTitle')).toHaveText('Large Chapter', { timeout: 10_000 });
  await expect.poll(async () => {
    const current = await storedProgress(page);
    return Math.abs(Number(current?.percentage || 0) - Number(before?.percentage || 0));
  }, { timeout: 12_000 }).toBeLessThanOrEqual(0.05);

  const after = await storedProgress(page);
  expect(after?.cfi).toBeTruthy();
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('v2.8 resume: Continuous pageshow keeps the saved section and fractional position', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 12_000 });
  await page.getByRole('button', { name: 'Close reading settings' }).click();
  await openChapter(page, 'Large Chapter');

  const scroller = page.locator('#viewer .epub-container');
  await expect(scroller).toBeVisible();
  await scroller.evaluate(node => {
    const max = Math.max(0, node.scrollHeight - node.clientHeight);
    node.scrollTop = Math.min(max, Math.max(120, Math.round(max * 0.32)));
    node.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(250);
  const before = await waitForStoredChapter(page, 'Large Chapter');
  expect(before?.cfi).toBeTruthy();

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('#chapterTitle')).toHaveText('Large Chapter', { timeout: 10_000 });
  await expect.poll(async () => {
    const current = await storedProgress(page);
    return Math.abs(Number(current?.percentage || 0) - Number(before?.percentage || 0));
  }, { timeout: 12_000 }).toBeLessThanOrEqual(0.05);

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
