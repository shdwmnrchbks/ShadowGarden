# Shadow Garden Architecture

This directory records both the **R0 frozen v1.15.14 starting baseline** and the accepted **R10 v2.0.0 architecture baseline**, plus post-baseline contracts that remain authoritative for current v2 releases.

Shadow Garden v2.6.0 does not replace the v2.0 ownership model. It strengthens acceptance by making real Chromium/Firefox/WebKit behavior a permanent release gate while preserving the deterministic architecture/security layers.

## Baselines

- [`V1_BASELINE.md`](./V1_BASELINE.md) — original runtime surfaces, dependency direction, Reader invariants, identity formats, and duplicate ownership at the start of R0.
- [`v1-entrypoints.json`](./v1-entrypoints.json) — historical R0 entrypoint contract updated only for intentional replacements during the refactor.
- [`V2_BASELINE.md`](./V2_BASELINE.md) — final v2 domain/UI/Reader/Keeper/Functions/design/test/build/security ownership baseline.
- [`v2-entrypoints.json`](./v2-entrypoints.json) — frozen v2 direct/runtime entrypoint manifest.
- [`PERSISTENCE_CONTRACTS.md`](./PERSISTENCE_CONTRACTS.md) — browser-local localStorage/IndexedDB contracts, cookies, and migration rules retained across the cutover and current releases.
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

- [`TRANSLATION_METADATA.md`](./TRANSLATION_METADATA.md) — structured fan translator credits, translation status, series-to-volume inheritance, Library filtering, Series attribution, and Garden Keeper write ownership.

## R4 + R4.1 Reader application

- [`READER_LAYER.md`](./READER_LAYER.md) — authorized Reader session, orchestrator/controllers, Page/Continuous adapters, canonical Page Map/state ownership, Pages-only navigation input and isolated image focus.
- Continuous EPUB documents receive no Reader-owned `touchmove` interception; v2.6 further guards flow-specific touch policy and capability-aware mobile input behavior.
- Split-XHTML chapter title tracking uses canonical navigation/spine ownership rather than a hidden global or filename heuristic.

## R5 Garden Keeper application

- [`KEEPER_LAYER.md`](./KEEPER_LAYER.md) — single AdminClient, composition root, signed-session boundary, isolated workflows and contained Upload internals introduced in v1.20.0 and finalized by R10.
- v2 direct entrypoints are `admin/core.js` and `admin/app.js` only.
- v2.6 real-browser coverage proves auth/session, dialog focus, Series/translation, upload, Maintenance, History, Trash and Abuse Watch behavior without introducing a second workflow/request owner.

## R6 Pages Functions service layer

- [`FUNCTIONS_LAYER.md`](./FUNCTIONS_LAYER.md) — thin Pages Function routes over explicit Authentication, Media, Catalog, Storage, Validation, Abuse, HTTP and Admin services introduced in v1.21.0.
- Persistent public cooldown enforcement remains outside `/media/*`; Range delivery remains signed-ticket authorized.

## R7 CSS and design system

- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — semantic public, Library, Reader and Garden Keeper CSS ownership introduced in v1.22.0.
- Public/Keeper foundation tokens remain scoped to `site.css`; Reader chrome/theme tokens remain Reader-scoped.

## R8 deterministic test architecture

- [`TEST_ARCHITECTURE.md`](./TEST_ARCHITECTURE.md) — deterministic unit/service/DOM/browser-contract testing introduced in v1.23.0 and extended by v2.6 with the permanent Playwright layer.
- Deterministic fixtures cover Main/Adult, single/multi-volume, long metadata, visual EPUB pages, reading-state variants and valid/tampered/expired media tickets.
- R8's service tests permanently restrict signed EPUB ticket normalization to `/media/shadow-garden/books/`.

## Reconciled real-device navigation contract

- [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md) — v1.23.1–v1.23.5 mobile drawer corrections.
- `nav.js` owns portal/lifecycle/accessibility; `nav.css` owns viewport geometry, fixed-open header, layout compensation, presentation and document/background scroll lock.
- Deterministic browser guards and v2.6 real-browser tests both protect the behavior.

## R9 build and deployment layer

- [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) — locked dependency/install contract, direct-dependency audit, deterministic build metadata, CI pins, dependency-free preview and explicit no-bundler decision introduced in v1.24.0.
- `package-lock.json` is committed at lockfile version 3; Verify CI uses `npm ci`, Node 22 and `contents: read`.
- `tools/lib/build-context.mjs` owns version/commit/branch/build-time context.
- The current reusable v2 publisher additionally requires the exact main Real Browser E2E result before production smoke/release publication.

## R10 final cutover and v2 release baseline

R10 established v2.0.0 and removed the final known obsolete compatibility/patch pathnames:

- no grandfathered patch-style JS/CSS source remains;
- no old R5 Garden Keeper alternate owner remains;
- no R7 Keeper CSS alias remains;
- authored `src/` no longer carries local `?v=` release-history queries; build-time stamping is the sole cache-busting owner;
- `v2-entrypoints.json` and `V2_BASELINE.md` freeze the major-version architecture.

The v2 publisher remains reusable for later v2 releases instead of being a v2.0-only workflow.

## v2.5 Motion & Continuity

- [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md) — progressive motion timing/easing, View Transition usage, navigation intent, Garden Keeper observer-only feedback, and reduced-motion ownership.
- Motion cannot become a reading-state, catalog-state, request, dialog, workflow, route, or persistence owner.

## v2.6 Reliability & Real-Browser Testing

v2.6 makes real browser behavior authoritative for high-risk flows without weakening deterministic checks.

- [`TEST_ARCHITECTURE.md`](./TEST_ARCHITECTURE.md) documents the isolated Playwright 1.62.1 workspace, generated EPUB, five browser projects, diagnostics/artifacts, capability-aware WebKit handling, and release ownership.
- [`ACCESSIBILITY_TESTING.md`](./ACCESSIBILITY_TESTING.md) documents Library/Series/Reader/Keeper accessibility verification and the application-chrome versus publication-content boundary.
- `.github/workflows/e2e.yml` runs Chromium, Firefox, WebKit, Chromium Mobile, and WebKit Mobile on pull requests and `main`.
- `tools/check-v2-6.mjs` keeps the E2E structure, source ownership, release metadata, and exact-main browser release gate from silently regressing.
- Issues #154 and #157 are represented by permanent Reader regressions rather than one-off patches.

## Permanent guardrails

- `tools/check-r0.mjs` — frozen behavior/security/persistence contracts.
- `tools/check-r1.mjs` — repository layout, naming, build boundaries, CI pins, dead-file manifest and asset versioning.
- `tools/check-r2.mjs` — canonical domain/state ownership.
- `tools/check-r3.mjs` — single-owner Library/Series rendering and volume actions.
- `tools/check-r4.mjs` + `tools/check-r4-1.mjs` — Reader session/application/input/image-focus contracts.
- `tools/check-r5.mjs` — final Keeper shell/client/session/workflow ownership and dead-owner removal.
- `tools/check-r6.mjs` — Functions service ownership and security separation.
- `tools/check-r7.mjs` — semantic CSS cascade/variants/accessibility and Keeper direct semantic entrypoints.
- `tools/check-r8.mjs` — layered deterministic test/fixture and priority-flow contracts.
- `tools/check-r9.mjs` — lockfile/build/deployment/no-bundler boundary.
- `tools/check-r10.mjs` — v2 manifest, legacy tombstones, source cache-version cleanup, docs/release gate and final major-version baseline.
- `tools/check-v2-6.mjs` — real-browser harness, Reader/public/Keeper reliability source contracts, release/document synchronization, and exact-main E2E release gate.

Future work starts from [`V2_BASELINE.md`](./V2_BASELINE.md), the current post-baseline contracts above, and [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md). A historical implementation may only be restored when it is an intentional compatibility requirement with explicit ownership and regression coverage; obsolete duplicate owners must not return.

- [`CATALOG_TAXONOMY.md`](./CATALOG_TAXONOMY.md) — canonical Novel Updates genres and catalog taxonomy ownership.
