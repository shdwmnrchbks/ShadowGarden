import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { createPageNavigationInput } from "../../src/assets/js/reader/page-navigation-input.js";
import { installBrowserEnv } from "../helpers/browser-env.mjs";

function fakeDocument() {
  const listeners = new Map();
  return {
    listeners,
    documentElement: { dataset: {} },
    addEventListener(type, handler, options) { listeners.set(type, { handler, options }); },
    getSelection() { return { toString: () => "" }; }
  };
}

function touchEvent({ x, y, changed = false } = {}) {
  const touch = { screenX: x, screenY: y };
  return {
    target: { closest: () => null },
    touches: changed ? [] : [touch],
    changedTouches: changed ? [touch] : [],
    prevented: false,
    preventDefault() { this.prevented = true; }
  };
}

test("Pages input owns horizontal swipe while Continuous mode ignores the same gesture", () => {
  const env = installBrowserEnv();
  const previousMatchMedia = globalThis.matchMedia;
  const previousInnerWidth = globalThis.innerWidth;
  const previousInnerHeight = globalThis.innerHeight;
  try {
    globalThis.innerWidth = 1200;
    globalThis.innerHeight = 900;
    globalThis.matchMedia = () => ({ matches: true });
    let flow = "paginated";
    const turns = [];
    const doc = fakeDocument();
    const input = createPageNavigationInput({ getFlow: () => flow, getSwipeTurns: () => true, turn: direction => turns.push(direction) });
    input.installDocument(doc);

    assert.equal(doc.listeners.has("touchmove"), false, "live EPUB documents must not receive Reader-owned touchmove");
    assert.equal(doc.listeners.get("touchstart").options.passive, true);
    assert.equal(doc.listeners.get("touchend").options.passive, false);

    doc.listeners.get("touchstart").handler(touchEvent({ x: 220, y: 100 }));
    doc.listeners.get("touchend").handler(touchEvent({ x: 120, y: 104, changed: true }));
    assert.deepEqual(turns, [1]);

    flow = "scrolled-doc";
    doc.listeners.get("touchstart").handler(touchEvent({ x: 220, y: 100 }));
    doc.listeners.get("touchend").handler(touchEvent({ x: 120, y: 104, changed: true }));
    assert.deepEqual(turns, [1], "Continuous mode must ignore Pages swipe navigation");
  } finally {
    if (previousMatchMedia === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = previousMatchMedia;
    if (previousInnerWidth === undefined) delete globalThis.innerWidth; else globalThis.innerWidth = previousInnerWidth;
    if (previousInnerHeight === undefined) delete globalThis.innerHeight; else globalThis.innerHeight = previousInnerHeight;
    env.restore();
  }
});

test("Reader source keeps image pinch/pan isolated from live EPUB document touch handling", async () => {
  const [pageInput, imageFocus, continuous] = await Promise.all([
    fs.readFile(new URL("../../src/assets/js/reader/page-navigation-input.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../../src/assets/js/reader/image-focus.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../../src/assets/js/reader/continuous.js", import.meta.url), "utf8")
  ]);
  assert.equal(pageInput.includes('addEventListener("touchmove"'), false);
  assert.equal(imageFocus.includes('doc.addEventListener("touchmove"'), false);
  assert.match(imageFocus, /viewport\?\.addEventListener\("touchmove"/);
  assert.match(imageFocus, /mode:"pinch"/);
  assert.match(imageFocus, /mode:"pan"/);
  assert.match(continuous, /scrolled-doc|continuous/i);
});

test("Reader confirms external HTTP links before opening a new browser tab", async () => {
  const [adapter, readerHtml, presentation] = await Promise.all([
    fs.readFile(new URL("../../src/assets/js/reader-epub-adapter.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../../src/reader.html", import.meta.url), "utf8"),
    fs.readFile(new URL("../../src/assets/css/reader-presentation.css", import.meta.url), "utf8")
  ]);

  assert.match(adapter, /function externalHttpHref/);
  assert.match(adapter, /\^https\?:\\\/\\\//);
  assert.match(adapter, /anchor\?\.getAttribute\?\.\("href"\)/);
  assert.match(adapter, /installExternalLinkGuard/);
  assert.match(adapter, /hooks\?\.content\?\.register/);
  assert.match(adapter, /event\.preventDefault\(\)/);
  assert.match(adapter, /event\.stopImmediatePropagation\(\)/);
  assert.match(adapter, /window\.open\(href,"_blank","noopener,noreferrer"\)/);
  assert.match(adapter, /return"";/, "relative and fragment hrefs must fall through to EPUB internal navigation");

  for (const id of ["externalLinkDialog", "externalLinkHeading", "externalLinkDestination", "externalLinkCancel", "externalLinkOpen"]) {
    assert.match(readerHtml, new RegExp(`id="${id}"`));
  }
  assert.match(readerHtml, /PATH BEYOND THE GARDEN/);
  assert.match(readerHtml, /Leave the Garden\?/);
  assert.match(presentation, /\.reader-external-dialog/);
  assert.match(presentation, /\.reader-external-dialog::backdrop/);
  assert.match(presentation, /body\.adult-reader \.reader-external-dialog/);
  assert.match(presentation, /body\.reader-theme-paper \.reader-external-dialog/);
});

test("Reader interaction controller adds external affordance, staged loading, mobile chrome reveal, tap feedback, and reduced-motion fallbacks", async () => {
  const [controller, bootstrap, presentation] = await Promise.all([
    fs.readFile(new URL("../../src/assets/js/reader/interaction-controller.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../../src/assets/js/reader-bootstrap.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../../src/assets/css/reader-presentation.css", import.meta.url), "utf8")
  ]);
  assert.match(bootstrap, /installReaderInteractionController/);
  assert.match(bootstrap, /Authorizing|Opening the EPUB/);
  assert.match(controller, /sg-external-link/);
  assert.match(controller, /External link — opens after confirmation/);
  assert.match(controller, /Preparing chapters/);
  assert.match(controller, /Mapping pages for this device/);
  assert.match(controller, /Laying out the page/);
  assert.match(controller, /reader-chrome-hidden/);
  assert.match(controller, /3200/);
  assert.match(controller, /iframe/);
  assert.match(presentation, /reader-flow-paginated\.reader-chrome-hidden \.reader-topbar/);
  assert.match(presentation, /reader-flow-paginated\.reader-chrome-hidden \.reader-bottombar/);
  assert.match(presentation, /\.reader-icon:active/);
  assert.match(presentation, /@media\(prefers-reduced-motion:reduce\)/);
});
