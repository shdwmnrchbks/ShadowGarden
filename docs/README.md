# Shadow Garden Documentation

This is the single documentation index for Shadow Garden. Architecture contracts, current project planning, archived milestone history, release records, security history, build conventions, test/accessibility contracts, and design guidance live under `docs/` rather than accumulating at the repository root.

## 🚧 Current work in progress

- [`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md) — **the single active roadmap**. v2.6.0 Reliability & Real-Browser Testing is complete; v2.6.1 through v2.6.7 are focused Continuous Reader fixes; the active feature release remains **v2.7.0 Performance & Scale**, followed by Reader experience, Keeper recovery/productivity, and maintenance/supply-chain work.

Completed or superseded plans must not remain marked as current. Historical roadmaps and milestone records are canonically indexed under [`archive/README.md`](./archive/README.md).

## Architecture contracts

- [`architecture/README.md`](./architecture/README.md) — architecture documentation index.
- [`architecture/V1_BASELINE.md`](./architecture/V1_BASELINE.md) — frozen v1.15.14 starting-point runtime/ownership/dependency baseline.
- [`architecture/V2_BASELINE.md`](./architecture/V2_BASELINE.md) — accepted v2.0.0 post-refactor ownership/security/build/regression baseline.
- [`architecture/PERSISTENCE_CONTRACTS.md`](./architecture/PERSISTENCE_CONTRACTS.md) — browser persistence, IndexedDB, cookie, and migration contracts.
- [`architecture/HTTP_STORAGE_CONTRACTS.md`](./architecture/HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and Backblaze B2 namespace contracts.
- [`architecture/MODULE_CONVENTIONS.md`](./architecture/MODULE_CONVENTIONS.md) — module naming, ownership, DOM/state, and placement rules.
- [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md) — authored/generated boundaries, Node/CI policy, dependency policy, root layout, and deploy asset versioning.
- [`architecture/BUILD_DEPLOYMENT.md`](./architecture/BUILD_DEPLOYMENT.md) — locked dependency tree, `npm ci`, deterministic build context, deployment metadata, no-bundler decision, and verified v2 release-publisher contract.
- [`architecture/DOMAIN_LAYER.md`](./architecture/DOMAIN_LAYER.md) — canonical catalog, identity, progress, bookmarks, reading-state, preferences, URL, and formatting services.
- [`architecture/PUBLIC_UI_LAYER.md`](./architecture/PUBLIC_UI_LAYER.md) — Library/Series controllers, renderers, shared volume actions, and removed public repair layers.
- [`architecture/READER_LAYER.md`](./architecture/READER_LAYER.md) — authorized Reader session, app/controllers, Page/Continuous adapters, input ownership, image focus, native Continuous touch invariant, and retained EPUB.js compatibility boundaries.
- [`architecture/KEEPER_LAYER.md`](./architecture/KEEPER_LAYER.md) — Garden Keeper shell/client/workflows and explicit ownership boundaries.
- [`architecture/FUNCTIONS_LAYER.md`](./architecture/FUNCTIONS_LAYER.md) — thin Pages Function routes, explicit services, and preserved security boundaries.
- [`architecture/DESIGN_SYSTEM.md`](./architecture/DESIGN_SYSTEM.md) — semantic CSS/design-system ownership.
- [`architecture/TEST_ARCHITECTURE.md`](./architecture/TEST_ARCHITECTURE.md) — deterministic unit/service/DOM/browser-contract layers plus the v2.6 Playwright real-browser matrix and generated fixtures.
- [`architecture/ACCESSIBILITY_TESTING.md`](./architecture/ACCESSIBILITY_TESTING.md) — v2.6 accessibility scan/keyboard/zoom/contrast/touch-target contract and the boundary between application chrome and publication-owned EPUB content.
- [`architecture/MOBILE_NAVIGATION.md`](./architecture/MOBILE_NAVIGATION.md) — reconciled mobile drawer viewport, sticky-header, accessibility, and background-scroll-lock contract.
- [`architecture/MOTION_SYSTEM.md`](./architecture/MOTION_SYSTEM.md) — v2.5 progressive motion ownership, navigation intent, Keeper observer-only choreography, accessibility, and performance rules.
- [`architecture/CATALOG_TAXONOMY.md`](./architecture/CATALOG_TAXONOMY.md) — canonical Novel Updates genres, flexible tags, EPUB normalization, and audit-first migration.
- [`architecture/v1-entrypoints.json`](./architecture/v1-entrypoints.json) — historical v1 baseline manifest.
- [`architecture/v2-entrypoints.json`](./architecture/v2-entrypoints.json) — v2 direct/runtime entrypoint manifest.
- [`architecture/r1-legacy-source-exceptions.json`](./architecture/r1-legacy-source-exceptions.json) — retired-source tombstone manifest.

## Releases

Release notes remain in `docs/releases/`; completed milestone planning records are also preserved in the planning archive.

- [`releases/v2.0.0.md`](./releases/v2.0.0.md) — v2 architecture baseline release.
- [`releases/v2.4.0.md`](./releases/v2.4.0.md) — Interaction & UX Polish release.
- [`releases/v2.5.0.md`](./releases/v2.5.0.md) — Motion & Continuity release.
- [`releases/v2.6.0.md`](./releases/v2.6.0.md) — Reliability & Real-Browser Testing release.
- [`releases/v2.6.1.md`](./releases/v2.6.1.md) — Continuous Reader rail hotfix for the remaining #160 media-overlap case.
- [`releases/v2.6.2.md`](./releases/v2.6.2.md) — Continuous media containment hotfix for the reopened #160 right-edge clipping case.
- [`releases/v2.6.3.md`](./releases/v2.6.3.md) — Continuous containment hardening for publication `min-width` rules, positioned media, and transforms in the reopened #160 case.
- [`releases/v2.6.4.md`](./releases/v2.6.4.md) — Continuous canvas rail exclusion: the reading canvas structurally ends where the seek rail begins (reopened #160 item 2).
- [`releases/v2.6.5.md`](./releases/v2.6.5.md) — Continuous full-bleed canvas: artwork bleeds to the rail boundary while prose keeps readable insets (reopened #160 item 2).
- [`releases/v2.6.6.md`](./releases/v2.6.6.md) — Continuous vertical frame reconciliation for tall artwork plus pointer-aware image focus controls and fading hints.
- [`releases/v2.6.7.md`](./releases/v2.6.7.md) — Continuous media width independence: artwork is no longer shaped by the text-width setting, and full-page image plates are immune to the prose column (desktop clipping fixes).

## Verification layers

The permanent release baseline now combines deterministic checks with real browsers:

- `npm test` — unit, service, DOM, and deterministic browser-contract layers;
- `npm run check` — architecture/security guards plus the deterministic behavioral suite;
- `npm run build` — repeats the full check through `prebuild` before generating production output;
- `npm run test:e2e` — Playwright against generated production output across Chromium/Firefox/WebKit desktop and Chromium/WebKit mobile;
- `.github/workflows/verify.yml` — complete repository checks and production build;
- `.github/workflows/e2e.yml` — bounded real-browser matrix and retained failure artifacts;
- `.github/workflows/release-v2.yml` — exact-main Verify + real-browser success, matching Cloudflare version/commit, production smoke, then GitHub v2 release publication.

## Archived roadmaps and milestones

- [`archive/README.md`](./archive/README.md) — canonical index for completed roadmaps and milestone records.
- Historical source paths under `roadmaps/`, `security/`, and the v2.5 motion planning paths under `releases/` remain as compatibility mirrors because CI checks and older documentation intentionally reference them. They are completed historical records, not active plans.

## Product/design guidance

- [`style/SITE_VOICE.md`](./style/SITE_VOICE.md) — shared copy and tone rules for Library, Reader, and Garden Keeper.

## Repository-root policy

The complete root policy is documented in [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md). Root is limited to normal project entry/configuration files and top-level source/document/test/tool directories. Historical planning is canonically archived under `docs/archive/`; active planning belongs under `docs/roadmaps/`; deterministic regression fixtures and tests belong under `tests/`; generated output belongs in ignored build directories. `package-lock.json` remains an intentional committed root file under the dependency/build contract.