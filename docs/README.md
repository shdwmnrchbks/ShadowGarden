# Shadow Garden Documentation

This is the single documentation index for Shadow Garden. Architecture contracts, current project planning, archived milestone history, release records, security history, build conventions, and design guidance live under `docs/` rather than accumulating at the repository root.

## 🚧 Current work in progress

- [`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md) — **the single active roadmap**, currently starting with v2.6.0 Reliability & Real-Browser Testing and continuing through performance/scale, Reader experience, Keeper recovery/productivity, and maintenance/supply-chain work.

Completed or superseded plans must not remain marked as current. Historical roadmaps and milestone records are indexed under [`archive/README.md`](./archive/README.md).

## Architecture contracts

- [`architecture/README.md`](./architecture/README.md) — architecture documentation index.
- [`architecture/V1_BASELINE.md`](./architecture/V1_BASELINE.md) — frozen v1.15.14 starting-point runtime/ownership/dependency baseline.
- [`architecture/V2_BASELINE.md`](./architecture/V2_BASELINE.md) — accepted v2.0.0 post-refactor ownership/security/build/regression baseline.
- [`architecture/PERSISTENCE_CONTRACTS.md`](./architecture/PERSISTENCE_CONTRACTS.md) — browser persistence, IndexedDB, cookie, and migration contracts.
- [`architecture/HTTP_STORAGE_CONTRACTS.md`](./architecture/HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and Backblaze B2 namespace contracts.
- [`architecture/MODULE_CONVENTIONS.md`](./architecture/MODULE_CONVENTIONS.md) — module naming, ownership, DOM/state, and placement rules.
- [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md) — authored/generated boundaries, Node/CI policy, dependency policy, root layout, and deploy asset versioning.
- [`architecture/BUILD_DEPLOYMENT.md`](./architecture/BUILD_DEPLOYMENT.md) — locked dependency tree, `npm ci`, deterministic build context, deployment metadata, no-bundler decision, and dependency-free preview server.
- [`architecture/DOMAIN_LAYER.md`](./architecture/DOMAIN_LAYER.md) — canonical catalog, identity, progress, bookmarks, reading-state, preferences, URL, and formatting services.
- [`architecture/PUBLIC_UI_LAYER.md`](./architecture/PUBLIC_UI_LAYER.md) — Library/Series controllers, renderers, shared volume actions, and removed public repair layers.
- [`architecture/READER_LAYER.md`](./architecture/READER_LAYER.md) — authorized Reader session, app/controllers, Page/Continuous adapters, input ownership, image focus, native Continuous touch invariant, and retained EPUB.js compatibility boundaries.
- [`architecture/KEEPER_LAYER.md`](./architecture/KEEPER_LAYER.md) — Garden Keeper shell/client/workflows and explicit ownership boundaries.
- [`architecture/FUNCTIONS_LAYER.md`](./architecture/FUNCTIONS_LAYER.md) — thin Pages Function routes, explicit services, and preserved security boundaries.
- [`architecture/DESIGN_SYSTEM.md`](./architecture/DESIGN_SYSTEM.md) — semantic CSS/design-system ownership.
- [`architecture/TEST_ARCHITECTURE.md`](./architecture/TEST_ARCHITECTURE.md) — deterministic unit/service/DOM/browser-contract testing and shared fixtures.
- [`architecture/MOBILE_NAVIGATION.md`](./architecture/MOBILE_NAVIGATION.md) — reconciled mobile drawer viewport, sticky-header, accessibility, and background-scroll-lock contract.
- [`architecture/MOTION_SYSTEM.md`](./architecture/MOTION_SYSTEM.md) — v2.5 progressive motion ownership, navigation intent, Keeper observer-only choreography, accessibility, and performance rules.
- [`architecture/CATALOG_TAXONOMY.md`](./architecture/CATALOG_TAXONOMY.md) — canonical Novel Updates genres, flexible tags, EPUB normalization, and audit-first migration.
- [`architecture/v1-entrypoints.json`](./architecture/v1-entrypoints.json) — historical v1 baseline manifest.
- [`architecture/v2-entrypoints.json`](./architecture/v2-entrypoints.json) — v2 direct/runtime entrypoint manifest.
- [`architecture/r1-legacy-source-exceptions.json`](./architecture/r1-legacy-source-exceptions.json) — retired-source tombstone manifest.

## Releases

Release notes remain in `docs/releases/`; milestone planning records are archived separately.

- [`releases/v2.0.0.md`](./releases/v2.0.0.md) — v2 architecture baseline release.
- [`releases/v2.4.0.md`](./releases/v2.4.0.md) — Interaction & UX Polish release.
- [`releases/v2.5.0.md`](./releases/v2.5.0.md) — Motion & Continuity release.

## Archived roadmaps and milestones

- [`archive/README.md`](./archive/README.md) — canonical index for completed roadmaps and milestone records.
- Historical compatibility paths under `roadmaps/`, `security/`, and the old v2.5 motion planning paths under `releases/` are intentionally retained as small archive pointers so old documentation links do not break.

## Product/design guidance

- [`style/SITE_VOICE.md`](./style/SITE_VOICE.md) — shared copy and tone rules for Library, Reader, and Garden Keeper.

## Repository-root policy

The complete root policy is documented in [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md). Root is limited to normal project entry/configuration files and top-level source/document/test/tool directories. Historical planning belongs under `docs/archive/`; active planning belongs under `docs/roadmaps/`; deterministic regression fixtures and tests belong under `tests/`; generated output belongs in ignored build directories. `package-lock.json` remains an intentional committed root file under the dependency/build contract.
