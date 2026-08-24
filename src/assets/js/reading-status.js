/* Shadow Garden R2 — compatibility facade for the canonical reading-state service. */

import * as readingState from "./domain/reading-state.js";

if (!document.querySelector('link[data-reading-status-style]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/reading-status.css";
  link.dataset.readingStatusStyle = "1";
  document.head.appendChild(link);
}

window.ShadowGardenReadingStatus = readingState;

export * from "./domain/reading-state.js";
