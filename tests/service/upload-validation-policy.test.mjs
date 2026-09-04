import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWED_UPLOAD_PREFIXES,
  OPAQUE_COVER_KEY,
  safeHash
} from "../../functions/services/validation.js";

test("upload validation policy exports remain explicit security regression seams", () => {
  assert.deepEqual(ALLOWED_UPLOAD_PREFIXES, ["shadow-garden/books/", "shadow-garden/covers/"]);
  assert.equal(OPAQUE_COVER_KEY.test("shadow-garden/covers/cv_abcdefghijklmnopqrst-detail.webp"), true);
  assert.equal(OPAQUE_COVER_KEY.test("shadow-garden/covers/series-name-detail.webp"), false);
  assert.equal(safeHash("A".repeat(64)), "a".repeat(64));
  assert.equal(safeHash("not-a-sha256"), "");
});
