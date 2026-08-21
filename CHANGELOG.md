# Shadow Garden Changelog

## 1.0.3 — Uploader Controller Hotfix
- Removed the batch uploader's file-input clone/replace handoff and made the batch controller own the existing picker directly.
- Snapshot selected `File` objects immediately in a capture-phase change handler, then stop the obsolete single-file handlers before they can interfere.
- Show the batch queue and CHECKING state before any catalog/B2 lookup, and run local EPUB inspection in parallel with duplicate lookup.
- Added a visible processing failure state if the file-selection pipeline itself throws.

## 1.0.2 — File Selection Hotfix
- Fixed browser-dependent EPUB selections disappearing before the batch importer could copy them.
- Snapshot selected `File` objects during the input event before Garden Keeper clears the file picker for reuse.
- Kept the v1.0.1 timeout diagnostics, duplicate handling, preflight, and upload pipeline unchanged.

## 1.0.1 — Uploader Hotfix
- Added bounded waits around the duplicate-library lookup so a stalled B2/catalog request cannot leave file selection appearing frozen indefinitely.
- Added explicit uploader guidance for EPUBs still being inspected, failed preflight, duplicates left on Skip, and queues where every item is skipped.
- Added clear timeout errors for stalled EPUB uploads and catalog updates instead of leaving the upload UI looking inert.
- Preserved existing replacement safety rules and successful/partial batch completion status.

## 1.0.0

### Accessibility and UI polish
- Added skip links and stronger keyboard focus treatment across the public library, series pages, and reader.
- Rebuilt the ✦ navigation trigger as a real button beside the Home link instead of a pseudo-button nested inside an anchor.
- Added navigation focus trapping, Escape handling, focus return, `aria-expanded`, and `aria-hidden` state.
- Added live catalog result announcements and dynamic Grid/Compact `aria-pressed` state.
- Improved the Adult Library gate by making background content inert while the gate is active and moving focus to the entry action.
- Added Reader drawer state, focus handoff/return, tab semantics, fullscreen state, chapter announcements, progress text, labelled close buttons, and live toast/loading status.
- Added reduced-motion, increased-contrast, forced-colors, and consistent focus-visible support.

### Performance and cleanup
- Added `content-visibility` containment for long series volume lists.
- Consolidated final accessibility/performance overrides into small v1-specific styles instead of modifying the stabilized EPUB rendering engine.
- Kept pagination, continuous seeking, gestures, TOC navigation, catalog schema, B2 storage, and Garden Maintenance behavior unchanged.

### Documentation
- Rewrote `README.md` for the current private-B2 / Cloudflare Pages architecture and current feature set.
- Added this changelog.

## 0.14.1
- Added collapsible Main and Adult library filter panels. Collapsed mode keeps only search and its expand control visible.
- Persisted collapsed state independently for each library.

## 0.14.0 — Library Scaling
- Added a Recently Added volume shelf.
- Added author, exact multi-tag, year, volume-count, pinned, and richer sort filters.
- Added token-based search and URL-persisted filter/view state with browser history restoration.
- Added incremental catalog rendering with automatic and manual load-more behavior.

## 0.13.2 — Reader Polish Hotfix
- Moved touch gesture detection to EPUB.js rendition-level forwarded touch events so page turns remain reliable on the final page of a chapter.

## 0.13.0 — Reader Polish
- Added next-volume completion flow.
- Added mobile swipe/tap-zone page turns for paginated mode.
- Added distraction-free reader chrome.

## 0.12.0 — Garden Maintenance
- Added Garden Health diagnostics and batched deep B2 checks.
- Added legacy-cover optimization.
- Added catalog snapshots/history and rollback.
- Added soft-delete Trash, restore, and protected permanent purge.

## 0.10.0 — Batch Uploader
- Added multi-EPUB upload queues, browser-local EPUB preflight, duplicate detection, and Skip / Replace / Add Separate policies.
- Added sequential phone-friendly processing and upload progress.

## 0.9.0 — Reader Architecture
- Rebuilt the reader around isolated storage, theme, and TOC modules.
- Added Paginated and Continuous reading flows, reader settings, bookmarks, and persistent progress.

## 0.8.0 — Cover and Delivery Performance
- Added WebP cover derivatives and thumbnail-aware catalog fields.
- Added cache-aware private B2 media delivery improvements.

## 0.7.0
- Expanded private Backblaze B2-backed library administration and catalog management.

## 0.6.0
- Established the private B2 + Cloudflare Pages architecture and Garden Keeper administration flow.

> The planned v0.11 PWA / offline-books milestone was intentionally skipped and is not part of Shadow Garden v1.0.
