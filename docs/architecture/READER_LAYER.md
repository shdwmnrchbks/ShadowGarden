# Reader Application Layer

**Refactor milestone:** R4 — Reader architecture refactor  
**Release:** Shadow Garden v1.18.0  
**Security boundary:** authorized private EPUB source, browser-local reading state, no Reader accounts

R4 replaces the Reader's monolithic controller plus gesture/completion/version repair scripts with explicit application modules. The low-level EPUB.js compatibility shims remain separate because they patch vendor behavior rather than own Shadow Garden state.

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
      +--> gestures (session-only viewport zoom)
      |
      v
EPUB.js + low-level compatibility adapters
```

`reader/app.js` is the orchestration owner. Feature modules do not independently create Reader sessions or interpret public/private book identity.

## Authorized book session

`reader/book-session.js` owns the transition from the public Reader URL to an authorized private EPUB source.

The visible URL keeps the opaque `bk_...` identity. After `ShadowGardenBookAccess.initial` resolves, the session explicitly carries:

- `requested` — URL identity that opened the Reader;
- `publicBookId` — canonical opaque public identity;
- `sourcePath` — authorized private `/media/shadow-garden/books/...epub` source used by EPUB.js;
- `seriesId` and Adult scope;
- ticket metadata;
- one-shot `restartRequested` state.

R4 removes the old `URLSearchParams` interception and the `window.__sgReaderPublicBookId` / `window.__sgReaderSourcePath` handoff. `reader/app.js` opens `session.sourcePath` directly and creates Reader storage with both explicit source/public identities.

Read Again reset happens at this boundary before EPUB.js opens. Finished + progress aliases are cleared and verified; bookmarks are deliberately untouched. A failed reset aborts startup rather than opening an inconsistent state. The one-shot `restart=1` flag is removed only after the Reader starts successfully.

## Browser state ownership

`reader/storage.js` remains the Reader adapter over R2 persistence:

- progress -> `domain/progress.js`;
- bookmarks -> `domain/bookmarks.js`;
- Reader settings -> `sg-reader-settings`.

The private source path and public `bk_...` key are compatibility aliases for one logical book. New progress records store the public ID as their canonical `file` when available.

`sg-reader-polish-settings` remains a compatibility write/read for the pre-R4 swipe-toggle preference so existing profiles do not unexpectedly lose that setting. New Reader behavior is owned by `reader/settings.js`.

## Application modules

### `reader/app.js`

Orchestration only: opens the book, wires controllers, switches flow, coordinates relayout/page-map refresh, owns drawers/fullscreen/navigation wiring, and initializes completion after the live rendition exists.

### `reader/rendition.js`

Creates/destroys EPUB.js renditions, configures spreads, measures the unzoomed Reader viewport, and captures a canonical position before a flow change.

### `reader/paginated.js`

Owns Pages-mode next/previous commands. Page turns reset viewport zoom before changing the rendition.

### `reader/continuous.js`

Owns application-level Continuous navigation and exact href/fragment-to-CFI resolution. Low-level buffering/render lifecycle remains in `reader-continuous-core.js` because it is an EPUB.js manager compatibility boundary.

### `reader/progress-controller.js`

Owns live CFI/page position, saved progress, progress UI, Page Map/EPUB-location/spine fallback seeking, and EPUB location generation. It persists exclusively through `reader/storage.js`.

### `reader/bookmarks-controller.js`

Owns bookmark rendering, add/remove/open, canonical Page Map matching, and state of the bookmark toolbar control.

### `reader/completion.js`

Owns the Finished toggle, current/next-volume context, end-page copy, and the rule that choosing the next volume marks the current volume Finished first. The Continuous manager clones the end page, so this controller uses delegated events and one narrowly-scoped observer only to initialize third-party-created clones.

### `reader/settings.js`

Owns Reader settings sanitization/persistence, body theme/flow classes, control values, Continuous-only text-width visibility, and swipe-page-turn preference. The old `reader-v1.10.1.js` presentation observer is retired.

### `reader/gestures.js`

One owner for input gestures that previously overlapped across `reader-gesture-hook.js`, `reader-polish.js`, and `reader-wheel-pages.js`.

It owns:

- Paginated left/right swipe at 1x;
- desktop wheel page turns at 1x;
- pinch zoom;
- one-finger pan while zoomed;
- double-tap zoom/reset;
- Ctrl/Cmd + wheel zoom;
- Ctrl/Cmd + `+`, `-`, `0`;
- settings-drawer Zoom In / Reset / Zoom Out controls.

Gesture documents are attached through EPUB.js content/render hooks rather than a separate wrapped `window.ePub` plus iframe MutationObserver stack.

## Zoom contract

Zoom is a **session-only visual viewport transform**, not typography and not EPUB relayout.

```text
ordinary content: 1.0x .. 3.0x
synthetic visual page: 1.0x .. 4.0x
```

Synthetic visual pages are recognized by the Visual Page Cache's `data-sg-synthetic-visual="1"` marker.

The transform is applied to `#zoomLayer`, outside the EPUB document. It therefore does not alter:

- font size;
- EPUB.js column width;
- canonical Page Map layout metrics;
- saved page/CFI;
- progress percentage.

At 1x, normal swipe/wheel navigation applies. Above 1x, one-finger dragging pans the enlarged page and page-hit regions are disabled. Zoom resets before page turns, explicit navigation/seeks, flow switches, layout-changing settings, and significant viewport resize/orientation changes.

This prevents zoom geometry from becoming persistent reading geometry.

## Low-level compatibility boundaries retained

R4 intentionally keeps these classic scripts outside the application ownership layer:

- `reader-epub-adapter.js` — EPUB.js sizing/location normalization and legacy vendor navigation compatibility;
- `reader-visual-cache.js` — standalone visual-page preprocessing/cache;
- `reader-paginated-visual-fit.js` — visual-page fit compatibility;
- `reader-continuous-core.js` — bounded Continuous manager buffering/render lifecycle and physical Continuous end page;
- `reader-continuous-rail.js` — vertical seek UI proxy.

These files may still patch EPUB.js internals, but they must not become second owners for canonical progress, bookmarks, Finished state, Reader settings, or viewport gesture state. R10 may remove compatibility code proven obsolete after broader browser coverage exists.

## Reader state invariants

R4 preserves the R2 public state contract:

```text
page 1 / cover                  -> Unread
unmarked canonical page 2+      -> In Progress
explicit end-page Finished       -> Finished
confirmed Read Again             -> Unread + page 1
```

Read Again preserves bookmarks. Finished remains explicit; reaching a percentage threshold alone does not mark a volume Finished.

## Security invariants

- Public URLs/catalogs expose opaque `bk_...`, not private B2 paths.
- `sourcePath` is obtained only after the existing Book Access/ticket boundary resolves.
- EPUB requests continue through the same same-origin `/media/*` signed authorization/Range path.
- R4 does not add server-side progress, bookmarks, or reading history.
- M5–M9 acquisition, crawler, admin, abuse, Range, and B2 contracts are unchanged.

## Retired Reader ownership scripts

R4 removes:

- `src/assets/js/reader.js`
- `src/assets/js/reader-polish.js`
- `src/assets/js/reader-v1.10.1.js`
- `src/assets/js/reader-gesture-hook.js`
- `src/assets/js/reader-wheel-pages.js`
- `src/assets/js/reader-finished.js`

Their surviving responsibilities now live under `src/assets/js/reader/`.

Reader CSS consolidation is deliberately R7 work; `reader-polish.css` and `reader-v1.10.1.css` remain grandfathered presentation layers until that visual refactor.
