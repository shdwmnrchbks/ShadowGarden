import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBuildContext } from '../../tools/lib/build-context.mjs';

test('build context separates active deployment version from formal release version', async () => {
  const context = await loadBuildContext();

  assert.equal(context.version, '2.8.0');
  assert.equal(context.releaseVersion, '2.6.7');
});
