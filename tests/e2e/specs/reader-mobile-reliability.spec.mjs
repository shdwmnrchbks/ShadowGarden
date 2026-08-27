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

async function oversizedImageGeometry(page) {
  return page.locator('#viewer iframe').evaluateAll(frames => {
    const seekLeft = document.getElementById('continuousSeek')?.getBoundingClientRect().left ?? null;
    const results = [];
    for (const frame of frames) {
      const publication = frame.contentDocument;
      const view = frame.contentWindow;
      if (!publication || !view) continue;
      for (const image of publication.querySelectorAll('.oversized-visual img, .oversized-div img, .min-width-canvas img')) {
        const rect = image.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        results.push({
          wrapper: image.closest('.oversized-div') ? 'div' : (image.closest('.min-width-canvas') ? 'canvas' : 'figure'),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          viewportWidth: view.innerWidth || publication.documentElement.clientWidth,
          pageLeft: frameRect.left + rect.left,
          pageRight: frameRect.left + rect.right,
          seekLeft
        });
      }
    }
    return results;
  });
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

test('issues #154/#157/#160: Continuous keeps mobile chrome, progress, images, and native scrolling reliable', async ({ page, browserDiagnostics }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile Reader regression');
  await waitForReader(page);
  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 12_000 });
  await page.getByRole('button', { name: 'Close reading settings' }).click();
  await expect(page.locator('body')).not.toHaveClass(/reader-chrome-hidden/);

  const rail = await page.evaluate(() => {
    const viewer = document.getElementById('viewer');
    const seek = document.getElementById('continuousSeek');
    const thumb = document.getElementById('continuousSeekThumb');
    const topbar = document.querySelector('.reader-topbar');
    const viewerStyle = viewer ? getComputedStyle(viewer) : null;
    const seekStyle = seek ? getComputedStyle(seek) : null;
    const seekRect = seek?.getBoundingClientRect();
    const thumbRect = thumb?.getBoundingClientRect();
    const topbarRect = topbar?.getBoundingClientRect();
    return {
      viewerRight: viewerStyle?.right || '',
      seekWidth: parseFloat(seekStyle?.width || '0'),
      seekBackground: seekStyle?.backgroundColor || '',
      seekLeft: seekRect?.left ?? -1,
      seekTop: seekRect?.top ?? -1,
      thumbTop: thumbRect?.top ?? -1,
      topbarBottom: topbarRect?.bottom ?? -1
    };
  });
  expect(rail.viewerRight).toBe('0px');
  expect(rail.seekWidth).toBeLessThanOrEqual(24);
  expect(rail.seekBackground).toBe('rgba(0, 0, 0, 0)');
  expect(rail.seekTop).toBeGreaterThanOrEqual(rail.topbarBottom - 1);
  expect(rail.thumbTop).toBeGreaterThanOrEqual(rail.topbarBottom - 1);

  await openChapter(page, 'Wide Visual');
  /* #160: both fixture shapes — a figure/picture wrapper and a bare publication div with
     fixed widths — must end before the transparent seek rail, not merely the viewport. */
  await expect.poll(async () => (await oversizedImageGeometry(page)).map(item => item.wrapper).sort().join('+'))
    .toBe('canvas+div+figure');
  const images = await oversizedImageGeometry(page);
  expect(images.find(item => item.seekLeft === null)).toBeUndefined();
  for (const image of images) {
    expect(image.width).toBeGreaterThan(20);
    expect(image.left).toBeGreaterThanOrEqual(-1);
    expect(image.right).toBeLessThanOrEqual(image.viewportWidth + 1);
    expect(image.pageLeft).toBeGreaterThanOrEqual(-1);
    expect(image.pageRight).toBeLessThanOrEqual(image.seekLeft + 1);
  }

  await openChapter(page, 'Large Chapter');
  await expect(page.locator('#viewer .epub-container')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/reader-chrome-hidden/, { timeout: 5_000 });

  const immersiveLayout = await page.evaluate(() => {
    const shell = document.getElementById('viewerShell')?.getBoundingClientRect();
    const topbar = document.querySelector('.reader-topbar');
    const seek = document.getElementById('continuousSeek')?.getBoundingClientRect();
    return {
      shellTop: shell?.top ?? 999,
      shellBottom: shell?.bottom ?? 0,
      viewportHeight: document.documentElement.clientHeight || window.innerHeight,
      topbarPosition: topbar ? getComputedStyle(topbar).position : '',
      seekTop: seek?.top ?? 999
    };
  });
  expect(Math.abs(immersiveLayout.shellTop)).toBeLessThanOrEqual(1.5);
  expect(immersiveLayout.shellBottom).toBeGreaterThanOrEqual(immersiveLayout.viewportHeight - 1.5);
  expect(immersiveLayout.topbarPosition).toBe('fixed');
  expect(Math.abs(immersiveLayout.seekTop)).toBeLessThanOrEqual(1.5);

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

  const restoredRail = await page.evaluate(() => ({
    seekTop: document.getElementById('continuousSeek')?.getBoundingClientRect().top ?? -1,
    topbarBottom: document.querySelector('.reader-topbar')?.getBoundingClientRect().bottom ?? -1
  }));
  expect(restoredRail.seekTop).toBeGreaterThanOrEqual(restoredRail.topbarBottom - 1);

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
