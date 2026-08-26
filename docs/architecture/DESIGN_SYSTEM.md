# Shadow Garden CSS & Design-System Layer

**Milestone:** R7  
**Release:** v1.22.0  
**Status:** Complete; final legacy entrypoints removed by R10/v2.0.0

R7 replaced historical CSS patch/version ownership with semantic styling responsibilities while preserving Main, Adult, Reader, and Garden Keeper visual behavior. R10 completes that design-system cutover by removing the final Keeper compatibility aliases.

## Design rules

1. **Tokens stay surface-scoped where palettes intentionally differ.** `site.css` owns the public/Garden Keeper foundation variables. `reader.css` owns Reader chrome/theme variables because Reader palettes and EPUB surfaces are intentionally independent.
2. **Primitives remain reusable and behavior-neutral.** `nav.css`, `ui-symbols.css`, `reading-status.css`, and `volume-actions.css` remain shared component/primitives rather than being copied into page-specific sheets.
3. **Layout files describe geometry, not release history.** Library compact geometry lives in `library-layout.css`; Garden Keeper workspace geometry lives in `admin-layout.css`.
4. **Feature sheets own feature presentation.** Reader Page Map, Continuous rail, image focus, accessibility, end page, themes, Keeper Upload/preflight/maintenance, Adult variants, and Series-specific presentation remain separate owners.
5. **No permanent `-current`, `-polish`, `-fix`, `-patch`, or version-number CSS owners.** The R1/R10 guards enforce this.
6. **Accessibility variants are first-class CSS contracts.** Reduced motion, increased contrast, forced colors, focus-visible styling, Adult variants, and Reader theme variants may not disappear during consolidation.
7. **Deterministic presentation is first-paint ownership.** If a stylesheet, label, gate, or loading surface is known before application data arrives, it belongs to the initial document rather than a deferred runtime repair.

## Public Library + Series ownership

The public foundation remains `site.css`; its initial `:root` block is the public/Keeper token owner and its base rules establish the shared Library/Series structure.

Semantic layers:

- `nav.css` — navigation shell and responsive navigation.
- `adult.css` — Adult gate/archive palette and Adult-specific components.
- `library-features.css` — Recently Added, advanced filters, tag chips, load-more/sentinel behavior, and their responsive layout.
- `public-components.css` — skip link/focus treatment, shared archive/header components, pinned navigation/card presentation, mobile filter collapse, Adult chrome parity, and public accessibility media queries.
- `public-artwork.css` — Library/Series artwork, compact badges, Continue cover, Series primary actions, and navigable Series tags.
- `library-layout.css` — final compact-card column and badge-rail geometry.
- `series-extra.css` — Series-only layout/presentation that remains independent from shared public components.
- `reading-status.css`, `volume-actions.css`, `ui-symbols.css` — shared primitives.

### Public cascade contract

Main Library:

```text
site → nav → library-features → public-components → public-artwork
     → library-layout → reading-status → volume-actions → ui-symbols
```

Adult Library inserts `adult.css` after `nav.css`. Series replaces Library feature/layout sheets with `adult.css` + `series-extra.css`, then uses `public-components` and `public-artwork` in the same order.

### Reconciled responsive navigation contract

Real-device fixes in v1.23.1–v1.23.5 established the body-level drawer portal. v2.6 real-browser testing kept that portal while reconciling header layering under document scroll lock:

- `nav.js` portals the responsive drawer to `document.body` so fixed geometry is not constrained by the filtered/sticky header in mobile Chromium.
- `nav.css` owns the fixed drawer/backdrop geometry and complete drawer link/button presentation because portaled controls cannot depend on `.site-header nav ...` ancestry.
- The baseline site header remains sticky during ordinary page use; open state promotes it to a viewport-fixed layer above the drawer so it cannot be painted behind the body-level overlay.
- A matching 72px/62px body spacer preserves the header's normal-flow height while it is temporarily fixed, so the open/close transition does not move underlying content.
- `scrollbar-gutter: stable` remains responsible for stable scrollbar allocation; no scroll-position scripting is used.
- `<html>` and `<body>` share the open-state scroll lock; the backdrop is non-pannable while the drawer remains vertically pannable/scrollable.
- Real-browser coverage verifies actual top-layer paint ownership with `elementFromPoint()`, not only header geometry.
- Main and Adult variants remain selector-scoped under the same `nav.css` owner.

The complete contract is documented in [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md) and guarded by R8's `tests/browser/mobile-nav-viewport.test.mjs` plus the v2.6 Library E2E suite.

## Reader ownership

- `reader.css` — Reader token/chrome foundation and core layout.
- `reader-continuous-rail.css` — Continuous seek rail.
- `reader-page-map.css` — Page Map UI.
- `reader-completion.css` — settings toggle plus volume-completion presentation.
- `reader-end-page.css` — explicit end-page layout.
- `reading-status.css` — shared Finished/read-state primitive.
- `reader-image-focus.css` — isolated image-focus overlay.
- `reader-a11y.css` — Reader accessibility adaptations.
- `reader-interface-themes.css` — Reader interface theme palettes.
- `reader-presentation.css` — Paper surface, loading motion, and flow-specific visibility.
- `ui-symbols.css` — shared symbol normalization.

R7/R10 change no Reader gesture, Page Map, Visual Page Cache, flow, progress, bookmark, or EPUB layout ownership.

## Garden Keeper ownership

The Keeper consumes public foundation tokens from `site.css` plus explicit feature owners:

- `motion.css` — shared motion timing and navigation primitives.
- `admin.css` — base Keeper shell/forms/cards.
- `admin-preflight.css` — EPUB preflight feature.
- `admin-batch.css` — upload batch feature.
- `admin-maintenance.css` — Maintenance feature.
- `admin-series-editor.css` — Series Editor dialog/accessibility/toast behavior.
- `admin-layout.css` — Manage Library/workspace/dialog geometry.
- `admin-components.css` — Upload state, preflight collapse, upload-series cards, and Catalog History component presentation.
- `admin-version.css` — deployed-version component.
- `admin-presentation.css` — Series banner chooser/preview.
- `admin-motion.css` — Keeper-specific motion presentation and reduced-motion fallback.
- `ui-symbols.css` — shared symbol normalization.

`admin.html` directly owns this complete semantic cascade. That is intentional first-paint behavior: Keeper must not render its base shell and then append component, version, presentation, or motion styles after deferred JavaScript starts. R10 deleted the selector-free compatibility aliases `admin-series-editor-polish.css` and `admin-overhaul.css`; there is no historical cascade pathname between the HTML and the semantic owner.

`admin/app.js` is therefore a runtime **script/workflow** composition root only. It loads the shared motion runtime, Keeper workflows, Upload modules, shell/motion controllers, flavor, and symbol behavior, but it must not create `<link>` elements or otherwise repair deterministic presentation after paint. Build-time asset stamping remains the sole local cache-busting owner.

## Retired CSS owners

The following source files are deleted and recorded in the R1 dead-file manifest:

- `site-current.css`
- `site-v1.9.4.css`
- `library-scale.css`
- `library-compact-alignment.css`
- `reader-polish.css`
- `reader-v1.10.1.css`
- `admin-current.css`
- `admin-v1.9.4.css`
- `admin-series-editor-polish.css`
- `admin-overhaul.css`

## Accessibility and variant contracts

The final design system preserves:

- `prefers-reduced-motion` behavior on public UI, Reader loading/completion, and Keeper motion.
- public `prefers-contrast: more` and `forced-colors: active` rules.
- keyboard `:focus-visible` treatment.
- Main vs Adult archive palettes and Adult Series state.
- Reader Garden/Night/Black/Paper interface variants and `adult-reader` chrome.
- native Continuous touch behavior and isolated Reader image-focus zoom from R4.1.

## Permanent R7/R10 guard

`tools/check-r7.mjs` verifies semantic stylesheet order, ownership markers, deleted historical CSS, direct Keeper semantic first-paint ownership, runtime script-only composition, accessibility/variant markers, cache headers, documentation state, and release floor. `tools/check-r10.mjs` additionally forbids any known legacy CSS alias or patch-style source from returning.

Future CSS changes must preserve these ownership contracts and cannot reintroduce release-history styling layers or deferred deterministic style repair.
