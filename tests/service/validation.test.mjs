import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_UPLOAD_BYTES,
  catalogHealth,
  normalizeCatalogVolumeInput,
  validateUploadBody,
  validateUploadTarget
} from "../../functions/services/validation.js";

test("upload validation preserves private namespace, opaque covers, MIME, and size limits", () => {
  assert.equal(validateUploadTarget("shadow-garden/books/fixture/book.epub", "application/epub+zip").ok, true);
  assert.equal(validateUploadTarget("shadow-garden/covers/cv_12345678901234567890-detail.webp", "image/webp").ok, true);
  assert.equal(validateUploadTarget("shadow-garden/covers/descriptive-cover.webp", "image/webp").ok, false);
  assert.equal(validateUploadTarget("shadow-garden/books/fixture/book.epub", "text/plain").status, 415);
  assert.equal(validateUploadTarget("../secret.epub", "application/epub+zip").ok, false);
  assert.equal(validateUploadBody(MAX_UPLOAD_BYTES).ok, true);
  assert.equal(validateUploadBody(MAX_UPLOAD_BYTES + 1).status, 413);
});

test("catalog input normalization keeps Adult scope and rejects invalid replacement/audio targets", () => {
  const valid = normalizeCatalogVolumeInput({
    adult: true,
    series: "Night Orchid",
    title: "Volume 3",
    number: 3,
    epubKey: "shadow-garden/books/night-orchid/volume-3.epub",
    coverKey: "shadow-garden/covers/cv_12345678901234567890-detail.webp",
    coverThumbKey: "shadow-garden/covers/cv_12345678901234567890-thumb.webp",
    audioAlignedUrl: "https://example.com/audio/night-orchid/",
    duplicatePolicy: "separate",
    year: 2026
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.adult, true);
  assert.equal(valid.value.number, 3);
  assert.equal(valid.value.duplicatePolicy, "separate");

  assert.equal(normalizeCatalogVolumeInput({ series: "X", title: "Y", epubKey: "../bad.epub" }).ok, false);
  assert.equal(normalizeCatalogVolumeInput({ series: "X", title: "Y", epubKey: "shadow-garden/books/x.epub", audioAlignedUrl: "javascript:alert(1)" }).ok, false);
  assert.equal(normalizeCatalogVolumeInput({ series: "X", title: "Y", epubKey: "shadow-garden/books/x.epub", replaceTargetFile: "/public/book.epub" }).ok, false);
});

test("Garden Health reports structural defects without network access", () => {
  const health = catalogHealth({
    main: { series: [{ id: "fixture", title: "Fixture", author: "", volumes: [{ number: 1, title: "V1", file: "/media/shadow-garden/books/fixture.epub", cover: "" }] }] },
    adult: { series: [] }
  }, { items: [{ id: "trash-1" }] });
  assert.equal(health.counts.series, 1);
  assert.equal(health.counts.volumes, 1);
  assert.equal(health.metrics.trashItems, 1);
  assert.equal(health.metrics.missingCovers, 1);
  assert.ok(health.issues.some(issue => issue.code === "series-author"));
  assert.ok(health.issues.some(issue => issue.code === "volume-cover"));
  assert.equal(health.objectKeys.includes("shadow-garden/books/fixture.epub"), true);
});
