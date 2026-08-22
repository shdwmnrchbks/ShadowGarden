# Shadow Garden Changelog

## 1.2.2 — Runtime Navigation & Adult Control Rewrite
- Replaced EPUB.js Continuous recursive `check()` / `fill()` loading with a bounded iterative spine loader that stops after a finite number of inserts and aborts repeated no-growth media boundaries instead of letting the scroll queue lock indefinitely.
- Rebound EPUB.js's already-created debounced `_scrolled` callback to the bounded controller so normal wheel/touch scrolling cannot keep calling the superseded recursive handler.
- Made seekbar dragging preview-only and deduplicate the second identical Continuous `display()` inside the same committed seek transaction, while leaving the canonical Pages ↔ Continuous location reassertion intact.
- Added direct wheel/touch boundary recovery for full-page covers and standalone illustrations so the neighboring spine item can load even when the current visual page exactly fills the scroll extent.
- Made the end-of-volume page depend on the real final linear spine item instead of progress-text thresholds; Paginated shows it when advancing beyond the actual last page, while Continuous appends it physically after the final rendered spine view.
- Removed the obsolete v1.2.1 standalone end-page script so completion has one authoritative controller.
- Replaced the Add New Book and Manage Series Adult Library checkbox DOM nodes after legacy admin scripts initialize, removing the conflicting listeners that rebuilt/collapsed their dialogs.
- Keep Add New Book scope changes in the active batch model without redrawing the queue during the checkbox event, while direct Add-to-Series continues to hide the redundant toggle and inherit its series shelf.
- Rebuilt Series Editor geometry as explicit header / scrolling-content / footer grid rows and stabilized the visually-hidden checkbox focus box so changing Main ↔ 18+ cannot collapse the editor body.

## 1.2.1 — Reader & Adult Toggle Stability
- Changed reader seekbar scrubbing to preview only while dragging and navigate once on release, preventing overlapping Continuous `display()` cycles.
- Coalesce duplicate/overlapping EPUB.js display requests and top-level Continuous fill work, while preserving EPUB.js recursive fill behavior.
- Add wheel/touch boundary recovery so Continuous can append/prepend the next view even when a standalone image exactly fills the viewport and no scroll event fires.
- Replaced the automatic percentage-triggered Volume Complete dialog with an end-of-volume page: Pages mode reaches it only by advancing past the final canonical page; Continuous receives it as a normal block after the final book content.
- Prevent the Add New Book Adult toggle from rebuilding the entire batch queue during the checkbox change; scope is saved safely without blanking the modal.
- Hide the redundant Adult toggle when adding directly to an existing series and keep a clear inherited Main/18+ information banner.
- Lock the Series Editor shell to a stable flex height and preserve scroll position when changing Adult Library scope, preventing the editor body from collapsing.

## 1.2.0 — Canonical Device Page Map
- Added a layout-specific canonical Page Map generated from real paginated rendering for the current device viewport, font, font size, line height, text-width setting, spread mode, and EPUB publication/spine signature.
- Cache completed Page Maps in browser IndexedDB so a previously measured book/layout can restore page tracking immediately on later opens.
- Generate pagination in an isolated hidden EPUB.js sandbox so background page measurement cannot take over or destabilize the live Paginated/Continuous rendition.
- Prioritize the current spine item plus its previous/next neighbors first, then continue the rest of the book without blocking reading; CFI/percentage tracking remains the fallback until the full map is ready.
- Treat standalone text-free cover/illustration XHTML as exactly one canonical page, while normal chapter images and small in-text ornaments remain part of their surrounding text pagination.
- Track Continuous mode against a stable reading point around 30% down the viewport and resolve that CFI into the same canonical page ranges used by Pages mode.
- Make the canonical page coordinate authoritative when switching Pages ↔ Continuous, with the saved CFI retained as a precision/fallback anchor and optional within-page fraction.
- Save canonical page, total pages, section/local page, page fraction, Page Map fingerprint, and CFI in reading progress; older CFI-only progress remains compatible.
- Save page-aware bookmarks and restore them by canonical page when the matching layout map exists, otherwise fall back to their CFI.
- Make the progress/seek controls page-aware once the map is complete and show `current/total` device pages instead of only percentage.
- Add starting page numbers to TOC entries after the canonical map is ready.
- Rebuild/reuse Page Maps when layout-affecting reader settings or significant viewport/orientation changes alter the layout fingerprint, while avoiding needless regeneration for small mobile browser-chrome height changes.
- Keep the v1.1.5 Continuous visual-page startup fixes, reverse-scroll synchronization, stable retained views, and existing EPUB location generation as compatibility fallbacks.

## 1.1.5 — Flow Location & Continuous Startup Fix
- Preserve the actual viewport location when switching between Pages and Continuous by capturing the old rendition's live CFI before it is destroyed and handing that exact anchor to the new rendition.
- Re-apply the same CFI after Continuous has painted so immediate prepend/append work cannot silently move a flow switch back to the beginning of the chapter.
- Stop blocking Continuous `display()` on EPUB.js `fill()`; the requested spine item now opens first and neighboring sections preload on the manager queue afterward.
- Prevent cover/illustration sections from holding the global rendition queue on `Opening the book…` when a neighboring visual section is slow, malformed, or still waiting on intrinsic media dimensions.
- Give text-free cover and illustration XHTML a full-width rendered-copy layout, neutralize `vh` wrappers, and use bounded SVG/image aspect-ratio measurement instead of circular document `scrollHeight` growth.
- Keep v1.1.4 reverse-scroll synchronization, stable retained views, delayed location reporting, and bounded idle trimming.

## 1.1.4 — Continuous Visual Pages & Fast Scroll Fix
- Fixed fast Continuous scrolling flicker at chapter boundaries by keeping retained iframe views visible while scrolling instead of repeatedly calling EPUB.js `hide()` / `show()`.
- Avoid EPUB.js `hide()` setting `stopExpanding=true` on retained chapters, which could leave re-entered image/SVG sections stale or blank after fast traversal.
- Move visual-only XHTML preparation into `IframeView.load()` completion so standalone images, `<figure><img>` pages, and SVG cover wrappers are normalized before EPUB.js performs its first layout and `textHeight()` measurement.
- Neutralize rendered-copy `vh` wrapper sizing on visual-only pages to prevent circular iframe-height growth while preserving the source EPUB unchanged.
- Restore expansion before any retained hidden view is shown, remeasure visual pages after media/fonts settle, and retain four neighboring sections on each side before idle trimming.
- Kept the v1.1.3 real-scroll-position synchronization and delayed Continuous location reporting that fixed multi-chapter reverse scrolling.

## 1.1.3 — Continuous Reader Hardening
- Backported EPUB.js's newer Continuous manager scroll-position synchronization so recursive previous-section prepends use the real scroll container position instead of stale bookkeeping.
- Stop destroying offscreen spine iframes during active scrolling; hide them while moving, then trim only after the reader is idle while retaining a bounded three-section neighborhood around the viewport.
- Delay Continuous `scrolled` location reports until the queued manager check has settled, preventing stale geometry from pushing the reader forward or leaving the viewport blank during repeated upward traversal.
- Normalize visual-only XHTML sections before EPUB.js measures them, including `<figure><img>`, standalone image pages, and SVG cover wrappers that use percentage sizing or `100vh`.
- Keep visual pages at least one reader viewport tall, remeasure after media and fonts settle, and preserve intrinsic SVG/image aspect ratios instead of forcing SVG-only sections to exactly one viewport.
- Increased the Continuous preload window to roughly 2.25 viewports so prior spine items are prepared earlier without changing Paginated mode.

## 1.1.2 — Continuous Media & Reverse Scroll Stability
- Fixed image-only, full-page illustration, and SVG cover spine items collapsing or disappearing in Continuous mode while remaining valid in Paginated mode.
- Added a viewport-height fallback only for visual-dominant sections whose initial EPUB.js text measurement is zero or too small, then remeasure after normal images, SVG image resources, video metadata, and fonts settle.
- Mark new EPUB.js `.epub-view` elements as non-anchorable at creation time, before previous spine sections are prepended above the viewport.
- Increased the Continuous manager's preload window to roughly one viewport so previous sections begin loading before the reader is already pinned at the top boundary.
- Kept ordinary text-chapter sizing, Paginated mode, gestures, seek behavior, TOC navigation, and reader state logic unchanged.

## 1.1.1 — Continuous Upward Scroll Fix
- Fixed Continuous mode snapping downward or jumping into the current/next chapter while scrolling upward across a chapter boundary.
- Disabled browser scroll anchoring for EPUB.js continuous-manager containers and loaded chapter documents so prepending the previous spine item no longer pulls the viewport back down.
- Kept Paginated mode, gestures, seek behavior, TOC navigation, and reader state logic unchanged.

## 1.1.0 — Garden Keeper Overhaul
- Removed the post-unlock dashboard and made Manage Library the permanent Garden Keeper home.
- Replaced the old Dashboard navigation with a stacked Maintenance button and + New Books button beside the Manage Library heading.
- Converted Add New Books and Garden Maintenance into large single-scroll modal windows that match the Series Editor interaction model.
- Added a + Add book action beside Manage series on every series card.
- + Add book opens the New Books uploader already targeted to that exact existing series and shelf, with the series/shelf controls locked for that upload session.
- Added exact `targetSeriesId` catalog support so renamed series cannot accidentally fork into a duplicate series when adding volumes directly.
- Refresh Manage Library automatically after a completed upload batch.

## 1.0.5 — Series Editor Polish
- Removed the Series Editor's outer scrollbar so only the intended content pane scrolls while the header and action bar stay fixed.
- Automatically close the Series Editor after a successful series save or move-to-Trash action.
- Added lightweight Garden Keeper success toasts for completed series saves and Trash moves.
- Keep the editor open on failures so errors can be corrected without losing context.

## 1.0.4 — Batch Editor Selector
- Added an `Editing EPUB` dropdown to the Editable section for multi-EPUB queues.
- The selector lists every queued EPUB, including checking/failed state, extracted title, and volume number when available.
- Switching EPUBs uses the existing queue Edit path, so current metadata edits are saved before the next EPUB is loaded.
- Kept the v1.0.3 uploader controller and upload pipeline unchanged.

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
