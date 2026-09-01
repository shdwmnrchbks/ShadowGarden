import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReaderProgress } from '../../src/assets/js/reader/progress-controller.js';

test('formats canonical page, volume percentage, and chapter context', () => {
  const value = formatReaderProgress({
    percentage: 0.372,
    position: { page: 14, totalPages: 320 },
    chapter: 'Chapter One'
  });

  assert.equal(value.percent, '37%');
  assert.equal(value.rail, '14/320');
  assert.equal(value.compact, '14/320 · 37%');
  assert.equal(value.visual, 'Page 14/320 · 37% · Chapter One');
  assert.equal(value.accessible, 'Chapter One · Page 14 of 320 · 37% of volume');
});

test('falls back cleanly to volume percentage before Page Map is ready', () => {
  const value = formatReaderProgress({ percentage: 0.083, chapter: 'Prologue' });

  assert.equal(value.rail, '8%');
  assert.equal(value.compact, '8%');
  assert.equal(value.visual, '8% · Prologue');
  assert.equal(value.accessible, 'Prologue · 8% of volume');
});

test('clamps invalid progress values and omits invalid page counts', () => {
  const value = formatReaderProgress({
    percentage: 4,
    position: { page: 0, totalPages: 0 },
    chapter: '  '
  });

  assert.equal(value.value, 1);
  assert.equal(value.visual, '100%');
  assert.equal(value.accessible, '100% of volume');
});
