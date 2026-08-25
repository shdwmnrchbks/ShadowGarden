# Shadow Garden Documentation

This is the single documentation index for Shadow Garden. Architecture contracts, project planning, security history, build conventions, release records, and design guidance live under `docs/` rather than accumulating at the repository root.

## Architecture and refactor contracts

- [`architecture/README.md`](./architecture/README.md) — architecture documentation index.
- [`architecture/V1_BASELINE.md`](./architecture/V1_BASELINE.md) — frozen v1.15.14 starting-point runtime/ownership/dependency baseline.
- [`architecture/V2_BASELINE.md`](./architecture/V2_BASELINE.md) — accepted v2.0.0 post-refactor ownership/security/build/regression baseline.
- [`architecture/PERSISTENCE_CONTRACTS.md`](./architecture/PERSISTENCE_CONTRACTS.md) — browser persistence, IndexedDB, cookie, and migration contracts.
- [`architecture/HTTP_STORAGE_CONTRACTS.md`](./architecture/HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and Backblaze B2 namespace contracts.
- [`architecture/MODULE_CONVENTIONS.md`](./architecture/MODULE_CONVENTIONS.md) — module naming, ownership, DOM/state, and placement rules.
- [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md) — authored/generated boundaries, Node/CI policy, dependency policy, root layout, and deploy asset versioning.
- [`architecture/BUILD_DEPLOYMENT.md`](./architecture/BUILD_DEPLOYMENT.md) — R9 locked dependency tree, `npm ci`, deterministic build context, deployment metadata, no-bundler decision, and dependency-free preview server.
- [`architecture/DOMAIN_LAYER.md`](./architecture/DOMAIN_LAYER.md) — R2 canonical catalog, identity, progress, bookmarks, reading-state, preferences, URL, and formatting services.
- [`architecture/PUBLIC_UI_LAYER.md`](./architecture/PUBLIC_UI_LAYER.md) — R3 Library/Series controllers, renderers, shared volume actions, and removed public repair layers.
- [`architecture/READER_LAYER.md`](./architecture/READER_LAYER.md) — R4/R4.1 authorized Reader session, app/controllers, Page/Continuous adapters, split Pages input vs image-focus ownership, native Continuous touch invariant, and retained EPUB.js compatibility boundaries.
- [`architecture/KEEPER_LAYER.md`](./architecture/KEEPER_LAYER.md) — R5 Garden Keeper shell/client/workflows with the final R10 removal of obsolete alternate owners.
- [`architecture/FUNCTIONS_LAYER.md`](./architecture/FUNCTIONS_LAYER.md) — R6 thin Pages Function routes, explicit auth/media/catalog/storage/validation/abuse/http services, and preserved security boundaries.
- [`architecture/DESIGN_SYSTEM.md`](./architecture/DESIGN_SYSTEM.md) — R7 semantic CSS ownership and the final R10 direct Keeper semantic entrypoint cutover.
- [`architecture/TEST_ARCHITECTURE.md`](./architecture/TEST_ARCHITECTURE.md) — R8 layered unit/service/DOM/browser-smoke testing, shared deterministic fixtures, priority reading flow, and test ownership.
- [`architecture/MOBILE_NAVIGATION.md`](./architecture/MOBILE_NAVIGATION.md) — reconciled mobile drawer viewport, fixed-header, layout-compensation, presentation, accessibility, and background-scroll-lock contract.
- [`architecture/v1-entrypoints.json`](./architecture/v1-entrypoints.json) — historical v1 baseline manifest updated only for intentional replacements during R0–R10.
- [`architecture/v2-entrypoints.json`](./architecture/v2-entrypoints.json) — frozen v2.0.0 direct/runtime entrypoint manifest.
- [`architecture/r1-legacy-source-exceptions.json`](./architecture/r1-legacy-source-exceptions.json) — retired-source tombstone manifest; R10 leaves no grandfathered patch-style source files.

## Refactor history

- [`roadmaps/REFACTOR_ROADMAP.md`](./roadmaps/REFACTOR_ROADMAP.md) — completed R0–R10 full-codebase refactor history ending at the v2.0.0 baseline.

## Releases

- [`releases/v2.0.0.md`](./releases/v2.0.0.md) — v2.0.0 release notes used by the verified post-deployment GitHub release gate.

## Completed security roadmap

- [`roadmaps/SECURITY_ROADMAP.md`](./roadmaps/SECURITY_ROADMAP.md) — completed security and anti-abuse roadmap, Milestones 1–9.

## Security records

- [`security/MILESTONE_5_CLOUDFLARE.md`](./security/MILESTONE_5_CLOUDFLARE.md)
- [`security/MILESTONE_6_CRAWLER_POLICY.md`](./security/MILESTONE_6_CRAWLER_POLICY.md)
- [`security/MILESTONE_7_GARDEN_KEEPER.md`](./security/MILESTONE_7_GARDEN_KEEPER.md)
- [`security/MILESTONE_8_ABUSE_RESPONSE.md`](./security/MILESTONE_8_ABUSE_RESPONSE.md)
- [`security/MILESTONE_9_FINAL_AUDIT.md`](./security/MILESTONE_9_FINAL_AUDIT.md)

## Product/design guidance

- [`style/SITE_VOICE.md`](./style/SITE_VOICE.md) — shared copy and tone rules for Library, Reader, and Garden Keeper.

## Files intentionally kept at repository root

The complete root policy is documented in [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md). Root is limited to normal project entry/configuration files and top-level source/document/test/tool directories. Historical planning belongs under `docs/`; deterministic regression fixtures and tests belong under `tests/`; generated output belongs in ignored build directories. `package-lock.json` is an intentional committed root file under the R9 dependency contract.

- `architecture/CATALOG_TAXONOMY.md` — canonical Novel Updates genres, flexible tags, EPUB normalization, and audit-first migration.
