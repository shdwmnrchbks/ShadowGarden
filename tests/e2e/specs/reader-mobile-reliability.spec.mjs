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

async function firstImageCenter(page) {
  const frame = page.locator('#viewer iframe').first();
  const frameBox = await frame.boundingBox();
  const imageBox = await frame.evaluate(node => {
    const image = node.contentDocument?.querySelector('img');
    if (!image) return null;
    const rect = image.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!frameBox || !imageBox || imageBox.width < 4 || imageBox.height < 4) return null;
  return { x: frameBox.x + imageBox.x + imageBox.width / 2, y: frameBox.y + imageBox.y + imageBox.height / 2 };
}

test('issue #154: mobile paginated content clears chrome and a single image tap opens focus', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile Reader regression');
  await waitForReader(page);

  const paddingTop = await page.locator('#viewer iframe').first().evaluate(frame => {
    const body = frame.contentDocument?.body;
    return body ? parseFloat(frame.contentWindow.getComputedStyle(body).paddingTop || '0') : 0;
  });
  expect(paddingTop).toBeGreaterThanOrEqual(54);

  await openChapter(page, 'Visual Plate');
  const center = await firstImageCenter(page);
  expect(center).not.toBeNull();
  await page.touchscreen.tap(center.x, center.y);
  await expect(page.locator('#imageFocus')).not.toHaveClass(/hidden/, { timeout: 4_000 });
  await page.locator('#imageFocusClose').click();
  await expect(page.locator('#imageFocus')).toHaveClass(/hidden/);

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('issue #154: Continuous keeps full artwork width and only upward scrolling reveals hidden chrome', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile Reader regression');
  await waitForReader(page);
  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 12_000 });
  await page.getByRole('button', { name: 'Close reading settings' }).click();

  const rail = await page.evaluate(() => {
    const viewer = document.getElementById('viewer');
    const seek = document.getElementById('continuousSeek');
    const viewerStyle = viewer ? getComputedStyle(viewer) : null;
    const seekStyle = seek ? getComputedStyle(seek) : null;
    return {
      viewerRight: viewerStyle?.right || '',
      seekWidth: parseFloat(seekStyle?.width || '0'),
      seekBackground: seekStyle?.backgroundColor || ''
    };
  });
  expect(rail.viewerRight).toBe('0px');
  expect(rail.seekWidth).toBeLessThanOrEqual(24);
  expect(rail.seekBackground).toBe('rgba(0, 0, 0, 0)');

  await openChapter(page, 'Large Chapter');
  await expect(page.locator('#viewer .epub-container')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/reader-chrome-hidden/, { timeout: 5_000 });

  const movedDown = await page.locator('#viewer .epub-container').evaluate(scroller => {
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const target = Math.min(max, Math.max(80, scroller.scrollTop + 120));
    scroller.scrollTop = target;
    scroller.dispatchEvent(new Event('scroll'));
    return scroller.scrollTop;
  });
  expect(movedDown).toBeGreaterThan(0);
  await page.waitForTimeout(120);
  await expect(page.locator('body')).toHaveClass(/reader-chrome-hidden/);

  await page.locator('#viewer .epub-container').evaluate(scroller => {
    scroller.scrollTop = Math.max(0, scroller.scrollTop - 80);
    scroller.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('body')).not.toHaveClass(/reader-chrome-hidden/, { timeout: 2_000 });

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
