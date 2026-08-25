# Shadow Garden Architecture

This directory is the refactor contract surface for Shadow Garden. It begins with the **R0 frozen v1.15.14 baseline** and is extended as ownership becomes explicit.

## Frozen v1 baseline

- [`V1_BASELINE.md`](./V1_BASELINE.md) — runtime surfaces, dependency direction, Reader invariants, identity formats, and original duplicate ownership.
- [`PERSISTENCE_CONTRACTS.md`](./PERSISTENCE_CONTRACTS.md) — browser-local localStorage/IndexedDB contracts, cookies, and migration rules.
- [`HTTP_STORAGE_CONTRACTS.md`](./HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and private B2 namespaces.
- [`v1-entrypoints.json`](./v1-entrypoints.json) — machine-readable entrypoint contract updated only for intentional refactor replacements.

## R1 repository/tooling contracts

- [`MODULE_CONVENTIONS.md`](./MODULE_CONVENTIONS.md) — naming, ownership, DOM/state, CSS, dependency direction, and placement conventions.
- [`BUILD_CONTRACT.md`](./BUILD_CONTRACT.md) — authored/generated boundaries, root policy, Node/CI policy, dependency strategy, asset cache-busting, and the R8 `tests/` source boundary; finalized by R9.
- [`r1-legacy-source-exceptions.json`](./r1-legacy-source-exceptions.json) — grandfathered v1 patch-style files plus refactor-proven removals.

## R2 shared browser domain

- [`DOMAIN_LAYER.md`](./DOMAIN_LAYER.md) — canonical catalog, identity, progress, bookmarks, reading state, preferences, URL, formatting, and compatibility ownership introduced in v1.16.0.
- Implementation: `src/assets/js/domain/`.

## R3 public Library/Series UI

- [`PUBLIC_UI_LAYER.md`](./PUBLIC_UI_LAYER.md) — Library/Series controllers, query/render ownership, shared volume actions, refresh lifecycle, and removed post-render repair layers introduced in v1.17.0.
- Implementations: `library.js`, `library-model.js`, `library-renderers.js`, `series.js`, `series-renderers.js`, and `public/volume-actions.js`.

## R4 + R4.1 Reader application

- [`READER_LAYER.md`](./READER_LAYER.md) — authorized book session, Reader orchestrator, rendition/Page/Continuous adapters, canonical progress/bookmark/completion/settings ownership, retained EPUB.js compatibility boundaries, Pages-only input, and isolated focused-image zoom.
- R4 shipped in v1.18.0; R4.1 stabilizes the Reader in v1.19.0 after the v1.18.1–v1.18.3 corrective releases.
- Implementation: `src/assets/js/reader/`, with `reader-bootstrap.js` as the protected startup entrypoint.

R4.1 permanently separates `page-navigation-input.js` from `image-focus.js`. EPUB documents receive no Reader-owned `touchmove` or `touch-action` override, so Continuous vertical touch scrolling remains native. Magnification exists only in the top-level focused-image overlay; the live EPUB viewport is never scaled.

## R5 Garden Keeper application

- [`KEEPER_LAYER.md`](./KEEPER_LAYER.md) — Garden Keeper composition root, single admin client, signed-session boundary, isolated workflows, contained Upload internals, lifecycle events, and Keeper security invariants introduced in v1.20.0.
- Direct entrypoints: `admin/core.js` and `admin/app.js`.
- First-class workflow owners: Authentication/session, shell, Library/Series, Maintenance, Catalog History, Trash & Recovery, Abuse Watch, and deployed version.
- Upload remains internally composed because local EPUB validation/batch processing is substantial, but those internals are contained behind the R5 application root and no longer replace the shared API/session or Library/Series owners.

## R6 Pages Functions service layer

- [`FUNCTIONS_LAYER.md`](./FUNCTIONS_LAYER.md) — thin Cloudflare Pages Function routes over explicit Authentication, Media, Catalog, Storage, Validation, Abuse, HTTP, and small Admin services introduced in v1.21.0.
- Implementation: `functions/services/`.
- Routes retain the established URLs and response/security contracts but no longer own B2 operations, ticket/session verification, catalog persistence, or abuse policy.
- `_lib/b2.js` and `_lib/garden-maintenance.js` are compatibility facades; the accepted cryptographic/throttle/identity primitives remain in `_lib/` beneath the service layer.

R6 preserves the high-risk boundary that M8 public cooldown enforcement belongs on acquisition/human-verification endpoints, not `/media/*`. Range requests continue through signed-ticket authorization without persistent cooldown enforcement, and invalid-ticket scoring remains suppressed for stale Range retries.

## R7 CSS and design system

- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — semantic public, Library, Reader, and Garden Keeper CSS ownership introduced in v1.22.0, including cascade order and accessibility/variant contracts.
- Historical public/Reader/runtime-Keeper `current`, `polish`, version-number, scale, and alignment sheets are retired and guarded from returning.
- Public/Keeper foundation tokens remain intentionally scoped to `site.css`; Reader chrome/theme tokens remain scoped to `reader.css` and `reader-interface-themes.css`.
- The two R0-frozen Keeper direct historical CSS paths are selector-free aliases only; real styling lives in `admin-series-editor.css` and `admin-layout.css` until final R10 entrypoint cleanup.

## R8 test architecture and fixtures

- [`TEST_ARCHITECTURE.md`](./TEST_ARCHITECTURE.md) — layered deterministic testing introduced in v1.23.0.
- `tests/unit/` covers pure/domain and browser-local state/model/input behavior.
- `tests/service/` exercises real server modules for signed media tickets, Keeper bearer + signed-session authorization, upload/catalog validation, and Garden Health without external network calls.
- `tests/dom/` exercises public renderer ownership with narrow deterministic DOM doubles.
- `tests/browser/` provides browser-contract smoke coverage for Main/Adult/Series/Reader/Keeper entrypoints, visual EPUB XHTML pages, Pages vs Continuous input behavior, isolated image focus, the priority **Read → Continue → Finished → Read Again** flow, and the reconciled mobile-navigation viewport/scroll-lock contract.
- Shared fixtures cover Main/Adult, single/multi-volume, long metadata, visual cover/map/illustration pages, reading-state variants, and valid/tampered/expired media tickets.
- R8's service tests exposed and corrected a signed-ticket namespace gap: EPUB tickets now normalize only under `/media/shadow-garden/books/`, so a normalized traversal cannot escape the canonical books namespace.
- The suite uses Node 22's built-in test runner; R8 adds no test framework or headless-browser dependency.

## Reconciled real-device navigation contract

- [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md) records the v1.23.1–v1.23.5 mobile drawer corrections without creating another refactor milestone.
- `nav.js` owns body-level drawer portal/lifecycle/accessibility state; `nav.css` owns viewport geometry, fixed-open header, header-space compensation, Main/Adult presentation, touch behavior, and document/background scroll locking.
- `tests/browser/mobile-nav-viewport.test.mjs` permanently guards those corrections under R8's browser-contract layer.

## R9 build and deployment layer

- [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) — locked dependency/install contract, direct-dependency ownership audit, deterministic build metadata, CI action/runtime pins, dependency-free preview, and explicit no-bundler decision introduced in v1.24.0.
- `package-lock.json` is committed at lockfile version 3; CI uses `npm ci` and remains `contents: read`.
- `tools/lib/build-context.mjs` is the sole version/commit/branch/build-time context owner used by build and deployment metadata writers.
- `tools/preview.mjs` replaces unpinned `npx serve` with a Node 22 built-in static preview server.
- R9 intentionally retains all five direct dependencies because each has an explicit Reader/Functions/build/B2-tooling owner.

## Permanent guardrails

- `tools/check-r0.mjs` protects frozen behavior/security/persistence contracts when owners move.
- `tools/check-r1.mjs` protects repository layout, source naming, build boundaries, CI pins, dead-file removal, and asset versioning.
- `tools/check-r2.mjs` protects canonical domain/state ownership and Unread / In Progress / Finished transitions.
- `tools/check-r3.mjs` protects single-owner Library/Series rendering and parity across all volume entry points.
- `tools/check-r4.mjs` protects the core R4 Reader session/application/state boundaries.
- `tools/check-r4-1.mjs` protects post-R4 stabilization: Reader startup wiring, split input ownership, native Continuous touch behavior, isolated image zoom, focus/chrome behavior, and removal of Reader-wide zoom remnants.
- `tools/check-r5.mjs` protects the Garden Keeper shell/client/session ownership and isolated workflows.
- `tools/check-r6.mjs` protects thin Functions routes, explicit service ownership, storage/validation boundaries, and the signed Range/M8 security separation.
- `tools/check-r7.mjs` protects semantic CSS cascade order, surface ownership, accessibility/variant rules, cache freshness, and retirement of historical patch/version layers.
- `tools/check-r8.mjs` protects the four test layers, required fixture families, priority reading/Reader/Keeper/security smoke coverage, package scripts, documentation, and v1.23.0 milestone status; post-R8 real-device navigation behavior is additionally guarded by the browser smoke suite.
- `tools/check-r9.mjs` protects the lockfile/install boundary, Node/action pins, deterministic build context, dependency audit/no-bundler decision, generated output, preview ownership, documentation, and R10-next status.

R10 may replace a frozen implementation only when the new owner is intentional, documented here, and covered by equivalent or stronger regression checks.
