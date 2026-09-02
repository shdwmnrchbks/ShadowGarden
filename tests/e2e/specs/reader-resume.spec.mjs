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

function progressMoved(current, previous) {
  if (!current || !previous) return false;
  if (String(current.cfi || '') !== String(previous.cfi || '')) return true;
  if (Number(current.page || 0) !== Number(previous.page || 0)) return true;
  return Math.abs(Number(current.percentage || 0) - Number(previous.percentage || 0)) > 0.001;
}

async function waitForStoredChapter(page, chapter) {
  await expect.poll(async () => (await storedProgress(page))?.chapter || '', { timeout: 10_000 }).toBe(chapter);
  return storedProgress(page);
}

async function waitForProgressMove(page, previous) {
  await expect.poll(async () => progressMoved(await storedProgress(page), previous), { timeout: 10_000 }).toBe(true);
  return storedProgress(page);
}

async function scrollIntoLargeChapter(page) {
  return page.locator('#viewer iframe').evaluateAll(frames => {
    const container = document.querySelector('#viewer .epub-container');
    const frame = frames.find(node => /Large Chapter/.test(node.contentDocument?.body?.textContent || ''));
    if (!container || !frame) return null;
    const containerRect = container.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const inset = Math.max(80, Math.min(frameRect.height * 0.28, Math.max(80, frameRect.height - container.clientHeight * 0.65)));
    const next = Math.max(0, container.scrollTop + (frameRect.top - containerRect.top) + inset);
    container.scrollTop = Math.min(Math.max(0, container.scrollHeight - container.clientHeight), next);
    container.dispatchEvent(new Event('scroll'));
    return { scrollTop: container.scrollTop, max: Math.max(0, container.scrollHeight - container.clientHeight) };
  });
}

async function continuousScrollTop(page) {
  return page.locator('#viewer .epub-container').evaluate(node => Number(node.scrollTop || 0));
}

test('v2.8 resume: reload restores the same canonical reading place', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  await openChapter(page, 'Large Chapter');
  const chapterStart = await waitForStoredChapter(page, 'Large Chapter');
  await page.locator('#nextPage').click();
  const before = await waitForProgressMove(page, chapterStart);
  expect(before?.cfi).toBeTruthy();

  await page.reload();
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#chapterTitle')).toHaveText('Large Chapter', { timeout: 10_000 });
  await expect.poll(async () => String((await storedProgress(page))?.cfi || ''), { timeout: 15_000 }).toBe(before.cfi);
  const after = await storedProgress(page);

  expect(after?.cfi).toBe(before.cfi);
  if (Number(before?.page) > 0 && Number(after?.page) > 0 && Number(before?.totalPages) === Number(after?.totalPages)) {
    expect(Math.abs(Number(after.page) - Number(before.page))).toBeLessThanOrEqual(1);
  }
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('v2.8 resume: mobile orientation change reanchors instead of resetting progress', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile orientation regression');
  await waitForReader(page);
  await openChapter(page, 'Large Chapter');
  const chapterStart = await waitForStoredChapter(page, 'Large Chapter');
  await page.locator('#nextPage').click();
  const before = await waitForProgressMove(page, chapterStart);
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

test('v2.8 resume: Continuous pageshow keeps the visible Large Chapter passage', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 12_000 });
  await page.getByRole('button', { name: 'Close reading settings' }).click();
  await openChapter(page, 'Large Chapter');

  const scroller = page.locator('#viewer .epub-container');
  await expect(scroller).toBeVisible();
  const positioned = await scrollIntoLargeChapter(page);
  expect(positioned).not.toBeNull();
  expect(Number(positioned?.scrollTop || 0)).toBeGreaterThan(0);
  const beforeScroll = await continuousScrollTop(page);
  await expect(page.locator('#chapterTitle')).toHaveText('Large Chapter');

  await page.evaluate(() => {
    const event = typeof PageTransitionEvent === 'function'
      ? new PageTransitionEvent('pageshow', { persisted: true })
      : new Event('pageshow');
    window.dispatchEvent(event);
  });
  await expect(page.locator('#chapterTitle')).toHaveText('Large Chapter', { timeout: 10_000 });
  await expect.poll(async () => Math.abs((await continuousScrollTop(page)) - beforeScroll), { timeout: 12_000 }).toBeLessThanOrEqual(180);

  const after = await storedProgress(page);
  expect(after?.cfi).toBeTruthy();
  expect(after?.chapter).toBe('Large Chapter');
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
