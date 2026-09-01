import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;

async function waitForReader(page) {
  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#viewer iframe')).toHaveCount(1);
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter One', { timeout: 10_000 });
}

async function frameWith(page, selector) {
  for (const frame of page.frames()) {
    if (await frame.locator(selector).count()) return frame;
  }
  throw new Error(`Reader frame containing ${selector} was not found`);
}

async function activateLink(page, selector) {
  const frame = await frameWith(page, selector);
  const link = frame.locator(selector);
  await link.evaluate(element => {
    element.focus();
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: element.ownerDocument.defaultView }));
  });
  return { frame, link };
}

test('explicit EPUB noterefs open sanitized Reader notes without moving the live passage', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  const dialog = page.locator('#readerNoteDialog');
  const heading = page.locator('#readerNoteHeading');
  const body = page.locator('#readerNoteBody');

  const same = await activateLink(page, '#same-note-ref');
  await expect(dialog).toBeVisible();
  await expect(heading).toHaveText('Footnote');
  await expect(body).toContainText('Same-page note text remains beside the current passage');
  await expect(body).toContainText('A second paragraph verifies that multi-paragraph footnotes remain readable.');
  await expect(body).not.toContainText('1 Same-page');
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter One');
  await expect(page.locator('#readerNoteClose')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => same.link.evaluate(element => element === element.ownerDocument.activeElement)).toBe(true);
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter One');

  const cross = await activateLink(page, '#cross-note-ref');
  await expect(dialog).toBeVisible();
  await expect(heading).toHaveText('Endnote');
  await expect(body).toContainText('Cross-document endnote text is loaded from a non-linear spine resource');
  await expect(body).not.toContainText('2 Cross-document');
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter One');

  await page.locator('#readerNoteClose').click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => cross.link.evaluate(element => element === element.ownerDocument.activeElement)).toBe(true);

  await activateLink(page, '#ordinary-internal-link');
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter Two', { timeout: 10_000 });
  await expect(dialog).not.toBeVisible();

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});

test('footnote overlay remains flow-neutral in Continuous reading', async ({ page, browserDiagnostics }) => {
  await waitForReader(page);
  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 15_000 });
  await page.locator('[data-close="settingsDrawer"]').click();

  await activateLink(page, '#same-note-ref');
  await expect(page.locator('#readerNoteDialog')).toBeVisible();
  await expect(page.locator('#readerNoteHeading')).toHaveText('Footnote');
  await expect(page.locator('#chapterTitle')).toHaveText('Chapter One');
  await page.locator('#readerNoteClose').click();
  await expect(page.locator('#readerNoteDialog')).not.toBeVisible();

  expect(browserDiagnostics.filter(entry => entry.type === 'pageerror')).toEqual([]);
});
