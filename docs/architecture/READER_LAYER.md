# Reader Application Layer

**Refactor milestone:** R4 + R4.1 Reader architecture and stabilization  
**R4 release:** Shadow Garden v1.18.0  
**R4.1 release:** Shadow Garden v1.19.0  
**Security boundary:** authorized private EPUB source, browser-local reading state, no Reader accounts

R4 replaced the Reader monolith with explicit session/application controllers. R4.1 consolidates what was learned from the v1.18.1–v1.18.3 corrective releases: Reader-wide zoom is retired, Continuous touch scrolling remains native, and Pages navigation input is separated from focused-image interaction.

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
      +--> page-navigation-input.js
      +--> image-focus.js
      |
      v
EPUB.js + low-level compatibility adapters
```

`reader/app.js` is the orchestration owner. Feature modules do not independently create Reader sessions or reinterpret public/private book identity.

## Authorized book session

`reader/book-session.js` owns the transition from the public opaque `bk_...` Reader URL to the authorized private EPUB source. The session carries the requested/public identity, private `sourcePath`, series/scope information, ticket metadata, and one-shot Read Again state.

Read Again reset happens before EPUB.js opens. Finished + progress aliases are cleared and verified, bookmarks are preserved, and a failed reset aborts startup instead of opening inconsistent state.

## Application owners

- `reader/app.js` — orchestration, flow switching, relayout/Page Map coordination, drawers/fullscreen/navigation wiring.
- `reader/rendition.js` — EPUB.js rendition creation/destruction, spread configuration, canonical position capture.
- `reader/paginated.js` — Pages next/previous commands.
- `reader/continuous.js` — application-level Continuous navigation/target resolution.
- `reader/page-map.js` — canonical device Page Map.
- `reader/progress-controller.js` — live/saved progress and seeking over R2 persistence.
- `reader/bookmarks-controller.js` — bookmark UI/navigation over R2 persistence.
- `reader/completion.js` — Finished toggle, end-page state and next-volume completion.
- `reader/settings.js` / `reader/theme.js` — Reader settings and presentation.
- `reader/page-navigation-input.js` — Pages-only horizontal swipe and desktop wheel turns.
- `reader/image-focus.js` — image selection, focused-image overlay, pinch/pan/close behavior.

## v2.8 typography contract

Reader typography remains browser-local and stays under the existing `reader/settings.js` + `reader/theme.js` ownership pair. Presets are convenience bundles, not a second style state: selecting a preset writes the same canonical font, size, line-height, paragraph-spacing, and Continuous text-width fields that manual controls use.

The named profiles are **Publication**, **Compact**, **Comfortable**, and **Spacious**. A manual typography edit records the profile as **Custom** while retaining the individual canonical values. Older saved settings without a profile are inferred when they exactly match a named bundle; otherwise they migrate as Custom without discarding existing choices.

**Publication** is the compatibility baseline. It emits no paragraph-margin override, so an EPUB keeps its own paragraph spacing unless the reader explicitly chooses Tight, Comfortable, or Spacious spacing. Typography changes reuse the existing application relayout and Page Map rebuild path; they do not become owners of progress, bookmarks, flow switching, or rendition navigation.

## R4.1 input ownership

R4.1 removes the combined `reader/gestures.js` owner. Page navigation and image inspection have different gesture rules and no longer share a state machine.

### `page-navigation-input.js`

This module may observe EPUB document `touchstart`, `touchend`, `touchcancel`, and `wheel` only. It does **not** install `touchmove`, `touch-action`, pinch, pan, zoom, or image-overlay behavior.

Pages mode recognizes a horizontal swipe only after the gesture ends. Continuous mode ignores this controller completely, leaving vertical touch scrolling to the browser/EPUB.js Continuous container. Desktop wheel page-turn handling is also Pages-only.

### `image-focus.js`

This module observes only image clicks inside EPUB documents. Selecting an `<img>` opens a top-level overlay without changing the live EPUB rendition.

Inside that overlay only:

1. pinch zooms the focused image from 1x to 4x;
2. one-finger drag pans only while magnified;
3. tapping the image again closes focus mode;
4. the close button or Escape also closes it;
5. close/hint chrome fades while magnified and returns at 1x;
6. navigation, seeking, flow changes, relayout, or viewport resize dismiss focus mode before modifying the book.

The overlay receives `touch-action:none`; EPUB documents do not.

## Image geometry contract

R4.1 applies transform directly to the focused image, not to the Reader viewport or EPUB rendition. Pan bounds are calculated from the rendered image dimensions relative to the focused viewport. An explicit `reader-image-focus-zoomed` class controls overlay chrome instead of CSS `:has()`/inline-style inspection.

The focused copy is not reading geometry. It must not change:

- typography or line height;
- EPUB.js column/Continuous dimensions;
- Page Map fingerprints/device pages;
- saved CFI/page/percentage;
- bookmark locations;
- underlying Continuous scroll position.

Closing the overlay returns to the unchanged reading location.

## R4.1 flaws consolidated

The stabilization pass folds the post-R4 corrective work back into architecture:

- the v1.18.0 page-wide pinch/pan design that broke Continuous vertical swiping is permanently removed;
- the v1.18.1 undeclared `wire` startup regression is guarded by an explicit `wire: wireRendition` contract;
- hotfix-era `reader/gestures.js` is replaced by two responsibility-named owners;
- `reader-zoom.css` is replaced by `reader-image-focus.css` because no Reader-wide zoom surface remains;
- fragile CSS `:has()` detection of the current scale is replaced by explicit controller state;
- when zoom hides the close button, focus is moved to the dialog so keyboard focus is not left on invisible chrome.

## Low-level compatibility boundaries retained

- `reader-epub-adapter.js` — EPUB.js sizing/location normalization and vendor compatibility.
- `reader-visual-cache.js` — standalone visual-page preprocessing/cache.
- `reader-paginated-visual-fit.js` — visual-page fitting compatibility.
- `reader-continuous-core.js` — bounded Continuous manager buffering/render lifecycle and physical end page.
- `reader-continuous-rail.js` — vertical seek UI proxy.

These may patch EPUB.js behavior, but they are not second owners for progress, bookmarks, Finished state, Reader settings, Page/Continuous input, or image focus.

## Reader state invariants

```text
page 1 / cover                  -> Unread
unmarked canonical page 2+      -> In Progress
explicit end-page Finished      -> Finished
confirmed Read Again            -> Unread + page 1
```

Read Again preserves bookmarks. Finished remains explicit; percentage alone does not mark a volume Finished.

## Security invariants

- Public URLs/catalogs expose opaque `bk_...`, not private B2 paths.
- `sourcePath` is obtained only after the existing Book Access/ticket boundary resolves.
- EPUB requests stay on the same `/media/*` signed authorization/Range path.
- Reader changes do not add server-side progress, bookmarks, or reading history.
- M5–M9 acquisition, crawler, admin, abuse, Range, and B2 contracts remain unchanged.

## Retired Reader ownership

R4 retired `reader.js`, `reader-polish.js`, `reader-v1.10.1.js`, `reader-gesture-hook.js`, `reader-wheel-pages.js`, and `reader-finished.js`.

R4.1 additionally retires:

- `src/assets/js/reader/gestures.js`
- `src/assets/css/reader-zoom.css`

Reader CSS consolidation beyond responsibility-correct image-focus naming remains R7 work; grandfathered `reader-polish.css` and `reader-v1.10.1.css` stay until that visual refactor.
