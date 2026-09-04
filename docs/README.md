# Shadow Garden Documentation

This is the single documentation index for Shadow Garden. Architecture contracts, current project planning, audit evidence, archived milestone history, release records, security history, build conventions, test/accessibility contracts, and design guidance live under `docs/` rather than accumulating at the repository root.

## Current project state

- [`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md) — **the single current roadmap**. Product feature expansion is paused; the active cycle is an evidence-first audit of the mature v2 codebase, with refactor and optimization work performed only where the audit demonstrates a concrete need.
- [`audits/POST_V2_10_AUDIT.md`](./audits/POST_V2_10_AUDIT.md) — active findings/measurements/decisions record. “No change needed” and “deferred” are valid audit outcomes.
- **Active deployment/product line:** v2.10.0 — Maintenance & Supply Chain.
- **Latest formal release:** v2.10.0 — Maintenance & Supply Chain.
- [`architecture/VERSIONING_CONTRACT.md`](./architecture/VERSIONING_CONTRACT.md) — active version ownership. The audit itself does not require a new release number; a later release is chosen only if justified implementation work materially changes the shipped application.

The completed v2.6–v2.10 product roadmap, earlier R0–R10 refactor roadmap, Security & Anti-Abuse roadmap, and completed milestone plans are canonically archived under [`archive/README.md`](./archive/README.md). Completed plans must not remain marked as current work.

## Architecture contracts

- [`architecture/README.md`](./architecture/README.md) — architecture documentation index and current audit posture.
- [`architecture/V1_BASELINE.md`](./architecture/V1_BASELINE.md) — frozen v1.15.14 starting-point runtime/ownership/dependency baseline.
- [`architecture/V2_BASELINE.md`](./architecture/V2_BASELINE.md) — accepted v2.0.0 post-refactor ownership/security/build/regression baseline.
- [`architecture/PERSISTENCE_CONTRACTS.md`](./architecture/PERSISTENCE_CONTRACTS.md) — browser persistence, IndexedDB, cookie, and migration contracts.
- [`architecture/HTTP_STORAGE_CONTRACTS.md`](./architecture/HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and Backblaze B2 namespace contracts.
- [`architecture/MODULE_CONVENTIONS.md`](./architecture/MODULE_CONVENTIONS.md) — module naming, ownership, DOM/state, and placement rules.
- [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md) — authored/generated boundaries, Node/CI policy, dependency policy, root layout, and deploy asset versioning.
- [`architecture/BUILD_DEPLOYMENT.md`](./architecture/BUILD_DEPLOYMENT.md) — locked dependency tree, `npm ci`, deterministic build context, deployment metadata, no-bundler decision, and verified v2 release-publisher contract.
- [`architecture/VERSIONING_CONTRACT.md`](./architecture/VERSIONING_CONTRACT.md) — active deployment version versus formal release version ownership and final-release convergence rules.
- [`architecture/DOMAIN_LAYER.md`](./architecture/DOMAIN_LAYER.md) — canonical catalog, identity, progress, bookmarks, reading-state, preferences, URL, and formatting services.
- [`architecture/PUBLIC_UI_LAYER.md`](./architecture/PUBLIC_UI_LAYER.md) — Library/Series controllers, renderers, shared volume actions, and removed public repair layers.
- [`architecture/READER_LAYER.md`](./architecture/READER_LAYER.md) — authorized Reader session, app/controllers, Page/Continuous adapters, input ownership, image focus, native Continuous touch invariant, and retained EPUB.js compatibility boundaries.
- [`architecture/KEEPER_LAYER.md`](./architecture/KEEPER_LAYER.md) — Garden Keeper shell/client/workflows and explicit ownership boundaries.
- [`architecture/FUNCTIONS_LAYER.md`](./architecture/FUNCTIONS_LAYER.md) — thin Pages Function routes, explicit services, and preserved security boundaries.
- [`architecture/DESIGN_SYSTEM.md`](./architecture/DESIGN_SYSTEM.md) — semantic CSS/design-system ownership.
- [`architecture/TEST_ARCHITECTURE.md`](./architecture/TEST_ARCHITECTURE.md) — deterministic unit/service/DOM/browser-contract layers plus the permanent Playwright real-browser matrix and generated fixtures.
- [`architecture/ACCESSIBILITY_TESTING.md`](./architecture/ACCESSIBILITY_TESTING.md) — accessibility scan/keyboard/zoom/contrast/touch-target contract and the boundary between application chrome and publication-owned EPUB content.
- [`architecture/MOBILE_NAVIGATION.md`](./architecture/MOBILE_NAVIGATION.md) — reconciled mobile drawer viewport, sticky-header, accessibility, and background-scroll-lock contract.
- [`architecture/MOTION_SYSTEM.md`](./architecture/MOTION_SYSTEM.md) — progressive motion ownership, navigation intent, Keeper observer-only choreography, accessibility, and performance rules.
- [`architecture/CATALOG_TAXONOMY.md`](./architecture/CATALOG_TAXONOMY.md) — canonical Novel Updates genres, flexible tags, EPUB normalization, and audit-first migration.
- [`architecture/MAINTENANCE_BASELINE.md`](./architecture/MAINTENANCE_BASELINE.md) — recurring deterministic/security/recovery/performance and real-browser maintenance baseline.
- [`architecture/v1-entrypoints.json`](./architecture/v1-entrypoints.json) — historical v1 baseline manifest.
- [`architecture/v2-entrypoints.json`](./architecture/v2-entrypoints.json) — v2 direct/runtime entrypoint manifest used as an audit comparison point, not permission to freeze intentional later additions.
- [`architecture/r1-legacy-source-exceptions.json`](./architecture/r1-legacy-source-exceptions.json) — retired-source tombstone manifest.

## Audit records

- [`audits/README.md`](./audits/README.md) — audit evidence standard and decision vocabulary.
- [`audits/POST_V2_10_AUDIT.md`](./audits/POST_V2_10_AUDIT.md) — active post-v2.10 findings register, measurements, implementation candidates, and skip/defer decisions.

Audit documents record evidence; architecture contracts remain authoritative for accepted ownership. If an audit justifies a change, the relevant architecture contract must be updated with the implementation rather than leaving the audit as a shadow source of truth.

## Releases

Release notes remain in `docs/releases/`; this list records completed formal releases.

- [`releases/v2.0.0.md`](./releases/v2.0.0.md) — v2 architecture baseline release.
- [`releases/v2.4.0.md`](./releases/v2.4.0.md) — Interaction & UX Polish release.
- [`releases/v2.5.0.md`](./releases/v2.5.0.md) — Motion & Continuity release.
- [`releases/v2.6.0.md`](./releases/v2.6.0.md) — Reliability & Real-Browser Testing release.
- [`releases/v2.6.1.md`](./releases/v2.6.1.md) — Continuous Reader rail hotfix for the remaining #160 media-overlap case.
- [`releases/v2.6.2.md`](./releases/v2.6.2.md) — Continuous media containment hotfix for the reopened #160 right-edge clipping case.
- [`releases/v2.6.3.md`](./releases/v2.6.3.md) — Continuous containment hardening for publication `min-width` rules, positioned media, and transforms in the reopened #160 case.
- [`releases/v2.6.4.md`](./releases/v2.6.4.md) — Continuous canvas rail exclusion: the reading canvas structurally ends where the seek rail begins.
- [`releases/v2.6.5.md`](./releases/v2.6.5.md) — Continuous full-bleed canvas: artwork bleeds to the rail boundary while prose keeps readable insets.
- [`releases/v2.6.6.md`](./releases/v2.6.6.md) — Continuous vertical frame reconciliation for tall artwork plus pointer-aware image focus controls and fading hints.
- [`releases/v2.6.7.md`](./releases/v2.6.7.md) — Continuous media width independence and full-page image plate containment.
- [`releases/v2.8.0.md`](./releases/v2.8.0.md) — Reader Experience release.
- [`releases/v2.9.0.md`](./releases/v2.9.0.md) — Keeper Productivity & Recovery release.
- [`releases/v2.10.0.md`](./releases/v2.10.0.md) — Maintenance & Supply Chain release.

## Verification layers

The permanent release baseline combines deterministic checks with real browsers and recurring maintenance baselines:

- `npm test` — unit, service, DOM, and deterministic browser-contract layers;
- `npm run check` — architecture/security, dependency/runtime policy, documentation/release freshness, realistic-scale sanity, and deterministic repository guards;
- `npm run build` — repeats the full check through `prebuild` before generating production output;
- `npm run test:e2e` — Playwright against generated production output across Chromium/Firefox/WebKit desktop and Chromium/WebKit mobile;
- `.github/workflows/verify.yml` — complete repository checks and production build;
- `.github/workflows/e2e.yml` — permanent five-project real-browser matrix, monthly/manual baseline reruns, and retained failure artifacts;
- `.github/workflows/baseline-health.yml` — monthly/manual deterministic security, recovery, performance, and build health baseline;
- `.github/workflows/release-v2.yml` — exact-main Verify + real-browser success, matching Cloudflare version/commit, production smoke, then GitHub v2 release publication from the formal release version.

The audit may recommend simplifying duplicate checks or improving measurements, but it must not weaken the behavior each layer currently proves.

## Archived roadmaps and milestones

- [`archive/README.md`](./archive/README.md) — canonical index for completed roadmaps and milestone records.
- [`archive/REFACTOR_ROADMAP.md`](./archive/REFACTOR_ROADMAP.md) — completed R0–R10 refactor plan.
- [`archive/SECURITY_ROADMAP.md`](./archive/SECURITY_ROADMAP.md) — completed Security & Anti-Abuse plan.
- [`archive/V2_6_TO_V2_10_ROADMAP.md`](./archive/V2_6_TO_V2_10_ROADMAP.md) — completed v2.6–v2.10 roadmap.
- Historical source paths may remain only as compatibility pointers or immutable milestone records. They are not active planning surfaces.

## Product/design guidance

- [`style/SITE_VOICE.md`](./style/SITE_VOICE.md) — shared copy and tone rules for Library, Reader, and Garden Keeper.

## Repository-root policy

The complete root policy is documented in [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md). Root is limited to normal project entry/configuration files and top-level source/document/test/tool directories. Historical planning is canonically archived under `docs/archive/`; active planning belongs under `docs/roadmaps/`; audit evidence belongs under `docs/audits/`; deterministic regression fixtures and tests belong under `tests/`; generated output belongs in ignored build directories. `package-lock.json` remains an intentional committed root file under the dependency/build contract.
