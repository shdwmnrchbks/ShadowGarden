# Shadow Garden Mobile Navigation Contract

**Reconciled after:** v2.4.0  
**Ownership:** R7 navigation/design-system owner + R8 browser-smoke regression owner  
**Status:** Active contract

The v1.23.1–v1.23.5 real-device corrections established the body-level drawer portal. The v2.4 UX completion pass keeps that portal while removing the later fixed-header/body-padding compensation so opening navigation no longer changes document geometry.

## Ownership

- `src/assets/js/nav.js` owns drawer lifecycle, body-level portal placement, accessibility state, focus trapping, backdrop creation, and the `site-nav-open` document state.
- `src/assets/css/nav.css` owns drawer/header/backdrop presentation, viewport geometry, Main/Adult variants, touch/overscroll behavior, and layout-stable open-state presentation.
- `tests/browser/mobile-nav-viewport.test.mjs` is the permanent R8 browser-contract regression for this behavior.
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

The site header remains `position: sticky` and stays in normal document flow when navigation opens. Opening the drawer may raise its z-index or add visual separation, but it must not change the header to `position: fixed` and must not add compensating top padding to `<body>`.

This preserves the page's geometry exactly across open/close transitions:

- no sticky-to-fixed header mode switch;
- no 72px/62px body-padding compensation;
- no scroll-position scripting;
- stable scrollbar allocation through `scrollbar-gutter: stable`;
- drawer/backdrop geometry continues to begin immediately below the visible header.

The background page therefore does not jump when the drawer opens or closes.

## Background scroll-lock contract

Opening the drawer toggles `site-nav-open` on both `<html>` and `<body>`.

While open:

- the root/document scroll containers use `overflow: hidden` and disable overscroll propagation;
- the backdrop uses `touch-action: none` and cannot pan the page behind it;
- the drawer itself retains `touch-action: pan-y`, `overflow-y: auto`, and contained overscroll.

The result is desktop/mobile parity: the page behind the drawer remains stationary, while long drawer contents remain vertically scrollable.

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

`tests/browser/mobile-nav-viewport.test.mjs` must continue to guard at least:

- body-level drawer portal ownership;
- sticky header remaining in document flow;
- rejection of fixed-header/body-padding compensation;
- viewport-fixed drawer geometry on desktop and mobile;
- stable scrollbar allocation;
- drawer-owned link/active/focus presentation;
- `<html>` + `<body>` open-state scroll locking;
- non-pannable backdrop;
- vertically pannable drawer;
- rejection of the retired `absolute + 100dvh` implementation.

These checks are part of R8's browser-contract layer even though the real-device corrections and v2.4 reconciliation landed after the original R8 milestone. Future navigation changes should extend this owner/test pair rather than adding another hotfix stylesheet or competing input owner.
