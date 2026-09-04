# Post-v2.10 Entry Point & Ownership Inventory

> **Status:** 🟨 Audit A working record  
> **Execution baseline:** `1884d713f604e2db3a85f70e68cb4042ba13b6a4`  
> **Frozen architecture comparison:** [`../architecture/v2-entrypoints.json`](../architecture/v2-entrypoints.json)  
> **Findings register:** [`POST_V2_10_AUDIT.md`](./POST_V2_10_AUDIT.md)

This file records current ownership evidence without rewriting the frozen R10/v2.0.0 manifest. The v2 manifest is a historical cutover baseline; later releases are expected to add legitimate modules.

The inventory is used to answer three questions:

1. Is there still one clear owner for each responsibility?
2. Is a post-v2 file an intentional current module, a compatibility facade, a test/tool input, or dead/obsolete source?
3. Did later feature work recreate a duplicate/patch owner that the v2 cutover intentionally removed?

## Public Library and Series

The frozen v2 manifest continues to define the original direct Main, Adult, and Series HTML/CSS/script ordering and the canonical runtime owners:

- `src/assets/js/library.js`
- `src/assets/js/library-model.js`
- `src/assets/js/library-renderers.js`
- `src/assets/js/series.js`
- `src/assets/js/series-renderers.js`
- `src/assets/js/public/volume-actions.js`
- `src/assets/js/domain/`
- shared navigation, data-source, accessibility, motion, and version presentation helpers

Audit A has not found evidence that the old tombstoned public repair owners returned. Deeper duplication and realistic-scale rerender/filter cost belongs to Audit C.

## Reader

### v2.0 baseline owners

The frozen manifest records the Reader application/session plus storage, theme, TOC, Page Map, settings, progress, bookmarks, page input, image focus, completion, Paginated, Continuous, and rendition owners.

### Intentional post-baseline modules observed at v2.10

Current Reader source additionally includes modules introduced by later reliability/Reader Experience work, including:

- `reader/book-search.js` — bounded whole-book search used by the current Reader app/TOC flow.
- `reader/resume-controller.js` — resume/background/reload lifecycle ownership used by the Reader app.
- `reader/error-presentation.js` — Reader-owned graceful error presentation.
- `reader/interaction-controller.js` — post-baseline interaction coordination.
- `reader/navigation-state.js` — small navigation-state helper.
- `reader/image-focus-touch-compat.js` — explicit touch compatibility helper for isolated image focus.

These files are not automatically architectural drift merely because they are absent from the frozen v2.0 manifest. Audit B must determine whether their responsibilities overlap or are still cleanly composed.

### Confirmed cache-version drift

`reader/app.js` currently imports:

- `./toc.js?v=1.2.3`
- `./page-map.js?v=1.2.0`
- `./book-search.js?v=2.8.1`

This conflicts with the accepted build contract that deployment-time stamping owns local asset cache versions. The audit therefore records a justified cleanup candidate, but runtime code will not change until the complete authored-source scope is established.

## Garden Keeper

### v2.0 baseline owners

The frozen manifest records the two direct Keeper entrypoints:

- `src/assets/js/admin/core.js`
- `src/assets/js/admin/app.js`

and the original auth/session, Library, translation, Maintenance, History, Trash, Abuse, version, Upload internals, shell, motion, flavor, and direction helpers.

### Intentional post-baseline modules observed at v2.10

The current `admin/app.js` composition root explicitly loads later Keeper Productivity & Recovery modules:

- `admin/bulk-edit-workflow.js`
- `admin/bulk-edit-fixes.js`
- `admin/bulk-artwork-workflow.js`
- `admin/recovery-readiness-workflow.js`
- `admin/upload-preflight-report.js`
- `admin/upload-similar-volume.js`

The composition root still initializes a single workflow registry and explicitly keeps Upload internals from replacing shared API/auth/Library/Maintenance/History/Trash/Abuse owners. File growth therefore does not by itself justify a Keeper refactor. Audit D owns the deeper workflow/duplication review.

## Pages Functions

The R6 service architecture remains centered on:

- `functions/services/http.js`
- `functions/services/storage.js`
- `functions/services/auth.js`
- `functions/services/media.js`
- `functions/services/catalog.js`
- `functions/services/validation.js`
- `functions/services/abuse.js`
- `functions/services/admin.js`

Historical R6 source checks require thin route adapters and reject route-level reach-through into `_lib/` implementations.

### Compatibility facade candidates

Two explicit R6 compatibility facades require follow-up before deletion:

- `functions/_lib/b2.js` — re-exports canonical Storage/Auth/HTTP service ownership and contains no second implementation.
- `functions/_lib/garden-maintenance.js` — historical facade over Catalog/Validation service ownership.

`tools/check-r6.mjs` still asserts these paths must remain facade-only. Audit A has not yet established whether current runtime/tests/tools consume the facade paths, so removal is not authorized yet.

## Historical architecture checkers

The repository still contains `tools/check-r0.mjs` through `tools/check-r10.mjs`, but current `package.json#scripts.check` does not invoke that historical sequence. The active check chain instead uses modern repository, dependency, runtime/lockfile, documentation, release, maintenance-baseline, and performance-sanity checks.

This creates a distinction that the audit must resolve:

- **historical checker exists** does not mean **active gate still enforces it**;
- several historical scripts contain self-assertions and roadmap/source assumptions that no longer match current post-v2 documentation/source;
- some historical behaviors are now covered by unit/service/browser/E2E tests or newer checks;
- re-enabling all old source-regex checks would be unsafe without first mapping overlap and obsolescence.

Audit G owns the final decision for each checker: modernize, replace with behavior coverage, intentionally retain standalone, or archive/remove.

## Tombstoned owners

[`../architecture/r1-legacy-source-exceptions.json`](../architecture/r1-legacy-source-exceptions.json) records the retired patch/duplicate public, Reader, Keeper, and CSS paths. It currently has an empty `grandfatheredPatchStyleFiles` list.

Audit A has not identified a known tombstoned path returning. The complete repository scan remains the final authority before this item is closed.

## Audit A decision summary

| Area | Current decision |
| --- | --- |
| Frozen v2 manifest | Keep immutable; it is history, not moving inventory. |
| Public Library/Series ownership | No refactor from inventory evidence; continue Audit C. |
| Reader post-v2 modules | No refactor from file count; continue Audit B. |
| Keeper post-v2 modules | No refactor from file count; continue Audit D. |
| R6 facades | Investigate consumers before retain/remove decision. |
| Historical R0–R10 checkers | Investigate in Audit G; do not re-enable wholesale. |
| Reader hard-coded local `?v=` imports | Refactor/cleanup justified after full authored-source scope is established. |
| Known tombstoned patch owners | No change needed unless full scan finds a return. |
