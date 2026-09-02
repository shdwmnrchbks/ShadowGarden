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

async function visibleLargeChapterMarker(page) {
  return page.locator('#viewer iframe').evaluateAll(frames => {
    const container = document.querySelector('#viewer .epub-container');
    const frame = frames.find(node => /Large Chapter/.test(node.contentDocument?.body?.textContent || ''));
    if (!container || !frame?.contentDocument) return '';
    const containerRect = container.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const targetY = containerRect.top + Math.min(container.clientHeight * 0.3, Math.max(1, container.clientHeight - 1));
    const candidates = [...frame.contentDocument.querySelectorAll('p')]
      .map(node => {
        const rect = node.getBoundingClientRect();
        const top = frameRect.top + rect.top;
        const bottom = frameRect.top + rect.bottom;
        const distance = targetY < top ? top - targetY : targetY > bottom ? targetY - bottom : 0;
        return { node, distance };
      })
      .filter(entry => String(entry.node.textContent || '').trim())
      .sort((a, b) => a.distance - b.distance);
    return String(candidates[0]?.node?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  });
}

function fixtureParagraphNumber(marker) {
  const match = String(marker || '').match(/Large chapter paragraph\s+(\d+)/i);
  return Number(match?.[1] || 0);
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

test('v2.8 resume: mobile orientation change keeps the same semantic anchor', async ({ page, browserDiagnostics }, testInfo) => {
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
  await expect.poll(async () => String((await storedProgress(page))?.cfi || ''), { timeout: 12_000 }).toBe(before.cfi);

  const after = await storedProgress(page);
  expect(after?.cfi).toBe(before.cfi);
  expect(after?.chapter).toBe('Large Chapter');
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

  /* Continuous buffering can prepend/repair neighboring views after navigation. Let that
     settle before choosing the lifecycle anchor so this test measures pageshow recovery,
     not the independent background-buffer anchor repair. */
  await page.waitForTimeout(1_800);
  const positioned = await scrollIntoLargeChapter(page);
  expect(positioned).not.toBeNull();
  expect(Number(positioned?.scrollTop || 0)).toBeGreaterThan(0);
  await page.waitForTimeout(500);

  const beforeMarker = await visibleLargeChapterMarker(page);
  expect(beforeMarker.length).toBeGreaterThan(8);
  expect(fixtureParagraphNumber(beforeMarker)).toBeGreaterThan(10);
  await page.waitForTimeout(350);
  expect(await visibleLargeChapterMarker(page)).toBe(beforeMarker);
  await expect(page.locator('#chapterTitle')).toHaveText('Large Chapter');

  /* A persisted pageshow is paired with a persisted pagehide in the real BFCache lifecycle.
     pagehide also gives the resume controller a final semantic capture before suspension. */
  await page.evaluate(() => {
    const transition = type => typeof PageTransitionEvent === 'function'
      ? new PageTransitionEvent(type, { persisted: true })
      : new Event(type);
    window.dispatchEvent(transition('pagehide'));
    window.dispatchEvent(transition('pageshow'));
  });
  await expect(page.locator('#chapterTitle')).toHaveText('Large Chapter', { timeout: 10_000 });
  await expect.poll(() => visibleLargeChapterMarker(page), { timeout: 12_000 }).toBe(beforeMarker);

  const after = await storedProgress(page);
  expect(after?.cfi).toBeTruthy();
  expect(after?.chapter).toBe('Large Chapter');
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});