import test from "node:test";
import assert from "node:assert/strict";

import { READER_DEFAULTS, READER_FONT_CHOICES, sanitizeReaderSettings } from "../../src/assets/js/reader/settings.js";
import { createThemeController } from "../../src/assets/js/reader/theme.js";

test("Reader exposes exactly the four v2.8 typeface choices", () => {
  assert.deepEqual(READER_FONT_CHOICES, [
    { value: "default", label: "Default" },
    { value: "pt-sans", label: "Sans" },
    { value: "literata", label: "Serif" },
    { value: "inter", label: "Sans-Serif" }
  ]);
  assert.equal(READER_DEFAULTS.font, "default");
});

test("legacy Reader font settings migrate without changing the old default into a forced font", () => {
  assert.equal(sanitizeReaderSettings({ font: "book" }).font, "default");
  assert.equal(sanitizeReaderSettings({ font: "system" }).font, "inter");
  assert.equal(sanitizeReaderSettings({ font: "classic" }).font, "literata");
  assert.equal(sanitizeReaderSettings({ font: "unknown" }).font, "default");
});

test("Default leaves publication font-family untouched while named choices are owned by the EPUB style layer", () => {
  const theme = createThemeController({ getSettings: () => READER_DEFAULTS, isAdult: false });
  for (const font of ["default", "pt-sans", "literata", "inter"]) {
    const css = theme.css({ ...READER_DEFAULTS, font });
    assert.equal(css.body["font-family"], undefined);
  }
});
