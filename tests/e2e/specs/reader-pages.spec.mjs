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

async function trustedWheel(page, deltaY) {
  const frame = page.locator('#viewer iframe').first();
  const box = await frame.boundingBox();
  if (!box) throw new Error('Reader EPUB iframe has no wheel target');
  await page.mouse.move(
    box.x + Math.min(box.width - 2, Math.max(2, box.width / 2)),
    box.y + Math.min(box.height - 2, Math.max(2, box.height / 2))
  );
  await page.mouse.wheel(0, deltaY);
}

test('Pages controls and TOC navigate everywhere while desktop keyboard and wheel turn the live rendition', async ({ page, browserDiagnostics }, testInfo) => {
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

  if (!mobile) {
    await page.keyboard.press('ArrowRight');
    const afterKeyboardNext = await expectCfiChange(page, chapterOne);
    await page.keyboard.press('ArrowLeft');
    await expectCfiChange(page, afterKeyboardNext);

    const beforeWheel = await currentCfi(page);
    await trustedWheel(page, 120);
    await expectCfiChange(page, beforeWheel);
  }

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
