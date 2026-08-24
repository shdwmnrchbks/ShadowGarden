import test from "node:test";
import assert from "node:assert/strict";

import { pageSwipeDirection } from "../../src/assets/js/reader/page-navigation-input.js";
import { imagePanBounds } from "../../src/assets/js/reader/image-focus.js";

test("Pages swipe classifier accepts deliberate horizontal turns only", () => {
  assert.equal(pageSwipeDirection({ dx: -80, dy: 8, elapsed: 250 }), 1);
  assert.equal(pageSwipeDirection({ dx: 80, dy: 8, elapsed: 250 }), -1);
  assert.equal(pageSwipeDirection({ dx: -40, dy: 2, elapsed: 250 }), 0);
  assert.equal(pageSwipeDirection({ dx: -80, dy: 90, elapsed: 250 }), 0);
  assert.equal(pageSwipeDirection({ dx: -80, dy: 8, elapsed: 1200 }), 0);
});

test("focused-image pan bounds expose only scaled overflow", () => {
  assert.deepEqual(imagePanBounds({ imageWidth: 800, imageHeight: 1200, viewportWidth: 400, viewportHeight: 600, scale: 2 }), { x: 600, y: 900 });
  assert.deepEqual(imagePanBounds({ imageWidth: 300, imageHeight: 300, viewportWidth: 600, viewportHeight: 600, scale: 1 }), { x: 0, y: 0 });
  assert.deepEqual(imagePanBounds({ imageWidth: 300, imageHeight: 900, viewportWidth: 600, viewportHeight: 600, scale: 2 }), { x: 0, y: 600 });
});
