# Shadow Garden Architecture

This directory records both the **R0 frozen v1.15.14 starting baseline** and the accepted **R10 v2.0.0 baseline** after the full incremental refactor.

## Baselines

- [`V1_BASELINE.md`](./V1_BASELINE.md) — original runtime surfaces, dependency direction, Reader invariants, identity formats, and duplicate ownership at the start of R0.
- [`v1-entrypoints.json`](./v1-entrypoints.json) — historical R0 entrypoint contract updated only for intentional replacements during the refactor.
- [`V2_BASELINE.md`](./V2_BASELINE.md) — final v2 domain/UI/Reader/Keeper/Functions/design/test/build/security ownership baseline.
- [`v2-entrypoints.json`](./v2-entrypoints.json) — frozen v2 direct/runtime entrypoint manifest.
- [`PERSISTENCE_CONTRACTS.md`](./PERSISTENCE_CONTRACTS.md) — browser-local localStorage/IndexedDB contracts, cookies, and migration rules retained across the cutover.
- [`HTTP_STORAGE_CONTRACTS.md`](./HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and private B2 namespaces retained across the cutover.

## R1 repository/tooling contracts

- [`MODULE_CONVENTIONS.md`](./MODULE_CONVENTIONS.md) — naming, ownership, DOM/state, CSS, dependency direction, and placement conventions.
- [`BUILD_CONTRACT.md`](./BUILD_CONTRACT.md) — authored/generated boundaries, root policy, Node/CI policy, dependency strategy and build-time asset cache-busting.
- [`r1-legacy-source-exceptions.json`](./r1-legacy-source-exceptions.json) — retired-source tombstone manifest. R10 leaves `grandfatheredPatchStyleFiles` empty.

## R2 shared browser domain

- [`DOMAIN_LAYER.md`](./DOMAIN_LAYER.md) — canonical catalog, identity, progress, bookmarks, reading state, preferences, URL, formatting and compatibility ownership introduced in v1.16.0.
- Implementation: `src/assets/js/domain/`.

## R3 public Library/Series UI

- [`PUBLIC_UI_LAYER.md`](./PUBLIC_UI_LAYER.md) — Library/Series controllers, query/render ownership, shared volume actions, refresh lifecycle and removed post-render repair layers introduced in v1.17.0.

## v2.1 fan-translation provenance

- [`TRANSLATION_METADATA.md`](./TRANSLATION_METADATA.md) — structured fan translator/group credits, translation status, series-to-volume inheritance, Library filtering, Series attribution, and Garden Keeper write ownership.

## R4 + R4.1 Reader application

- [`READER_LAYER.md`](./READER_LAYER.md) — authorized Reader session, orchestrator/controllers, Page/Continuous adapters, canonical Page Map/state ownership, Pages-only navigation input and isolated image focus.
- Continuous EPUB documents receive no Reader-owned `touchmove` or page-wide `touch-action` override.

## R5 Garden Keeper application

- [`KEEPER_LAYER.md`](./KEEPER_LAYER.md) — single AdminClient, composition root, signed-session boundary, isolated workflows and contained Upload internals introduced in v1.20.0 and finalized by R10.
- v2 direct entrypoints are `admin/core.js` and `admin/app.js` only.
- R10 deletes the old R5-era alternate owners and renames the final active `admin-upload-polish.js` path to semantic `admin-upload-presentation.js`.

## R6 Pages Functions service layer

- [`FUNCTIONS_LAYER.md`](./FUNCTIONS_LAYER.md) — thin Pages Function routes over explicit Authentication, Media, Catalog, Storage, Validation, Abuse, HTTP and Admin services introduced in v1.21.0.
- M8 persistent public cooldown enforcement remains outside `/media/*`; Range delivery remains signed-ticket authorized.

## R7 CSS and design system

- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — semantic public, Library, Reader and Garden Keeper CSS ownership introduced in v1.22.0.
- R10 completes the direct Keeper cutover: `admin.html` now uses `admin-series-editor.css` and `admin-layout.css`; the R7 alias files are deleted.
- Public/Keeper foundation tokens remain scoped to `site.css`; Reader chrome/theme tokens remain Reader-scoped.

## R8 test architecture and fixtures

- [`TEST_ARCHITECTURE.md`](./TEST_ARCHITECTURE.md) — deterministic unit/service/DOM/browser-contract testing introduced in v1.23.0.
- Fixtures cover Main/Adult, single/multi-volume, long metadata, visual EPUB pages, reading-state variants and valid/tampered/expired media tickets.
- R8's service tests permanently restrict signed EPUB ticket normalization to `/media/shadow-garden/books/`.

## Reconciled real-device navigation contract

- [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md) — v1.23.1–v1.23.5 mobile drawer corrections.
- `nav.js` owns portal/lifecycle/accessibility; `nav.css` owns viewport geometry, fixed-open header, layout compensation, presentation and document/background scroll lock.
- `tests/browser/mobile-nav-viewport.test.mjs` guards the contract.

## R9 build and deployment layer

- [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) — locked dependency/install contract, direct-dependency audit, deterministic build metadata, CI pins, dependency-free preview and explicit no-bundler decision introduced in v1.24.0.
- `package-lock.json` is committed at lockfile version 3; Verify CI uses `npm ci`, Node 22 and `contents: read`.
- `tools/lib/build-context.mjs` owns version/commit/branch/build-time context.

## R10 final cutover and release gate

R10 establishes v2.0.0 and removes the final known obsolete compatibility/patch pathnames:

- no grandfathered patch-style JS/CSS source remains;
- no old R5 Garden Keeper alternate owner remains;
- no R7 Keeper CSS alias remains;
- authored `src/` no longer carries local `?v=` release-history queries; build-time stamping is the sole cache-busting owner;
- `v2-entrypoints.json` and `V2_BASELINE.md` freeze the new major-version architecture;
- `.github/workflows/release-v2.yml` waits for successful main Verify plus the matching Cloudflare production deployment/smoke before creating the v2.0.0 GitHub release.

## Permanent guardrails

- `tools/check-r0.mjs` — frozen behavior/security/persistence contracts.
- `tools/check-r1.mjs` — repository layout, naming, build boundaries, CI pins, dead-file manifest and asset versioning.
- `tools/check-r2.mjs` — canonical domain/state ownership.
- `tools/check-r3.mjs` — single-owner Library/Series rendering and volume actions.
- `tools/check-r4.mjs` + `tools/check-r4-1.mjs` — Reader session/application/input/image-focus contracts.
- `tools/check-r5.mjs` — final Keeper shell/client/session/workflow ownership and R10 dead-owner removal.
- `tools/check-r6.mjs` — Functions service ownership and security separation.
- `tools/check-r7.mjs` — final semantic CSS cascade/variants/accessibility and Keeper direct semantic entrypoints.
- `tools/check-r8.mjs` — layered test/fixture and priority-flow contracts.
- `tools/check-r9.mjs` — lockfile/build/deployment/no-bundler boundary.
- `tools/check-r10.mjs` — v2 manifest, legacy tombstones, source cache-version cleanup, docs/release gate and final major-version baseline.

Future work starts from [`V2_BASELINE.md`](./V2_BASELINE.md). A v1/R0 implementation may only be restored when it is an intentional compatibility requirement with explicit ownership and regression coverage; obsolete duplicate owners must not return.
