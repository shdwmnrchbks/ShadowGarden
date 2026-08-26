import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;
const progressKey = `sg-progress:${READER_BOOK_ID}`;

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect(page.locator('body')).toHaveClass(/reader-flow-paginated/);
}

async function currentCfi(page) {
  return page.evaluate(key => {
    try { return String(JSON.parse(localStorage.getItem(key) || 'null')?.cfi || ''); }
    catch { return ''; }
  }, progressKey);
}

async function expectCfiChange(page, previous, timeout = 6_000) {
  await expect.poll(() => currentCfi(page), { timeout }).not.toBe(String(previous || ''));
  return currentCfi(page);
}

async function clickVisibleControl(page, selectors) {
  for (const selector of selectors) {
    const control = page.locator(selector);
    if (await control.isVisible()) {
      await control.click();
      return selector;
    }
  }
  throw new Error(`No visible Reader page control found: ${selectors.join(', ')}`);
}

async function dispatchSwipe(page, { fromX, toX, y = 260 }) {
  return page.locator('#viewer iframe').first().evaluate((frame, points) => {
    const doc = frame.contentDocument;
    const target = doc?.body || doc?.documentElement;
    if (!doc || !target) return null;
    const touchEvent = (type, x) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touch = { screenX: x, screenY: points.y, clientX: x, clientY: points.y };
      Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [touch], configurable: true });
      Object.defineProperty(event, 'changedTouches', { value: [touch], configurable: true });
      return event;
    };
    target.dispatchEvent(touchEvent('touchstart', points.fromX));
    const end = touchEvent('touchend', points.toX);
    const accepted = target.dispatchEvent(end);
    return { accepted, defaultPrevented: end.defaultPrevented };
  }, { fromX, toX, y });
}

async function dispatchWheel(page, deltaY) {
  return page.locator('#viewer iframe').first().evaluate((frame, delta) => {
    const doc = frame.contentDocument;
    const target = doc?.body || doc?.documentElement;
    if (!doc || !target) return null;
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: delta, deltaMode: 0 });
    const accepted = target.dispatchEvent(event);
    return { accepted, defaultPrevented: event.defaultPrevented };
  }, deltaY);
}

test('Pages next/previous, TOC, and project-appropriate gesture inputs navigate the live rendition', async ({ page, browserDiagnostics }, testInfo) => {
  await waitForReader(page);
  const mobile = testInfo.project.name.includes('mobile');

  const initial = await currentCfi(page);
  expect(initial).toContain('epubcfi');

  await clickVisibleControl(page, ['#nextPage', '#nextBottom']);
  const afterNext = await expectCfiChange(page, initial);
  expect(afterNext).toContain('epubcfi');

  await clickVisibleControl(page, ['#prevPage', '#prevBottom']);
  const afterPrevious = await expectCfiChange(page, afterNext);
  expect(afterPrevious).toContain('epubcfi');

  await page.locator('#tocToggle').click();
  await expect(page.locator('#tocDrawer')).toHaveClass(/open/);
  await page.getByRole('button', { name: 'Chapter Two', exact: true }).click();
  await expect(page.locator('#tocDrawer')).not.toHaveClass(/open/);
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter Two', { timeout: 8_000 });
  const chapterTwo = await currentCfi(page);
  expect(chapterTwo).toContain('epubcfi');

  await page.locator('#tocToggle').click();
  await page.getByRole('button', { name: 'Chapter One', exact: true }).click();
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter One', { timeout: 8_000 });
  const chapterOne = await currentCfi(page);
  expect(chapterOne).toContain('epubcfi');
  expect(chapterOne).not.toBe(chapterTwo);

  if (mobile) {
    const swipeNext = await dispatchSwipe(page, { fromX: 310, toX: 210 });
    expect(swipeNext?.accepted).toBe(false);
    expect(swipeNext?.defaultPrevented).toBe(true);
    const afterSwipeNext = await expectCfiChange(page, chapterOne);

    const swipePrevious = await dispatchSwipe(page, { fromX: 210, toX: 310 });
    expect(swipePrevious?.accepted).toBe(false);
    expect(swipePrevious?.defaultPrevented).toBe(true);
    await expectCfiChange(page, afterSwipeNext);
  } else {
    await page.keyboard.press('ArrowRight');
    const afterKeyboardNext = await expectCfiChange(page, chapterOne);
    await page.keyboard.press('ArrowLeft');
    await expectCfiChange(page, afterKeyboardNext);

    const beforeWheel = await currentCfi(page);
    const wheel = await dispatchWheel(page, 120);
    expect(wheel?.accepted).toBe(false);
    expect(wheel?.defaultPrevented).toBe(true);
    await expectCfiChange(page, beforeWheel);
  }

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
