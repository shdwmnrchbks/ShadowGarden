# Shadow Garden Mobile Navigation Contract

**Reconciled after:** v1.23.5  
**Ownership:** R7 navigation/design-system owner + R8 browser-smoke regression owner  
**Status:** Active contract

The v1.23.1–v1.23.5 real-device corrections exposed browser-specific behavior that was not fully represented by the original R7/R8 documentation. This document folds those lessons back into the architecture without creating a new refactor milestone.

## Ownership

- `src/assets/js/nav.js` owns drawer lifecycle, body-level portal placement, accessibility state, focus trapping, backdrop creation, and the `site-nav-open` document state.
- `src/assets/css/nav.css` owns drawer/header/backdrop presentation, viewport geometry, Main/Adult variants, touch/overscroll behavior, and open-state layout compensation.
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

## Header contract

While navigation is open, `.site-header` becomes a true fixed viewport header above both drawer and backdrop.

Because switching the header from sticky to fixed removes its box from normal document flow, `body.site-nav-open` preserves the same amount of layout space:

- 72px at the normal header size;
- 62px at the mobile breakpoint.

This compensation prevents the background page from snapping upward when the drawer opens and back downward when it closes. Scroll-position scripting is not used for this purpose.

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
- hover/focus/active treatment.

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
- fixed header and viewport-fixed drawer geometry;
- desktop/mobile header-space compensation;
- drawer-owned non-underlined link presentation;
- `<html>` + `<body>` open-state scroll locking;
- non-pannable backdrop;
- vertically pannable drawer;
- rejection of the retired `absolute + 100dvh` implementation.

These checks are part of R8's browser-contract layer even though the real-device corrections landed after v1.23.0. Future navigation changes should extend this owner/test pair rather than adding another hotfix stylesheet or competing input owner.
