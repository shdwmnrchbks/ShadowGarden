import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('v2.9 Keeper similar-volume warnings stay non-blocking and separate from exact duplicates', async () => {
  const [app, warning, batch, spec] = await Promise.all([
    read('src/assets/js/admin/app.js'),
    read('src/assets/js/admin/upload-similar-volume.js'),
    read('src/assets/js/admin-batch.js'),
    read('tests/e2e/specs/keeper-upload-similar-volume.spec.mjs')
  ]);

  assert.ok(app.includes('"/assets/js/admin/upload-similar-volume.js"'), 'composition root must load the warning layer');
  assert.ok(
    app.indexOf('"/assets/js/admin-batch.js"') < app.indexOf('"/assets/js/admin/upload-similar-volume.js"'),
    'warning layer must load after the canonical batch owner creates its queue state and DOM'
  );

  for (const marker of [
    'MAX_NUMBER_DELTA=1',
    'MAX_SIZE_DELTA=.02',
    'if(!item?.metaReady||item.duplicate)return null',
    'remoteSimilar(item)||batchSimilar(item)',
    "badge.textContent='SIMILAR'",
    'Upload remains allowed.',
    'item.similarVolume=match',
    "[data-similar-volume-warning]",
    'if(!match){badge?.remove();note?.remove();return}'
  ]) assert.ok(warning.includes(marker), marker);

  assert.match(batch, /function duplicateFor\(item\)/, 'exact duplicate ownership must remain in the canonical batch engine');
  assert.match(batch, /if\(item\.duplicate&&!\["replace","separate","skip"\]\.includes\(item\.action\)\)item\.action="skip"/, 'exact duplicates must retain their blocking/review decision path');
  assert.doesNotMatch(warning, /item\.action\s*=/, 'similar-volume warnings must never mutate the canonical queue action');
  assert.doesNotMatch(warning, /duplicatePolicy/, 'similar-volume warnings must not rewrite catalog duplicate policy');

  for (const marker of [
    'Garden Keeper warns on a high-confidence adjacent similar volume without blocking upload',
    "page.locator('[data-similar-volume-badge]')",
    "page.locator('[data-similar-volume-warning]')",
    "page.locator('#uploadButton')",
    "toHaveAttribute('data-action', 'new')",
    'Upload remains allowed.',
    'duplicatePolicy: \'reject\'',
    'expect(browserDiagnostics).toEqual([])'
  ]) assert.ok(spec.includes(marker), marker);
});
