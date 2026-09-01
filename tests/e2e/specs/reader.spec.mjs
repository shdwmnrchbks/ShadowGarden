import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;
const progressKey = `sg-progress:${READER_BOOK_ID}`;
const bookmarkKey = `sg-bookmarks:${READER_BOOK_ID}`;

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#bookTitle')).toHaveText('Moonlit Reader Fixture');
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect.poll(async () => String((await progress(page))?.cfi || ''), { timeout: 12_000 }).toContain('epubcfi');
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

function intersectBoxes(box, shellBox) {
  if (!box || !shellBox) return null;
  const left = Math.max(box.x, shellBox.x);
  const top = Math.max(box.y, shellBox.y);
  const right = Math.min(box.x + box.width, shellBox.x + shellBox.width);
  const bottom = Math.min(box.y + box.height, shellBox.y + shellBox.height);
  if (right - left <= 2 || bottom - top <= 2) return null;
  return { left, top, right, bottom };
}

async function revealAndClickRenderedCenter(page, locator) {
  const shell = page.locator('#viewerShell');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const [box, shellBox] = await Promise.all([locator.boundingBox(), shell.boundingBox()]);
    const visible = intersectBoxes(box, shellBox);
    if (visible) {
      await page.mouse.click((visible.left + visible.right) / 2, (visible.top + visible.bottom) / 2);
      return;
    }

    const before = await progress(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number((await progress(page))?.updatedAt || 0), { timeout: 4_000 })
      .toBeGreaterThan(Number(before?.updatedAt || 0));
  }
  throw new Error('EPUB illustration never entered the visible Reader viewport');
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

test('Reader typeface menu keeps Default publication-owned and applies the three named families', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  await page.locator('#settingsToggle').click();
  await expect(page.locator('#settingsDrawer')).toHaveClass(/open/);

  const fontSelect = page.locator('#fontSelect');
  await expect(fontSelect.locator('option')).toHaveText(['Default', 'Sans', 'Serif', 'Sans-Serif']);
  await expect(fontSelect).toHaveValue('default');

  const renderedTypeface = () => page.locator('#viewer iframe').first().evaluate(frame => {
    const doc = frame.contentDocument;
    const body = doc?.body;
    const win = frame.contentWindow;
    return {
      override: doc?.getElementById('sg-reader-typeface')?.textContent || '',
      family: body && win ? win.getComputedStyle(body).fontFamily : ''
    };
  });

  let rendered = await renderedTypeface();
  expect(rendered.override).toBe('');
  expect(rendered.family.toLowerCase()).toContain('serif');

  for (const [value, family] of [['pt-sans', 'PT Sans'], ['literata', 'Literata'], ['inter', 'Inter']]) {
    await fontSelect.selectOption(value);
    await expect.poll(async () => (await renderedTypeface()).override).toContain(family);
  }

  await fontSelect.selectOption('default');
  await expect.poll(async () => (await renderedTypeface()).override).toBe('');
  await expect.poll(async () => (await renderedTypeface()).family.toLowerCase()).toContain('serif');
  expect((await storedJson(page, 'sg-reader-settings'))?.font).toBe('default');
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('Reader progress summary combines canonical page, volume percentage, and chapter context', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  const progressText = page.locator('#progressText');
  const progressRange = page.locator('#progressRange');

  await expect.poll(async () => progressText.textContent(), { timeout: 20_000 })
    .toMatch(/^Page \d+\/\d+ · \d+% · Chapter/);
  await expect(progressText).toHaveAttribute('data-compact', /^\d+\/\d+ · \d+%$/);
  await expect(progressText).toHaveAttribute('data-rail', /^\d+\/\d+$/);
  await expect(progressRange).toHaveAttribute('aria-valuetext', /Chapter.+Page \d+ of \d+.+\d+% of volume/);

  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 12_000 });
  await expect.poll(async () => page.locator('#continuousSeek').getAttribute('aria-valuetext'), { timeout: 12_000 })
    .toMatch(/Chapter.+Page \d+ of \d+.+\d+% of volume/);
  await expect(page.locator('#continuousSeekText')).toHaveText(/^\d+\/\d+$/);
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

  const iframe = page.frameLocator('#viewer iframe');
  const illustration = iframe.getByRole('img', { name: 'A moonlit geometric garden used to test image focus' });
  await expect(illustration).toBeVisible();
  // EPUB.js lays paginated chapters out in a horizontally wide iframe. An image can therefore
  // be "visible" to Playwright inside the iframe while still being clipped off the Reader's
  // current page. Turn pages until the image intersects #viewerShell, then use a native
  // top-level pointer click. WebKit's sandbox-safe parent hit target receives that same click.
  await revealAndClickRenderedCenter(page, illustration);
  await expect(page.locator('#imageFocus')).not.toHaveClass(/hidden/);
  await expect(page.locator('#imageFocus')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#imageFocusClose').click();
  await expect(page.locator('#imageFocus')).toHaveClass(/hidden/);
  const initial = await progress(page);

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

test('Continuous mobile touch movement stays uncancelled and the rendition remains vertically scrollable', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'touch-capable mobile-project regression');
  await waitForReader(page);

  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 12_000 });
  await expect.poll(async () => page.locator('#viewer iframe').count(), { timeout: 12_000 }).toBeGreaterThan(0);

  const touch = await page.locator('#viewer iframe').first().evaluate(frame => {
    const doc = frame.contentDocument;
    const target = doc?.body || doc?.documentElement;
    if (!doc || !target) return null;
    const event = (type, y) => {
      const value = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(value, 'touches', { value: type === 'touchend' ? [] : [{ clientY: y, screenY: y }], configurable: true });
      Object.defineProperty(value, 'changedTouches', { value: [{ clientY: y, screenY: y }], configurable: true });
      return value;
    };
    target.dispatchEvent(event('touchstart', 260));
    const move = event('touchmove', 180);
    const accepted = target.dispatchEvent(move);
    target.dispatchEvent(event('touchend', 180));
    return { accepted, defaultPrevented: move.defaultPrevented, cancelable: move.cancelable };
  });
  expect(touch).toEqual({ accepted: true, defaultPrevented: false, cancelable: true });

  const scrollable = await page.locator('#viewer').evaluate(root => {
    const candidates = [root, ...root.querySelectorAll('*')];
    const element = candidates.find(node => node instanceof HTMLElement && node.scrollHeight > node.clientHeight + 8);
    if (!element) return null;
    const before = element.scrollTop;
    const target = Math.min(element.scrollHeight - element.clientHeight, before + 120);
    element.scrollTop = target;
    element.dispatchEvent(new Event('scroll', { bubbles: false }));
    return { before, after: element.scrollTop, max: element.scrollHeight - element.clientHeight };
  });
  expect(scrollable).not.toBeNull();
  expect(Number(scrollable?.max || 0)).toBeGreaterThan(8);
  expect(Number(scrollable?.after || 0)).toBeGreaterThan(Number(scrollable?.before || 0));
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('sleep-resume ticket renewal preserves the live Reader location', async ({ page, browserDiagnostics }) => {
  let accessRequests = 0;
  await page.route('**/book-access', async route => {
    if (route.request().method() === 'POST') accessRequests += 1;
    await route.fallback();
  });

  await waitForReader(page);
  const before = await progress(page);
  const beforeRequests = accessRequests;
  expect(beforeRequests).toBeGreaterThan(0);
  expect(String(before?.cfi || '')).toContain('epubcfi');

  // Advance only the synchronous cache clock during the resume event. The normal one-hour E2E
  // ticket therefore looks expired without making the test sleep or mutating Reader state.
  await page.evaluate(() => {
    const realNow = Date.now;
    const wakeAt = realNow() + (2 * 60 * 60 * 1000);
    Date.now = () => wakeAt;
    try { window.dispatchEvent(new Event('pageshow')); }
    finally { Date.now = realNow; }
  });

  await expect.poll(() => accessRequests, { timeout: 8_000 }).toBeGreaterThan(beforeRequests);
  await expect.poll(async () => String((await progress(page))?.cfi || ''), { timeout: 8_000 }).toBe(String(before?.cfi || ''));
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/);
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
