import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Continuous rail consumes the canonical progress presentation contract', async () => {
  const [progress, rail] = await Promise.all([
    read('src/assets/js/reader/progress-controller.js'),
    read('src/assets/js/reader-continuous-rail.js')
  ]);

  assert.match(progress, /sg:reader-progress/);
  assert.match(rail, /addEventListener\("sg:reader-progress"/);
  assert.doesNotMatch(rail, /MutationObserver/);
  assert.doesNotMatch(rail, /dataset\.(?:rail|accessible)/);
});

test('image tap compatibility is subordinate to Reader startup, not accessibility', async () => {
  const [bootstrap, a11y, compat] = await Promise.all([
    read('src/assets/js/reader-bootstrap.js'),
    read('src/assets/js/reader-a11y.js'),
    read('src/assets/js/reader/image-focus-touch-compat.js')
  ]);

  assert.match(bootstrap, /reader\/image-focus-touch-compat\.js/);
  assert.doesNotMatch(a11y, /mobile-reliability|image-focus-touch-compat/);
  assert.match(compat, /does not own image-focus state or presentation/i);

  await assert.rejects(
    access(new URL('../../src/assets/js/reader-mobile-reliability.js', import.meta.url))
  );
});
