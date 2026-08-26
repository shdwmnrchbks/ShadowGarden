import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;
const progressKey = `sg-progress:${READER_BOOK_ID}`;

async function currentCfi(page) {
  return page.evaluate(key => {
    try { return String(JSON.parse(localStorage.getItem(key) || 'null')?.cfi || ''); }
    catch { return ''; }
  }, progressKey);
}

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect(page.locator('body')).toHaveClass(/reader-flow-paginated/);
  await expect.poll(() => currentCfi(page), { timeout: 12_000 }).toContain('epubcfi');
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

function intersectBoxes(box, shellBox) {
  if (!box || !shellBox) return null;
  const left = Math.max(box.x, shellBox.x);
  const top = Math.max(box.y, shellBox.y);
  const right = Math.min(box.x + box.width, shellBox.x + shellBox.width);
  const bottom = Math.min(box.y + box.height, shellBox.y + shellBox.height);
  if (right - left <= 4 || bottom - top <= 4) return null;
  return { left, top, right, bottom };
}

async function trustedWheel(page, deltaY) {
  const [box, shellBox] = await Promise.all([
    page.locator('#viewer iframe').first().boundingBox(),
    page.locator('#viewerShell').boundingBox()
  ]);
  const visible = intersectBoxes(box, shellBox);
  if (!visible) throw new Error('Reader EPUB iframe does not intersect the visible Reader viewport');
  await page.mouse.move((visible.left + visible.right) / 2, (visible.top + visible.bottom) / 2);
  await page.mouse.wheel(0, deltaY);
}

async function dispatchReaderSwipe(page, { startX = 260, endX = 90, y = 220 } = {}) {
  return page.locator('#viewer iframe').first().evaluate((frame, values) => {
    const doc = frame.contentDocument;
    const target = doc?.body || doc?.documentElement;
    if (!doc || !target) return null;
    const event = (type, x) => {
      const value = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(value, 'touches', { value: type === 'touchend' ? [] : [{ screenX: x, screenY: values.y }], configurable: true });
      Object.defineProperty(value, 'changedTouches', { value: [{ screenX: x, screenY: values.y }], configurable: true });
      return value;
    };
    const start = event('touchstart', values.startX);
    target.dispatchEvent(start);
    const end = event('touchend', values.endX);
    const accepted = target.dispatchEvent(end);
    return { accepted, defaultPrevented: end.defaultPrevented };
  }, { startX, endX, y });
}

test('Pages controls and TOC navigate everywhere while desktop keyboard and supported trusted wheel turn the live rendition', async ({ page, browserDiagnostics }, testInfo) => {
  await waitForReader(page);
  const mobile = testInfo.project.name.includes('mobile');
  const webkit = testInfo.project.name.includes('webkit');

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

  if (!mobile) {
    await page.keyboard.press('ArrowRight');
    const afterKeyboardNext = await expectCfiChange(page, chapterOne);
    await page.keyboard.press('ArrowLeft');
    await expectCfiChange(page, afterKeyboardNext);

    // Playwright's WebKit driver does not deliver trusted wheel input across this sandboxed
    // EPUB iframe boundary. Chromium and Firefox therefore exercise the trusted wheel path;
    // WebKit still exercises controls, TOC, keyboard, and the source-level child-window owner.
    if (!webkit) {
      const beforeWheel = await currentCfi(page);
      await trustedWheel(page, 120);
      await expectCfiChange(page, beforeWheel);
    }
  }

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('visual-only, legacy-structure, and large chapters remain readable through the same live rendition', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);

  for (const chapter of ['Visual Plate', 'Legacy Structure', 'Large Chapter']) {
    await page.locator('#tocToggle').click();
    await expect(page.locator('#tocDrawer')).toHaveClass(/open/);
    await page.getByRole('button', { name: chapter, exact: true }).click();
    await expect(page.locator('#tocDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#chapterTitle')).toHaveText(chapter, { timeout: 10_000 });
    await expect.poll(() => currentCfi(page), { timeout: 10_000 }).toContain('epubcfi');
  }

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('mobile Pages swipe turns the live rendition without becoming a Continuous-mode owner', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'touch-capable mobile-project regression');
  await waitForReader(page);

  const beforeSwipe = await currentCfi(page);
  const swipe = await dispatchReaderSwipe(page);
  expect(swipe).toEqual({ accepted: false, defaultPrevented: true });
  await expectCfiChange(page, beforeSwipe, 8_000);

  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 12_000 });
  const continuousBefore = await currentCfi(page);
  const continuousSwipe = await dispatchReaderSwipe(page);
  expect(continuousSwipe).toEqual({ accepted: true, defaultPrevented: false });
  await page.waitForTimeout(300);
  expect(await currentCfi(page)).toBe(continuousBefore);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('fullscreen control mirrors fullscreenchange state through the Reader accessibility bridge', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'fullscreen control is intentionally hidden on mobile');
  await page.addInitScript(() => {
    let fullscreenElement = null;
    try {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
      Element.prototype.requestFullscreen = function requestFullscreen() {
        fullscreenElement = this;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
      document.exitFullscreen = function exitFullscreen() {
        fullscreenElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
    } catch {}
  });
  await waitForReader(page);

  const button = page.locator('#fullscreenButton');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
