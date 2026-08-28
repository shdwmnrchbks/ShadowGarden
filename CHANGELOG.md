# Shadow Garden Changelog

## 2.6.7 — Continuous Media Width Independence
- Fixed desktop Continuous full-page images being clipped by the text-width setting: synthetic full-page image plates now re-assert their one-canvas geometry above every theme rule, so landscape plates no longer overflow the text-width column and portrait plates no longer lose their bottom edge to theme padding inside the fixed-height plate body.
- Made Continuous artwork independent of the text-width setting: the setting now shapes prose only, while figure/picture wrappers, media-only containers, and bare media expand to the full reading canvas with re-centered symmetric negative margins capped at the canvas edge.
- Released the epub.js page-column `max-height` image cap in Continuous mode so portrait artwork renders at its true aspect; Paginated mode keeps the cap because a page cannot overflow vertically.
- Moved the Continuous containment guard from the text-width body to the canvas boundaries (iframe viewport, root overflow, container clipping) so the legitimate full-canvas bleed is never clipped while nothing can paint past the canvas or reach the seek rail.
- Added a real-browser Continuous regression rendering landscape/portrait plates and inline artwork, asserting no canvas clipping, plate geometry, prose following the text-width setting, and artwork geometry unchanged across text-width changes.

## 2.6.0 — Reliability & Real-Browser Testing
- Add an isolated Playwright 1.62.1 workspace and CI matrix covering Chromium, Firefox, and WebKit desktop plus Chromium Mobile and WebKit Mobile against the real production build with deterministic catalogs, authorization/media boundaries, generated EPUB fixtures, and retained failure artifacts.
- Make Main/Adult isolation, canonical first paint, navigation restoration, pinned/suggestion behavior, and the full **Read → Continue → Finished → Read Again** bookmark-preserving lifecycle real-browser authoritative.
- Expand Reader reliability across protected startup, progress/bookmark reload, Pages controls/TOC/keyboard/wheel/swipe policy, Continuous native scrolling, flow switching, image focus, resize/orientation, sleep/resume ticket renewal, large/visual/legacy/split-XHTML EPUB structures, and the mobile regressions reported in #154 and #157.
- Make Garden Keeper auth/session unlock, keyboard dialog focus, Series and translation editing, upload preflight/completion/retry, Maintenance, History, Trash, and Abuse Watch real-browser covered with duplicate-submit guards and recoverable busy/error states.
- Add accessibility scans and keyboard/focus, 200%/400% reflow, reduced-motion, forced-colors, increased-contrast, browser-zoom, and 44px mobile touch-target verification across Library, Series, Reader chrome, and Garden Keeper while documenting EPUB-content accessibility separately.
- Tighten the reusable v2 release gate so the exact `main` commit must pass both Verify and Real Browser E2E, match Cloudflare production version/commit metadata, and pass public production smoke before a GitHub v2 release is created.

## 2.5.0 — Motion & Continuity
- Add shared timing/easing tokens, restrained press feedback, progressive View Transition helpers, and explicit reduced-motion behavior without making motion an application-state owner.
- Add continuity for Library filtering/sorting/view changes, Library → Series artwork, Series/Reader progress presentation, Reader chrome/drawers, and same-origin Series ↔ Reader navigation where browser support permits it.
- Add observer-only Garden Keeper motion, shared navigation-intent hints, and reduced-motion-safe drawer choreography while preserving existing API, dialog, upload, navigation, and persistence owners.
- Keep browser-local reading data and the private B2, signed media, Garden Keeper session, abuse-control, and catalog-redaction security contracts unchanged.

## 2.4.0 — Interaction & UX Polish
- Make Library discovery faster with context-aware facet counts, disabled zero-result choices, persistent per-library View/Sort preferences, multi-filter Clear all, actionable empty states, subtle result transitions, and an explicit Another suggestion action for random reading suggestions.
- Add quiet reading-progress rails to Library/Series covers, canonical Unread / Continue / Up next / Finished volume states, and a simple reduced-motion-aware Back to top control for long Series pages.
- Polish Reader interaction with staged loading copy, external-link affordances, tap feedback, and immersive mobile chrome that auto-hides while reading and returns on interaction without obscuring Continuous-mode progress.
- Improve Garden Keeper with dirty-aware Series editing, discard protection, persistent save controls, canonical Novel Updates Genre chips, upload review summaries, safer Trash hierarchy, and focus restoration across dialogs.
- Replace blank or unstable Library/Series startup with geometry-matched Main/Adult skeletons that preserve persisted Compact/Grid preference and apply Adult Series theming before visible loading content can paint.
- Keep all new transitions and loading motion compatible with `prefers-reduced-motion` and add permanent unit/browser regression coverage for the new interaction contracts.

## 2.3.1 — Unified Series Editor Save
- Remove the redundant series-level **Save translation credits** action from Garden Keeper.
- Save translation status and translator credits atomically with the existing **Save series** action.
- Keep per-volume translation override saves unchanged because they belong to the individual volume editor.
- Preserve backward compatibility for older management clients that omit translation fields.

## 2.3.0 — Canonical Catalog Taxonomy
- Adopt the Novel Updates genre vocabulary as Shadow Garden's controlled 35-genre list while keeping descriptive Tags flexible.
- Normalize EPUB `dc:subject` metadata during local preflight and again at the server catalog boundary, collapsing publisher aliases such as `Fiction/Fantasy/General` and `Fantasy Fiction` into `Fantasy`.
- Split Garden Keeper Series/New Books metadata into separate Genres and Tags fields and add a dedicated public Genre filter/deep link.
- Add an audit-first Garden Maintenance migration for existing catalogs; a backup is created before normalization and unknown descriptive values are preserved as Tags.
- Add permanent browser/server taxonomy ownership and normalization tests.

## 2.2.1 — Mobile Filter First Paint
- Main and Adult Library Search/Filter panels now render collapsed from the initial mobile HTML/CSS state instead of expanding until JavaScript and catalog initialization finish.
- Desktop first paint remains expanded, while the mobile filter toggle is available immediately and hands off to the canonical R2 runtime/persistence owner.
- Added browser regression coverage for the no-flash mobile loading state.

## 2.2.0 — Reading Suggestions & Random Series Banners
- Kept Continue as the Library banner priority, then suggest the next unread volume when a previously started series has a next volume available.
- Added a random Read suggestion fallback so Main and Adult Library banners remain useful even when there is no active reading trail.
- Reused the suggested volume cover as the Library hero artwork and kept the suggestion stable for the current page session.
- Made Random the default Series banner mode, choosing from available volume covers once per Series page load while preserving explicit pinned banner selections.
- Updated Garden Keeper Series Banner controls to expose Random as the default choice with a representative random preview.
- Added unit/DOM/browser regression coverage for suggestion priority, random fallback, random banner selection, and Keeper banner semantics.

## 2.1.6 — Search Grid Track Containment
- Fixed the remaining long-query Search/Filter expansion by replacing intrinsic `auto` grid tracks with shrinkable `minmax(0,1fr)` tracks.
- Applied shrink-safe filter tracks on desktop, tablet, and mobile while preserving the existing responsive column counts.
- Constrained the active-filter pill rail so an unbroken Search pill cannot contribute an oversized intrinsic width.
- Strengthened browser regression coverage for grid-track-level long-query containment.

## 2.1.5 — Search Flex Width Containment
- Fixed the remaining long-query Search bar expansion by making the text input the shrinkable flex child instead of giving it 100% width beside the search icon and filter toggle.
- Preserved fixed space for Search field siblings while constraining long text to the input viewport.
- Strengthened browser regression coverage to reject a full-width Search input inside the flex row.

## 2.1.4 — Filter Intrinsic Width Guard
- Prevented very long Search text from widening the Search/Filter panel or the Author, Fan translator, Year, Volume count, and other selectors.
- Constrained the Library filter layout, search stack, search field, and native selects to their owning container with explicit shrink-safe width rules.
- Kept long search text inside the input instead of allowing its intrinsic content width to affect the surrounding grid.
- Added browser regression coverage for long-query filter width containment.

## 2.1.3 — Grid Title Spacing Parity
- Extended the v2.1.2 grid-card title spacing correction to mobile as well as desktop.
- Grid cards no longer reserve an unused second title line on any viewport; Compact view remains unchanged.
- Updated browser regression coverage so the spacing rule cannot become desktop-only again.

## 2.1.2 — Library Result Focus & Card Spacing
- Extended the New Growth / Recently Added fade-and-collapse behavior to desktop whenever search text or a result filter is active, so filtered catalog results move into view immediately on every viewport.
- Relocated active Search/Filter pills directly below the search bar and before Author in both Main and Adult libraries, while preserving the collapsed mobile presentation.
- Rebalanced Library card translator attribution to the same muted visual hierarchy as the author instead of accenting it more strongly.
- Removed the reserved second title line from non-compact desktop grid cards so one-line series titles no longer leave a large gap before author metadata.
- Expanded browser regression coverage for cross-viewport result focus, pill placement, translator hierarchy, and desktop grid spacing.

## 2.1.1 — Translation Metadata Cleanup
- Removed the duplicate Series Translation Credits panel; the compact Series information attribution is now the sole series-level translation credit presentation.
- Translator names now open their configured source URL when available and fall back to the Library translator filter when no source URL is stored.
- Matched Series Status and Translation Status dropdown presentation to the styled Series Banner selector.
- Added EPUB contributor-role scanning so EPUB3 refined MARC relator `trl` metadata and legacy `opf:role="trl"` metadata prefill the upload translator credit.
- Retired Translation Group and Attribution Note from browser/server normalization, Keeper editing, upload fields, search terms, and public catalog output.
- Fixed Translator filter initialization so selecting a translator produces the expected removable active-filter pill and applies the filter.

## 2.1.0 — Fan Translation Provenance
- Added structured fan translator/group attribution with optional source URLs, coverage notes, multiple hand-offs, and distinct translation status.
- Added Translator/Group Library filtering, translator-aware search, active-filter pills, catalog-card attribution, and Series Translation Credits with Main/Adult deep links.
- Added series-level translation defaults with per-volume overrides and explicit inheritance semantics.
- Added Garden Keeper translation management plus New Books seeding for a primary translator and translation status.
- Added authenticated translation metadata mutations with validation, catalog snapshots, cache invalidation, and unchanged public EPUB redaction/security boundaries.
- Added unit, service, and browser regression coverage plus the TRANSLATION_METADATA architecture contract.

## 2.0.3 — Adult Series First-Paint Hotfix
- Applied Adult Series route scope before the visible Series shell is parsed, eliminating the brief Main-theme loading frame.
- Made the initial Series back control scope-aware so Adult routes show “Back to Adult Library” from first paint instead of repainting after catalog startup.
- Kept loaded `series.nsfw` metadata authoritative for the final scope and preserved the frozen R10 external entrypoint baseline.

## 2.0.2 — Mobile Filter Layout Hotfix
- Fixed narrow-screen active filter pills so Search, Author, Year, Volume, Reading state, Pinned-only, and tags wrap inside the mobile viewport instead of clipping in a horizontal rail.
- Added the active search query as the first removable filter pill and kept long pill labels ellipsized.
- Removed reserved mobile spacing when New Growth / Recently Added is hidden for active search/filter results while preserving its fade/collapse motion.

## 2.0.1 — Mobile Filter & Reader Link UX
- Normalized Main and Adult mobile Search/Filter entry to the same collapsed baseline.
- While mobile search text or result filters are active, New Growth / Recently Added now fades away so matching catalog results move into view immediately.
- Expanded the active tag rail into removable, ellipsized pills for Author, Year, Volume range, Reading status, Pinned-only, and tag filters.
- Reader HTTP/HTTPS links now show a Shadow Garden-themed “Leave the Garden?” confirmation before opening safely in a new browser tab; internal EPUB links remain unchanged.

## 2.0.0 — R10 Final Cutover & v2 Baseline
- Completed the R0–R10 full-codebase refactor and established `V2_BASELINE.md` plus `v2-entrypoints.json` as the new architecture contract.
- Removed the remaining dormant R5 Garden Keeper alternate owners and the two R7 Keeper CSS compatibility aliases.
- Renamed the final active `admin-upload-polish.js` path to semantic `admin-upload-presentation.js`.
- Cleared the R1 grandfathered patch-style source list; retired paths remain permanent tombstones.
- Removed authored local JS/CSS `?v=` release-history queries; generated `dist/` asset stamping remains the sole cache-busting owner.
- Preserved Security Milestones 1–9, browser-local reading state, Reader Pages/Continuous input contracts, mobile drawer stabilization, private B2 and signed media/Range delivery.
- Added a verified v2 release gate: successful main Verify → matching Cloudflare production version/commit → public production smoke → GitHub v2.0.0 release.

## 1.18.0 — Reader Architecture & Zoom
- Replaced the Reader monolith/polish stack with an explicit protected book-session boundary and a single Reader application orchestrator.
- Split Reader responsibilities into rendition, Paginated, Continuous, progress, bookmarks, completion, settings, theme, and gesture controllers.
- Removed the temporary `URLSearchParams` interception and the `window.__sgReaderPublicBookId` / `window.__sgReaderSourcePath` handoffs; public opaque identity and private EPUB source are now passed explicitly by the authorized session.
- Kept the public `bk_...` identity canonical for browser state and Page Map ownership while retaining the private source path as a compatibility persistence alias.
- Consolidated Finished toggle, end-page context, and next-volume completion into one Reader completion controller for Pages and Continuous end pages.
- Consolidated swipe paging, desktop wheel paging, iframe touch forwarding, pinch zoom, one-finger pan, double-tap zoom/reset, Ctrl/Cmd-wheel zoom, and keyboard/settings zoom controls into one gesture owner.
- Added session-only viewport zoom: normal content supports up to 3× and Visual Page Cache synthetic covers/maps/illustrations up to 4×.
- Kept zoom outside EPUB.js layout geometry so magnification does not change typography, pagination, canonical Page Map data, or saved reading position.
- Read Again is now verified at the authorized session boundary and fails closed if Finished/progress state cannot be cleared; bookmarks remain untouched.
- Retired `reader.js`, `reader-polish.js`, `reader-v1.10.1.js`, `reader-gesture-hook.js`, `reader-wheel-pages.js`, and `reader-finished.js`.
- Added `docs/architecture/READER_LAYER.md` and `tools/check-r4.mjs`; R0–R4 are complete and R5 Garden Keeper decomposition is next.

## 1.8.0 — Codebase Cleanup
- Removed the retired v1.1-v1.3 Continuous-mode controllers that had remained in the repository after `reader-continuous-core.js` became authoritative.
- Consolidated the public `v1-polish.css`, `site-v1.5.css`, and `site-v1.6.css` layers into `site-current.css` while preserving their final cascade behavior.
- Consolidated the Garden Keeper v1.7/v1.7.1/v1.7.2/Catalog History CSS patch stack into `admin-current.css` and removed superseded mobile-backup overrides.
- Renamed current Garden Keeper helper modules by responsibility: upload workflow, upload completion, upload polish, and backup history no longer use historical v1.7.x filenames.
- Renamed the Reader's old `reader-stability.css` to `reader-end-page.css`; it contains only completion-page presentation and no runtime stability logic.
- Made the shared filled-triangle control normalizer an explicit dependency instead of loading it indirectly through accessibility controllers.
- Centralized Backblaze B2 read-client construction and object URL configuration in `functions/_lib/b2.js`, removing duplicate B2 client setup from the public media proxy.
- Removed the one-time Cloudflare rebuild trigger and other proven-unreachable compatibility assets.
- Added `tools/check.mjs` to syntax-check source JavaScript, validate JSON, catch duplicate HTML IDs, verify local/runtime asset references, inspect `_headers`, and reject retired compatibility files if they return.
- Added `npm run check`, made it a `prebuild` gate, and added a Node 22 GitHub Actions verification workflow for pull requests and `main`.
- Rewrote the README for the current private-B2, canonical Page Map, Visual Page Cache, single-owner Continuous core, and Garden Keeper architecture.
- This release is intentionally a maintenance/refactor release; the stabilized Reader, Page Map, visual-page preparation, catalog schema, and upload semantics are not being redesigned.

## 1.7.5 — Catalog History & Directional UI Polish
- Fixed mobile Catalog History cards being compressed by inherited maintenance layout rules.
- Normalized directional UI affordances to filled triangle glyphs across the current site surfaces.

## 1.7.4 — Catalog History Card Rebuild
- Rebuilt Catalog History rows as a dedicated component instead of inheriting generic maintenance-item geometry.
- Preserved the v1.7.3 preflight behavior and the uploaded-series cover chooser while correcting mobile backup layout.

## 1.7.3 — Local Preflight Recovery
- Fixed the queue/editor visibility observer interfering with local EPUB inspection after additional files were added.
- Kept browser-local preflight authoritative and restored the active editor only after checking items had settled.

## 1.7.2 — Queue Editor & Upload Chooser Polish
- Fixed mobile Catalog History text/row collapse.
- Kept the active queue editor visible while adding more EPUBs.
- Upgraded the multi-series upload completion chooser to cover-first cards matching the library visual language.

## 1.7.1 — Upload Completion Handoff
- Fixed the stateful New Books workflow remaining on the 100% Uploading screen after the underlying batch uploader had already completed.
- Used the batch transaction boundary as the authoritative completion signal and re-emitted the terminal state after the legacy queue redraw settled.
- Improved mobile Catalog History text wrapping.

## 1.7.0 — Stateful New Books Workflow
- Added the reviewed stateful New Books workflow with dedicated uploading, success, partial-failure, and multi-series completion states.
- Added ordinary queue removal controls, duplicate-policy presentation, and collapsed preflight details.
- Scoped pinned sidebar entries to the active Main or Adult archive.
- Added mobile Catalog History layout improvements and explicit post-initialization workflow loading.

## 1.6.1 — Concealed Garden Keeper Shortcut
- Added the concealed desktop multi-click and mobile long-press shortcut to Garden Keeper while preserving normal token authentication.

## 1.6.0 — Navigation & Keeper Utilities
- Expanded archive navigation and standardized dropdown/disclosure symbols.
- Added pinned series to the sidebar and pin indicators on library cards.
- Added desktop mouse-wheel page turns in Paginated reader mode.
- Added Garden Keeper Catalog History deletion controls and an authenticated backup-deletion endpoint.
- Moved the mobile filter collapse control beside Reset when expanded and improved Adult archive mobile scaling.

## 1.5.2 — Mobile Filter Collapse
- Restored filter collapse only on mobile while leaving desktop/tablet archive filters permanently open.
- Kept search visible in the compact collapsed mobile state.

## 1.5.1 — Archive Navigation & Filter Layout
- Added richer volume metadata to Continue Reading.
- Aligned archive filters with Recently Added and improved Main/Adult return navigation.
- Removed the obsolete always-collapsible desktop filter controller.

## 1.5.0 — Reader Interface Themes & Adult UI
- Added complete reader interface theme palettes and refreshed the Night palette.
- Improved library headers and the Continue Reading card.
- Moved the Adult Library entrance into the Main archive header.
- Applied the Adult palette and Adult-aware navigation consistently on Adult series pages.

## 1.4.3 — Paginated Visual Frame Sizing
- Fixed standalone image pages in Pages mode using the wrong iframe geometry.
- Made the full paginated iframe the visual-page frame so covers and illustrations remain centered and contained.

## 1.4.2 — Paginated Visual Page Fit
- Added a dedicated Paginated visual-page fit controller.
- Centered and contained standalone covers/illustrations without changing ordinary chapter pagination.

## 1.4.1 — Continuous Lifecycle Fix
- Fixed blank retained Continuous views after first open by actively repairing/re-showing visible views.
- Made background neighbor buffering generation-aware so stale work is invalidated by newer navigation.
- Kept requested-section navigation, background buffering, and scroll/location reporting as separate concerns.
- Ensured post-seek/current-page reporting remains independent of potentially slow neighbor preparation.

## 1.4.0 — Continuous Core Rewrite
- Retired the stacked v1.1.5 Continuous anchor shim, v1.2.2 runtime stability manager, and v1.3.1 seek-neighborhood layer from the reader load path so only one controller owns Continuous mode.
- Added one authoritative Continuous controller for scroll listeners, real scroll-coordinate synchronization, spine buffering, idle trimming, display deduplication, boundary recovery, location reporting, and the end-of-volume page.
- Keep four already-rendered spine sections buffered on either side of the visible section instead of waiting until the viewport reaches an XHTML boundary before loading the next section.
- Keep retained iframe views rendered while scrolling and trim only after idle, with a bounded twelve-view working set to avoid the previous hide/show/destroy interactions.
- Give individual neighboring spine loads a timeout so one malformed or slow section cannot hold the Continuous manager indefinitely.
- Emit the Continuous `scrolled` location event immediately when scrolling settles, before background neighbor buffering, so canonical page tracking and the seekbar counter continue updating even while adjacent content is loading.
- Rebind the EPUB.js scroll container only after it actually exists, avoiding the earlier lifecycle race where a controller could mark itself installed before any live scroll listener was attached.
- Preserve the viewport while prepending previous sections by measuring the visible DOM anchor before/after insertion and correcting the real container scroll position.
- Keep v1.3.0 Visual Page Cache preprocessing and the v1.2 canonical Page Map, while removing the old Continuous-specific visual/layout and seek recovery scripts from `reader.html`.
- Serve `/reader.html` with `Cache-Control: no-store` so deployments cannot retain an older combination of Continuous runtime scripts in the browser shell.

## 1.3.1 — Continuous Seek Neighborhood Recovery
- Fixed Continuous seeks leaving EPUB.js with only the landed XHTML spine item mounted, which allowed scrolling inside that section but blocked traversal into the previous or next section.
- After each committed Continuous seek, immediately mount two neighboring spine items on each side of the landed section instead of waiting for boundary-triggered background fill.
- Re-center the exact seek CFI after neighbor dimensions settle so prepended sections do not move the requested reading position.
- Reset EPUB.js silent-scroll suppression and resynchronize current/previous scroll coordinates and deltas after the seek transaction.
- Re-prime the normal bounded Continuous checker from the restored multi-view neighborhood so ordinary scrolling resumes normally.
- Suppress reader.js's second identical Continuous `display(target)` for the same committed seek only after neighborhood recovery, preventing that follow-up call from disturbing the recovered state.

## 1.3.0 — Visual Page Cache
- Added a first-run EPUB spine scanner that identifies genuinely standalone cover/illustration XHTML and SVG pages before the live reader lays them out.
- Store prepared visual-page assets locally in a dedicated IndexedDB cache keyed by book URL, so later opens can reuse the prepared pages without rescanning the EPUB.
- Convert JPEG/PNG/AVIF and compatible SVG visual pages to local WebP copies when the browser encoder supports it; preserve existing WebP/GIF assets or SVG fallbacks when conversion is unnecessary or unavailable.
- Extract the underlying raster directly from common SVG-wrapped cover pages instead of asking EPUB.js to continuously size the original `100vh`/percentage-based SVG wrapper.
- Replace detected visual spine documents with a deterministic synthetic one-viewport image page before EPUB.js performs its first layout measurement in both Pages and Continuous modes.
- Keep detection intentionally conservative: normal chapters, title pages with meaningful text, and small decorative section-break artwork remain normal EPUB XHTML.
- Keep the canonical Page Map rule that a standalone visual spine item represents one device page while removing the unstable original visual XHTML from the live Continuous manager.
- Show `Preparing visual pages…` during uncached first-run preprocessing and fall back to the original EPUB page if preparation of a particular book cannot be completed.
- Right-align the Continuous seekbar page counter and let large `current/total` values grow leftward, preventing page counts in the thousands from clipping off the right side of the screen.

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
- Added token-based search and URL-persisted filter/view state with browser Back/Forward restoration.
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

> The planned v0.11 PWA / offline-books milestone was intentionally skipped and is not part of Shadow Garden.
