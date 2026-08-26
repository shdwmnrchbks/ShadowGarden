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

async function readerTouchAction(page) {
  return page.locator('#viewer iframe').first().evaluate(frame => {
    const doc = frame.contentDocument;
    const win = doc?.defaultView;
    const target = doc?.body || doc?.documentElement;
    if (!doc || !win || !target) return '';
    try { return String(win.getComputedStyle(target).touchAction || ''); }
    catch { return String(target.style?.touchAction || ''); }
  });
}

async function dispatchReaderSwipe(page, { startX = 260, endX = 90, y = 220 } = {}) {
  return page.locator('#viewer iframe').first().evaluate((frame, values) => {
    const doc = frame.contentDocument;
    const win = doc?.defaultView;
    const target = doc?.body || doc?.documentElement;
    if (!doc || !win || !target) return null;

    const installed = doc.documentElement?.dataset.sgReaderPageInput === '1';
    const inputMode = doc.documentElement?.dataset.sgReaderSwipeInput || 'unknown';

    if (inputMode === 'pointer') {
      const event = (type, x) => {
        // WebKit's synthetic PointerEvent constructor can normalize touch-pointer coordinates
        // to zero. Use a same-realm generic event so Reader receives the exact gesture data
        // while the real pointer listeners and page-turn controller remain under test.
        const value = new win.Event(type, { bubbles: true, cancelable: true });
        for (const [key, fieldValue] of Object.entries({
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x,
          clientY: values.y,
          screenX: x,
          screenY: values.y
        })) Object.defineProperty(value, key, { value: fieldValue, configurable: true });
        return value;
      };
      target.dispatchEvent(event('pointerdown', values.startX));
      const end = event('pointerup', values.endX);
      const dispatchAccepted = target.dispatchEvent(end);
      return {
        installed,
        inputMode,
        accepted: end.defaultPrevented ? false : dispatchAccepted,
        defaultPrevented: end.defaultPrevented
      };
    }

    const touch = x => ({
      identifier: 1,
      target,
      screenX: x,
      screenY: values.y,
      clientX: x,
      clientY: values.y,
      pageX: x,
      pageY: values.y
    });
    const event = (type, x) => {
      const point = touch(x);
      const value = new win.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(value, 'touches', {
        value: type === 'touchend' ? [] : [point],
        configurable: true
      });
      Object.defineProperty(value, 'targetTouches', {
        value: type === 'touchend' ? [] : [point],
        configurable: true
      });
      Object.defineProperty(value, 'changedTouches', { value: [point], configurable: true });
      return value;
    };
    target.dispatchEvent(event('touchstart', values.startX));
    const end = event('touchend', values.endX);
    const dispatchAccepted = target.dispatchEvent(end);
    return {
      installed,
      inputMode,
      accepted: end.defaultPrevented ? false : dispatchAccepted,
      defaultPrevented: end.defaultPrevented
    };
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

  await expect.poll(() => readerTouchAction(page), { timeout: 8_000 }).toContain('pan-y');
  expect(await readerTouchAction(page)).toContain('pinch-zoom');

  const beforeSwipe = await currentCfi(page);
  const swipe = await dispatchReaderSwipe(page);
  expect(swipe?.installed).toBe(true);
  expect(['pointer', 'touch']).toContain(swipe?.inputMode);
  if (swipe?.inputMode === 'touch') {
    expect(swipe.accepted).toBe(false);
    expect(swipe.defaultPrevented).toBe(true);
  }
  await expectCfiChange(page, beforeSwipe, 8_000);

  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 12_000 });
  await expect.poll(() => readerTouchAction(page), { timeout: 8_000 }).toBe('auto');

  const continuousBefore = await currentCfi(page);
  const continuousSwipe = await dispatchReaderSwipe(page);
  expect(continuousSwipe?.installed).toBe(true);
  expect(['pointer', 'touch']).toContain(continuousSwipe?.inputMode);
  if (continuousSwipe?.inputMode === 'touch') {
    expect(continuousSwipe.accepted).toBe(true);
    expect(continuousSwipe.defaultPrevented).toBe(false);
  }
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
