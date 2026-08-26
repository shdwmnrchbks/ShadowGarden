# Shadow Garden Mobile Navigation Contract

**Reconciled after:** v2.6.0 reliability work  
**Ownership:** R7 navigation/design-system owner + R8 browser-smoke regression owner  
**Status:** Active contract

The v1.23.1–v1.23.5 real-device corrections established the body-level drawer portal. The v2.4 UX completion pass removed an earlier fixed-header workaround, but v2.6 real-browser testing exposed a different stacking failure: once the drawer is portaled to `body` and both document scroll containers are locked, a sticky header can retain its geometry while being painted beneath the body-level overlay. The current contract therefore keeps the baseline header sticky and promotes it only while navigation is open, with an exact flow-height replacement so geometry remains stable.

## Ownership

- `src/assets/js/nav.js` owns drawer lifecycle, body-level portal placement, accessibility state, focus trapping, backdrop creation, and the `site-nav-open` document state.
- `src/assets/css/nav.css` owns drawer/header/backdrop presentation, viewport geometry, Main/Adult variants, touch/overscroll behavior, and layout-stable open-state presentation.
- `tests/browser/mobile-nav-viewport.test.mjs` is the permanent R8 browser-contract regression for the source-level behavior.
- `tests/e2e/specs/library.spec.mjs` verifies the header is actually the top painted layer while the drawer is open across real browser projects.
- No page-specific stylesheet or post-render repair layer may independently reposition or restyle the navigation drawer.

## Viewport and portal contract

The responsive drawer is moved from the filtered/sticky `.site-header` into `document.body` before it is opened. This is required because mobile Chromium can treat a `backdrop-filter` ancestor as the containing block for fixed descendants.

The portaled drawer therefore owns true viewport-fixed geometry:

- fixed positioning;
- top edge immediately below the visible site header;
- bottom edge anchored to the viewport;
- independent vertical scrolling;
- safe-area bottom padding;
- contained overscroll.

The drawer must not return to `position:absolute`, calculated `100dvh` heights, or a fixed descendant of the filtered header.

## Header and layout-stability contract

The baseline header remains `position: sticky` during ordinary page use. When navigation opens, the header is temporarily promoted to `position: fixed` with explicit viewport edges and a z-index above the body-level drawer. A matching 72px/62px body spacer replaces exactly the flow height removed by that promotion.

This combination is intentional:

- closed state keeps normal sticky-page behavior;
- open state guarantees the header is painted above the drawer/backdrop in Chromium, Firefox, and WebKit;
- the replacement spacer keeps the underlying document at the same vertical geometry;
- no scroll-position scripting is required;
- stable scrollbar allocation remains provided by `scrollbar-gutter: stable`;
- drawer/backdrop geometry begins immediately below the visible header.

The fixed promotion and spacer must always be changed together. A fixed open-state header without the matching spacer reintroduces a layout jump; a spacer without the fixed promotion creates a duplicate gap.

## Background scroll-lock contract

Opening the drawer toggles `site-nav-open` on both `<html>` and `<body>`.

While open:

- the root/document scroll containers use `overflow: hidden` and disable overscroll propagation;
- the backdrop uses `touch-action: none` and cannot pan the page behind it;
- the drawer itself retains `touch-action: pan-y`, `overflow-y: auto`, and contained overscroll;
- the fixed open-state header remains separately paintable above those body-level overlays.

The result is desktop/mobile parity: the page behind the drawer remains stationary, while long drawer contents remain vertically scrollable and the site header stays visible.

## Presentation and variants

Because the drawer is portaled out of `.site-header`, its interactive presentation must be owned directly by `.site-nav-drawer` selectors rather than selectors that depend on header ancestry.

Drawer links/buttons therefore explicitly own:

- text color;
- no default underline;
- transparent base background;
- pointer/focus behavior;
- hover/focus/active treatment;
- a visible current-page indicator;
- keyboard-visible focus treatment.

The Adult surface preserves its rose/wine variant through `.adult-library .site-nav-drawer...` selectors.

## Accessibility contract

The existing navigation accessibility behavior remains required:

- trigger `aria-controls`, `aria-expanded`, and open/close label state;
- drawer `aria-hidden` state;
- focus enters the first drawer control after opening;
- Tab/Shift+Tab are trapped within the open drawer;
- Escape closes and returns focus to the trigger;
- backdrop click closes the drawer;
- reduced-motion disables drawer/backdrop/trigger transitions.

## Permanent regression coverage

`tests/browser/mobile-nav-viewport.test.mjs` and the real-browser Library suite must continue to guard at least:

- body-level drawer portal ownership;
- sticky baseline header ownership;
- fixed open-state header layering above the drawer;
- exact 72px/62px flow-height replacement while open;
- actual top-layer paint ownership, not only bounding-box geometry;
- viewport-fixed drawer geometry on desktop and mobile;
- stable scrollbar allocation;
- drawer-owned link/active/focus presentation;
- `<html>` + `<body>` open-state scroll locking;
- non-pannable backdrop;
- vertically pannable drawer;
- rejection of the retired `absolute + 100dvh` implementation.

These checks are part of R8's browser-contract layer even though the real-device corrections and v2.6 reconciliation landed after the original R8 milestone. Future navigation changes should extend this owner/test pair rather than adding another hotfix stylesheet or competing input owner.
