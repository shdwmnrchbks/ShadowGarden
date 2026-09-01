import test from 'node:test';
import assert from 'node:assert/strict';
import {
  READER_DEFAULTS,
  READER_TYPOGRAPHY_PRESETS,
  sanitizeReaderSettings
} from '../../src/assets/js/reader/settings.js';

test('Reader typography defaults preserve publication spacing', () => {
  const settings = sanitizeReaderSettings({});
  assert.equal(settings.typographyPreset, 'publication');
  assert.equal(settings.paragraphSpacing, 'publication');
  assert.deepEqual(
    Object.fromEntries(Object.keys(READER_TYPOGRAPHY_PRESETS.publication).map(key => [key, settings[key]])),
    READER_TYPOGRAPHY_PRESETS.publication
  );
  assert.equal(settings.flow, READER_DEFAULTS.flow);
});

test('legacy Reader typography is inferred without mislabeling custom choices', () => {
  const settings = sanitizeReaderSettings({
    theme: 'night',
    font: 'classic',
    fontSize: 120,
    lineHeight: 1.75,
    width: 880,
    flow: 'scrolled-doc'
  });
  assert.equal(settings.typographyPreset, 'custom');
  assert.equal(settings.paragraphSpacing, 'publication');
  assert.equal(settings.font, 'classic');
  assert.equal(settings.fontSize, 120);
  assert.equal(settings.lineHeight, 1.75);
  assert.equal(settings.width, 880);
});

test('preset-shaped saved Reader typography is inferred for older settings records', () => {
  const settings = sanitizeReaderSettings({
    ...READER_TYPOGRAPHY_PRESETS.comfortable,
    theme: 'paper',
    flow: 'paginated'
  });
  assert.equal(settings.typographyPreset, 'comfortable');
  assert.equal(settings.paragraphSpacing, 'comfortable');
});

test('explicit Custom typography identity survives sanitization', () => {
  const settings = sanitizeReaderSettings({
    ...READER_TYPOGRAPHY_PRESETS.spacious,
    typographyPreset: 'custom'
  });
  assert.equal(settings.typographyPreset, 'custom');
});

test('invalid Reader paragraph spacing falls back safely', () => {
  const settings = sanitizeReaderSettings({ paragraphSpacing: 'giant-gaps' });
  assert.equal(settings.paragraphSpacing, 'publication');
  assert.equal(settings.typographyPreset, 'publication');
});
