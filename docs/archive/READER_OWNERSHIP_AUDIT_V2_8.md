# Reader Ownership Audit — v2.8

> **Status:** 🗄️ Archived completed audit  
> **Completed in:** v2.8.0 Reader Experience  
> **Audit date:** 2026-09-01

This document preserves the focused Reader ownership audit performed during v2.8. It is historical evidence, not a current architecture contract. Current Reader ownership is defined by [`../architecture/READER_LAYER.md`](../architecture/READER_LAYER.md), and the active v2.11 audit methodology is defined by [`../architecture/ENGINEERING_AUDIT.md`](../architecture/ENGINEERING_AUDIT.md).

## Scope

Focused audit of Reader progress presentation, Pages/Continuous synchronization, accessibility writers, mobile image activation, Page Map fallback boundaries, and retained EPUB.js compatibility adapters.

## Findings

### 1. Canonical progress had an incidental Continuous synchronization path

`reader/progress-controller.js` already owned canonical progress formatting and the normal range/text surface, but `reader-continuous-rail.js` reconstructed its presentation by observing `#progressText` mutations and reading `data-rail` / `data-accessible` attributes. This made DOM mutation an internal state bus and allowed accessibility writers to drift into duplicate ownership.

**Action:** replaced the observer/data-attribute contract with explicit `sg:reader-progress` presentation events. The rail remains a seek proxy and presentation mirror only.

### 2. Mobile image-tap compatibility was loaded from the wrong owner

`reader-a11y.js` dynamically loaded `reader-mobile-reliability.js`, even though the bridge exists only to compensate for coarse-pointer image activation delivery inside EPUB iframes and Safari parent hit targets. Accessibility therefore owned the lifetime of an unrelated interaction workaround.

**Action:** moved the compatibility module under `reader/image-focus-touch-compat.js`, load it from Reader bootstrap, and retire the old top-level path. The compatibility module converts short TouchEvent taps into the existing click path; `reader/image-focus.js` remains the owner of focus state and presentation.

### 3. Large Reader compatibility modules are not automatically refactor candidates

`reader-continuous-core.js`, `reader-epub-adapter.js`, `reader-visual-cache.js`, and `reader/page-map.js` are comparatively large and have accumulated corrective history. In this audit, however, their boundaries remain distinguishable: Continuous lifecycle, EPUB.js normalization, visual preprocessing/cache, and canonical device Page Map respectively.

**Action:** no split or rewrite in this audit. Revisit only when a future feature requires repeated cross-owner edits or introduces a second state writer.

### 4. Architecture documentation had stale ownership guidance

`READER_LAYER.md` still described CSS consolidation as future R7 work and did not document the v2.8 progress-presentation or mobile compatibility seams.

**Action:** reconciled the document with the current Reader ownership model and explicitly recorded retained compatibility boundaries.

## Guardrails added

`tests/unit/reader-ownership.test.mjs` protects the two corrected seams:

- Continuous progress must consume `sg:reader-progress` and must not regress to MutationObserver/data-attribute synchronization.
- Mobile image compatibility must be loaded from Reader startup, not accessibility, and the obsolete top-level bridge must remain absent.

Existing real-browser mobile Reader coverage continues to verify that a single image tap opens focus mode and that Continuous native scrolling remains reliable.

## Recommendation after audit

Do not perform a broader Reader rewrite now. The meaningful ownership drift found by this audit is localized and can be corrected without restructuring the large EPUB.js/Continuous compatibility modules. Continue v2.8 work on the reconciled boundaries and trigger another focused audit only if the same owners begin receiving repeated corrective fixes again.
