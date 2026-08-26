import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';

test('deterministic entrypoint shells are complete before deferred hydration runs', async ({ page }) => {
  // Freeze the application at first paint. Inline route/theme guards still run, while every
  // deferred/external JavaScript owner is prevented from repairing text, adding controls, or
  // appending presentation styles after the document becomes visible.
  await page.route('**/*.js*', route => route.abort());

  await page.goto('/');
  await expect(page.locator('.intro-copy')).toHaveText('A moonlit archive of stories, cultivated beneath quiet shadows.');
  await expect(page.locator('.search-hint')).toContainText('Follow any thread—title, author, tag, or volume.');
  await expect(page.locator('#translatorSelect')).toHaveCount(1);
  await expect(page.locator('#genreSelect')).toHaveCount(1);
  await expect(page.locator('#readingStatusChips')).toHaveCount(1);

  await page.goto('/nsfw.html');
  await expect(page.locator('#adultGate')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/adult-locked/);
  await expect(page.locator('.adult-intro .intro-copy')).toHaveText('A secluded wing for mature works, sheltered beyond the main Garden.');
  await expect(page.locator('#translatorSelect')).toHaveCount(1);
  await expect(page.locator('#genreSelect')).toHaveCount(1);
  await expect(page.locator('#readingStatusChips')).toHaveCount(1);

  // Acknowledged visitors should receive the inverse state synchronously too: no gate flash and
  // no transient body lock while the deferred Library controller is unavailable.
  await page.evaluate(() => localStorage.setItem('sg-adult-ack', '1'));
  await page.reload();
  await expect(page.locator('#adultGate')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/adult-locked/);

  await page.goto(`/series.html?id=${encodeURIComponent(READER_SERIES_ID)}`);
  await expect(page.locator('.series-loading-status')).toHaveText('Preparing this series and its volumes…');

  await page.goto(`/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`);
  await expect(page.locator('#bookTitle')).toHaveText('Opening the volume…');
  await expect(page.locator('#readerLoading p')).toHaveText('Authorizing the book…');
  await expect(page.locator('#volumeCompleteDetail')).toHaveText('This volume rests complete. Another path waits beyond its final page.');

  await page.goto('/admin.html');
  await expect(page.locator('#authCard .kicker')).toHaveText("KEEPER'S GATE");
  await expect(page.locator('#authCard .auth-copy')).toHaveText("The Keeper's gate is sealed. Present your key before tending the shelves.");
  await expect(page.locator('#adminToken')).toHaveAttribute('placeholder', 'Keeper token');
  await expect(page.locator('#unlockButton')).toHaveText("Open the Keeper's Gate");
  for (const stylesheet of ['motion.css', 'admin-components.css', 'admin-version.css', 'admin-presentation.css', 'admin-motion.css']) {
    await expect(page.locator(`head link[rel="stylesheet"][href="/assets/css/${stylesheet}"]`)).toHaveCount(1);
  }

  await page.goto('/404.html');
  await expect(page.locator('.not-found h1')).toHaveText('The path fades into shadow.');
  await expect(page.locator('.not-found p')).toHaveText('No shelf, gate, or footpath answers this address.');
});
