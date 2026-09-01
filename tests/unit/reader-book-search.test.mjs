import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookSearchPattern, normalizeBookSearchQuery } from '../../src/assets/js/reader/book-search.js';

test('Slice 4 normalizes book-search whitespace without changing the words', () => {
  assert.equal(normalizeBookSearchQuery('  moonlit\n   garden  '), 'moonlit garden');
});

test('Slice 4 requires a bounded useful query and matches flexible whitespace', () => {
  assert.equal(buildBookSearchPattern('a'), null);
  assert.equal(buildBookSearchPattern('of'), null);
  const pattern = buildBookSearchPattern('stable reading position');
  assert.ok(pattern.test('Stable   reading\nposition'));
});

test('Slice 4 treats regex punctuation as literal search text', () => {
  const pattern = buildBookSearchPattern('chapter (2)');
  assert.ok(pattern.test('Chapter (2) begins here.'));
  assert.equal(pattern.test('Chapter 22 begins here.'), false);
});
