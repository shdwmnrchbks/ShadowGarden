# Shadow Garden CSS & Design-System Layer

**Status:** Active semantic ownership contract; v2.11F complete  
**Audit F result:** 36 authored stylesheets / 2,254 selectors / 0 literal unreferenced class candidates / 0 unused custom properties

Shadow Garden keeps CSS ownership semantic and surface-aware. Public/Garden Keeper foundation and Reader chrome/theme palettes are intentionally distinct where their responsibilities differ. Audit F removed only selectors/tokens with concrete dead-owner evidence and found no justification for a broad cascade rewrite.

## Design rules

1. Public/Garden Keeper foundation tokens remain owned by `site.css`; Reader chrome/theme variables remain Reader-scoped.
2. Shared primitives such as navigation, reading-status, volume-actions, and symbols remain behavior-neutral reusable owners.
3. Layout files own geometry rather than release history.
4. Feature sheets own feature presentation rather than post-render repair layers.
5. New permanent version/fix/polish/patch stylesheet owners are not accepted without a real current responsibility.
6. Reduced motion, increased contrast, forced colors, visible focus, Adult variants, and Reader theme variants are first-class contracts.
7. Deterministic first-paint presentation belongs in the initial document/cascade rather than deferred JavaScript style repair.

## Public Library / Series

Core semantic owners:

- `site.css` — public/Keeper foundation;
- `nav.css` — responsive navigation shell;
- `adult.css` — Adult gate/archive variants;
- `library-features.css` — shelves/filters/tags/load-more;
- `public-components.css` — shared public components/accessibility;
- `public-artwork.css` — artwork/actions/badges/tags;
- `library-layout.css` — compact Library geometry;
- `series-extra.css` — Series-specific layout/presentation;
- `reading-status.css`, `volume-actions.css`, `ui-symbols.css` — shared primitives.

The mobile navigation portal/header/scroll-lock contract remains documented in [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md) and verified by deterministic + real-browser coverage.

## Reader

Reader presentation remains intentionally scoped through semantic owners including:

- `reader.css` foundation/chrome;
- Continuous rail, Page Map, completion, end-page, image-focus, accessibility, interface-theme, and presentation sheets;
- shared reading-status/volume-action/symbol primitives where behavior is genuinely shared.

Reader CSS must not become a second owner for Reader progress, gestures, Page Map, persistence, rendition lifecycle, or EPUB layout logic.

## Garden Keeper

Keeper uses `site.css` foundation plus semantic Admin sheets for shell/forms/cards, preflight, upload batch/workflow, Maintenance, Series Editor, workspace/dialog layout, components, deployed version, presentation, motion, and shared symbols.

`admin.html` owns deterministic first-paint stylesheet composition. Runtime workflow composition must not recreate a second deferred stylesheet owner.

## Audit F specificity/cascade decision

The final static audit reported 181 class tokens styled in multiple files, 137 specificity-watch selectors, and 428 `!important` declarations. Review showed the pressure is concentrated in deliberate late-loaded workflow/theme/layout compatibility layers, including Admin components, Reader themes, Library layout, and public artwork.

Those aggregate counts are **review signals**, not cleanup quotas. Sampling did not demonstrate a systemic cascade defect, and live accessibility/browser gates remained green. Broad specificity normalization would create more regression risk than measured benefit.

## Accessibility and motion authority

Behavioral acceptance remains owned by the existing real-browser suite: keyboard/focus restoration, reduced motion, forced colors, increased contrast, zoom/reflow, browser zoom, and labelled mobile Reader targets. Publication-owned EPUB content retains the separate accessibility boundary.

## Current CSS verification ownership

`npm run audit:css` is the current static ownership measurement. It reports heuristic shared/specificity candidates, rejects hard unused authored custom properties, and is run by normal Verify. Real-browser accessibility/motion/presentation tests remain the behavioral authority.

Current repository absence/reachability checks keep retired source owners from returning. Historical R7/R10 records remain history; current CSS policy does not depend on deleted milestone executables.
