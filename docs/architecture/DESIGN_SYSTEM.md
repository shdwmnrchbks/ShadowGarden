# Shadow Garden CSS & Design-System Layer

**Milestone:** R7  
**Release:** v1.22.0  
**Status:** Complete

R7 replaces historical CSS patch/version ownership with semantic styling responsibilities while preserving the accepted Main, Adult, Reader, and Garden Keeper visual behavior. It is a cascade-ownership refactor, not a redesign.

## Design rules

1. **Tokens stay surface-scoped where palettes intentionally differ.** `site.css` owns the public/Garden Keeper foundation variables (`--bg`, `--panel`, `--line`, `--text`, `--leaf`, typography, etc.). `reader.css` owns Reader chrome/theme variables because Reader palettes and EPUB surfaces are intentionally independent.
2. **Primitives remain reusable and behavior-neutral.** `nav.css`, `ui-symbols.css`, `reading-status.css`, and `volume-actions.css` remain shared component/primitives rather than being copied into page-specific sheets.
3. **Layout files describe geometry, not release history.** Library compact geometry lives in `library-layout.css`; Garden Keeper workspace geometry lives in `admin-layout.css`.
4. **Feature sheets own feature presentation.** Reader Page Map, Continuous rail, image focus, accessibility, end page, themes, Keeper Upload/preflight/maintenance, Adult variants, and Series-specific presentation remain separate owners.
5. **No new permanent `-current`, `-polish`, `-fix`, `-patch`, or version-number CSS owners.** The R1 naming guard continues to enforce this.
6. **Accessibility variants are first-class CSS contracts.** Reduced motion, increased contrast, forced colors, focus-visible styling, Adult variants, and Reader theme variants may not disappear during consolidation.

## Public Library + Series ownership

The public foundation remains `site.css`; its initial `:root` block is the public/Keeper token owner and its base rules establish the shared Library/Series structure.

Semantic layers:

- `nav.css` — navigation shell and responsive navigation.
- `adult.css` — Adult gate/archive palette and Adult-specific components.
- `library-features.css` — Recently Added, advanced filters, tag chips, load-more/sentinel behavior, and their responsive layout.
- `public-components.css` — skip link/focus treatment, shared archive/header components, pinned navigation/card presentation, mobile filter collapse, Adult chrome parity, and public accessibility media queries.
- `public-artwork.css` — Library/Series artwork, compact badges, Continue cover, Series primary actions, and navigable Series tags.
- `library-layout.css` — final compact-card column and badge-rail geometry.
- `series-extra.css` — Series-only layout/presentation that predates and remains independent from shared public components.
- `reading-status.css`, `volume-actions.css`, `ui-symbols.css` — shared primitives.

### Public cascade contract

Main Library:

```text
site → nav → library-features → public-components → public-artwork
     → library-layout → reading-status → volume-actions → ui-symbols
```

Adult Library inserts `adult.css` after `nav.css`. Series replaces Library feature/layout sheets with `adult.css` + `series-extra.css`, then uses `public-components` and `public-artwork` in the same order.

The source order deliberately matches the pre-R7 computed cascade positions of the retired sheets.

### Reconciled responsive navigation contract

Real-device fixes in v1.23.1–v1.23.5 did not create a new style owner. They clarified what `nav.css` and `nav.js` must own together:

- `nav.js` portals the responsive drawer to `document.body` so fixed geometry is not constrained by the filtered/sticky header in mobile Chromium.
- `nav.css` owns the fixed drawer/header/backdrop geometry and complete drawer link/button presentation because portaled controls can no longer depend on `.site-header nav ...` ancestry.
- While open, the fixed header's removed flow space is compensated on `body.site-nav-open` (72px normally, 62px on mobile) so the background page does not jump.
- `<html>` and `<body>` share the open-state scroll lock; the backdrop is non-pannable while the drawer remains vertically pannable/scrollable.
- Main and Adult variants remain selector-scoped under the same `nav.css` owner.

The complete contract is documented in [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md) and guarded by R8's `tests/browser/mobile-nav-viewport.test.mjs`. These corrections are stabilization of the R7 owner, not a new patch stylesheet.

## Reader ownership

- `reader.css` — Reader token/chrome foundation and core layout.
- `reader-continuous-rail.css` — Continuous seek rail.
- `reader-page-map.css` — Page Map UI.
- `reader-completion.css` — settings toggle plus volume-completion presentation formerly held by a generic polish sheet.
- `reader-end-page.css` — explicit end-page layout.
- `reading-status.css` — shared Finished/read-state primitive.
- `reader-image-focus.css` — isolated image-focus overlay.
- `reader-a11y.css` — Reader accessibility adaptations.
- `reader-interface-themes.css` — Reader interface theme palettes.
- `reader-presentation.css` — Paper surface, loading motion, and flow-specific visibility formerly held by a version-number sheet.
- `ui-symbols.css` — shared symbol normalization.

R7 changes no Reader gesture, Page Map, Visual Page Cache, flow, progress, bookmark, or EPUB layout ownership.

## Garden Keeper ownership

The Keeper continues to consume the public foundation tokens from `site.css` plus its own base and feature sheets:

- `admin.css` — base Keeper shell/forms/cards.
- `admin-preflight.css` — EPUB preflight feature.
- `admin-batch.css` — upload batch feature.
- `admin-maintenance.css` — Maintenance feature.
- `admin-series-editor.css` — Series Editor dialog/accessibility/toast behavior.
- `admin-layout.css` — Manage Library/workspace/dialog geometry.
- `admin-components.css` — Upload state, preflight collapse, upload-series cards, and Catalog History component presentation.
- `admin-version.css` — deployed-version component.
- `admin-presentation.css` — Series banner chooser/preview.
- `ui-symbols.css` — shared symbol normalization.

`admin/app.js` now loads `admin-components.css`, `admin-version.css`, and `admin-presentation.css`; it no longer loads `admin-current.css` or `admin-v1.9.4.css`.

### Keeper compatibility aliases

`admin.html` is an R0-frozen entrypoint and still contains two historical direct CSS paths. To avoid rewriting the large Keeper HTML in the same slice, R7 reduces them to selector-free aliases:

- `admin-series-editor-polish.css` → imports `admin-series-editor.css`.
- `admin-overhaul.css` → imports `admin-layout.css`.

Those files contain no styling rules and cannot act as patch owners. R10 may remove the aliases when the final legacy-entrypoint cutover is performed.

## Retired R7 CSS owners

The following source files are deleted and recorded in the R1 dead-file manifest:

- `site-current.css`
- `site-v1.9.4.css`
- `library-scale.css`
- `library-compact-alignment.css`
- `reader-polish.css`
- `reader-v1.10.1.css`
- `admin-current.css`
- `admin-v1.9.4.css`

## Accessibility and variant contracts

R7 preserves:

- `prefers-reduced-motion` behavior on public UI, Reader loading/completion, and Keeper motion.
- public `prefers-contrast: more` and `forced-colors: active` rules.
- keyboard `:focus-visible` treatment.
- Main vs Adult archive palettes and Adult Series state.
- Reader Garden/Night/Black/Paper interface variants and `adult-reader` chrome.
- native Continuous touch behavior and isolated Reader image-focus zoom from R4.1.

## Permanent R7 guard

`tools/check-r7.mjs` verifies semantic stylesheet order, ownership markers, deleted historical CSS, selector-free Keeper aliases, Keeper semantic runtime loading, accessibility/variant markers, cache headers, documentation state, and release version.

R8's browser-contract suite now additionally guards the reconciled responsive-navigation behavior. Future CSS changes must preserve the R7 ownership contract and cannot reintroduce release-history styling layers.
