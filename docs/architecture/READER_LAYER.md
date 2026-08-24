# Reader Application Layer

**Refactor milestone:** R4 — Reader architecture refactor  
**Original release:** Shadow Garden v1.18.0  
**Current Reader correction:** v1.18.2  
**Security boundary:** authorized private EPUB source, browser-local reading state, no Reader accounts

R4 replaces the Reader's monolithic controller plus gesture/completion/version repair scripts with explicit application modules. Low-level EPUB.js compatibility shims remain separate because they patch vendor behavior rather than own Shadow Garden state.

## Dependency direction

```text
reader-bootstrap.js
      |
      +--> reader/book-session.js ----> book-access.js + R2 domain
      |
      v
reader/app.js
      |
      +--> rendition / paginated / continuous
      +--> progress / bookmarks / completion
      +--> settings / theme / toc / page-map
      +--> gestures (Pages navigation + image focus)
      |
      v
EPUB.js + low-level compatibility adapters
```

`reader/app.js` is the orchestration owner. Feature modules do not independently create Reader sessions or interpret public/private book identity.

## Authorized book session

`reader/book-session.js` owns the transition from the public Reader URL to an authorized private EPUB source. The visible URL keeps the opaque `bk_...` identity. After `ShadowGardenBookAccess.initial` resolves, the session explicitly carries the requested URL identity, canonical public book ID, authorized private source path, series/scope information, ticket metadata, and one-shot Read Again state.

R4 removed the old `URLSearchParams` interception and `window.__sgReaderPublicBookId` / `window.__sgReaderSourcePath` handoff. `reader/app.js` opens `session.sourcePath` directly and creates Reader storage with explicit source/public identities.

Read Again reset happens at this boundary before EPUB.js opens. Finished + progress aliases are cleared and verified while bookmarks remain untouched. A failed reset aborts startup instead of opening inconsistent state.

## Browser state ownership

`reader/storage.js` remains the Reader adapter over R2 persistence:

- progress -> `domain/progress.js`;
- bookmarks -> `domain/bookmarks.js`;
- Reader settings -> `sg-reader-settings`.

The private source path and public `bk_...` key are compatibility aliases for one logical book. New progress records store the public ID as their canonical `file` when available.

`sg-reader-polish-settings` remains only as the compatibility read/write for the pre-R4 swipe-toggle preference. Current Reader behavior is owned by `reader/settings.js`.

## Application modules

### `reader/app.js`

Orchestration only: opens the book, wires controllers, switches flow, coordinates relayout/Page Map refresh, owns drawers/fullscreen/navigation wiring, and initializes completion after the live rendition exists.

### `reader/rendition.js`

Creates/destroys EPUB.js renditions, configures spreads, measures the normal Reader viewport, and captures a canonical position before a flow change.

### `reader/paginated.js`

Owns Pages-mode next/previous commands.

### `reader/continuous.js`

Owns application-level Continuous navigation and exact href/fragment-to-CFI resolution. Low-level buffering/render lifecycle remains in `reader-continuous-core.js` because it is an EPUB.js manager compatibility boundary.

### `reader/progress-controller.js`

Owns live CFI/page position, saved progress, progress UI, Page Map/EPUB-location/spine fallback seeking, and EPUB location generation. It persists exclusively through `reader/storage.js`.

### `reader/bookmarks-controller.js`

Owns bookmark rendering, add/remove/open, canonical Page Map matching, and bookmark toolbar state.

### `reader/completion.js`

Owns the Finished toggle, current/next-volume context, end-page copy, and the rule that choosing the next volume marks the current volume Finished first. Continuous clones the end page, so this controller uses delegated events and one narrowly scoped observer only for those third-party-created clones.

### `reader/settings.js`

Owns Reader settings sanitization/persistence, body theme/flow classes, control values, Continuous-only text-width visibility, and swipe-page-turn preference.

### `reader/gestures.js`

Owns only two kinds of Reader input:

- Pages-mode left/right swipe and desktop wheel page turns;
- opening and controlling the focused-image overlay.

The v1.18.0 page-wide pinch/pan system was removed in v1.18.2 because intercepting touch gestures across EPUB documents interfered with normal vertical touch scrolling in Continuous mode.

## Image-focus zoom contract

Images are zoomable only after the reader explicitly focuses them.

1. Tapping or clicking an EPUB `<img>` opens a top-level focused-image overlay.
2. The underlying EPUB rendition is left untouched at its current page/scroll position.
3. Inside the overlay, pinch zoom is available up to 4x.
4. While zoomed, one-finger dragging pans the focused image.
5. Tapping again, using the close button, or pressing Escape exits focus mode and restores normal Reader input.
6. Navigation, seeking, flow changes, settings relayout, or viewport changes also dismiss the focused image before operating on the book.

The focused copy uses the rendered image URL from the EPUB document. It is not a new reading position and does not change typography, EPUB pagination, canonical Page Map geometry, CFI, progress, or bookmark state.

### Continuous touch invariant

**Continuous mode receives no page-wide touchmove interception from `reader/gestures.js`.** EPUB documents do not receive a custom `touchmove` handler or `touch-action` override from the Reader gesture controller. Native vertical touch scrolling therefore remains owned by the EPUB.js Continuous scroll container/browser.

Pages-mode swipe detection only records a one-finger touch start and evaluates the completed gesture. It calls `preventDefault()` only after confirming a horizontal Pages-mode swipe that should turn the page.

The only `touch-action:none` surface is the temporary focused-image overlay, where preventing document scrolling is intentional.

## Why the image overlay is outside EPUB layout

The focused image lives in top-level Reader chrome rather than scaling the live EPUB viewport. This avoids the problems of page-wide transforms and keeps all reading geometry canonical:

- font size and line height are unchanged;
- EPUB.js column/Continuous dimensions are unchanged;
- Page Map fingerprints and device pages are unchanged;
- the saved CFI/page remains unchanged;
- closing the image returns to the same reading location.

## Low-level compatibility boundaries retained

R4 intentionally keeps these classic scripts outside the application ownership layer:

- `reader-epub-adapter.js` — EPUB.js sizing/location normalization and legacy vendor navigation compatibility;
- `reader-visual-cache.js` — standalone visual-page preprocessing/cache;
- `reader-paginated-visual-fit.js` — visual-page fit compatibility;
- `reader-continuous-core.js` — bounded Continuous manager buffering/render lifecycle and physical Continuous end page;
- `reader-continuous-rail.js` — vertical seek UI proxy.

These files may patch EPUB.js internals, but they must not become second owners for canonical progress, bookmarks, Finished state, Reader settings, or input state.

## Reader state invariants

```text
page 1 / cover                  -> Unread
unmarked canonical page 2+      -> In Progress
explicit end-page Finished      -> Finished
confirmed Read Again            -> Unread + page 1
```

Read Again preserves bookmarks. Finished remains explicit; reaching a percentage threshold alone does not mark a volume Finished.

## Security invariants

- Public URLs/catalogs expose opaque `bk_...`, not private B2 paths.
- `sourcePath` is obtained only after the existing Book Access/ticket boundary resolves.
- EPUB requests continue through the same same-origin `/media/*` signed authorization/Range path.
- Reader changes do not add server-side progress, bookmarks, or reading history.
- M5–M9 acquisition, crawler, admin, abuse, Range, and B2 contracts remain unchanged.

## Retired Reader ownership scripts

R4 removes:

- `src/assets/js/reader.js`
- `src/assets/js/reader-polish.js`
- `src/assets/js/reader-v1.10.1.js`
- `src/assets/js/reader-gesture-hook.js`
- `src/assets/js/reader-wheel-pages.js`
- `src/assets/js/reader-finished.js`

Their surviving responsibilities now live under `src/assets/js/reader/`.

Reader CSS consolidation remains R7 work; `reader-polish.css` and `reader-v1.10.1.css` stay grandfathered presentation layers until that visual refactor.
