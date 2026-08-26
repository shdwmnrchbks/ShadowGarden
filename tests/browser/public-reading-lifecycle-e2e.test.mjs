import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('v2.6 public reading lifecycle remains a real-browser route and state contract', async () => {
  const [spec, actions, completion, readingState] = await Promise.all([
    read('tests/e2e/specs/public-reading-lifecycle.spec.mjs'),
    read('src/assets/js/public/volume-actions.js'),
    read('src/assets/js/reader/completion.js'),
    read('src/assets/js/domain/reading-state.js')
  ]);

  for (const marker of [
    'Series → Reader → Continue → Finished → Read Again preserves bookmarks and route continuity',
    "openSeriesAction(page, 'Read')",
    "openSeriesAction(page, 'Continue')",
    "openSeriesAction(page, 'Read Again')",
    "page.locator('#bookmarkButton').click()",
    "page.locator('#finishedToggle')",
    "page.getByRole('button', { name: 'Begin Again' })",
    "page.locator('#completeReturnLink').click()",
    "page.locator('#returnButton').click()",
    "page.locator('#headerBack').click()",
    "toHaveURL(/\\/reader\\.html\\?.*restart=1/)"
  ]) assert.ok(spec.includes(marker), marker);

  assert.match(spec, /bookmarksRestarted\[0\]\.cfi\)\.toBe\(bookmarkedCfi\)/, 'Read Again must prove bookmarks survive the restart');
  assert.match(spec, /data-volume-state', 'unread'/, 'route continuity must finish back in canonical Unread state after page-1 restart');
  assert.match(actions, /resetFinishedVolume\(seriesId, bookId\)/, 'Read Again must use the canonical finished/progress reset owner');
  assert.match(actions, /urls\.readerUrl\(bookId, seriesId, \{ restart: true \}\)/, 'Read Again must reopen with explicit restart intent');
  assert.match(completion, /data-sg-finished-toggle="1"/, 'Reader completion must retain the canonical Finished control');
  assert.match(readingState, /if \(state === STATES\.FINISHED\) return "Read Again";/, 'Finished public actions must remain Read Again');
  assert.match(readingState, /if \(state === STATES\.IN_PROGRESS\) return "Continue";/, 'active public actions must remain Continue');
});
