# Shadow Garden Documentation

This is the single documentation index for Shadow Garden. Architecture contracts, project planning, security history, build conventions, and design guidance live under `docs/` rather than accumulating at the repository root.

## Architecture and refactor contracts

- [`architecture/README.md`](./architecture/README.md) — architecture documentation index.
- [`architecture/V1_BASELINE.md`](./architecture/V1_BASELINE.md) — frozen v1.15.14 runtime/ownership/dependency baseline.
- [`architecture/PERSISTENCE_CONTRACTS.md`](./architecture/PERSISTENCE_CONTRACTS.md) — browser persistence, IndexedDB, cookie, and migration contracts.
- [`architecture/HTTP_STORAGE_CONTRACTS.md`](./architecture/HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and Backblaze B2 namespace contracts.
- [`architecture/MODULE_CONVENTIONS.md`](./architecture/MODULE_CONVENTIONS.md) — post-R1 module naming, ownership, DOM/state, and placement rules.
- [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md) — authored/generated boundaries, Node/CI policy, dependency policy, root layout, and deploy asset versioning.
- [`architecture/DOMAIN_LAYER.md`](./architecture/DOMAIN_LAYER.md) — R2 canonical catalog, identity, progress, bookmarks, reading-state, preferences, URL, and formatting services.
- [`architecture/PUBLIC_UI_LAYER.md`](./architecture/PUBLIC_UI_LAYER.md) — R3 Library/Series controllers, renderers, shared volume actions, and removed public repair layers.
- [`architecture/READER_LAYER.md`](./architecture/READER_LAYER.md) — R4/R4.1 authorized Reader session, app/controllers, Page/Continuous adapters, split Pages input vs image-focus ownership, native Continuous touch invariant, and retained EPUB.js compatibility boundaries.
- [`architecture/KEEPER_LAYER.md`](./architecture/KEEPER_LAYER.md) — R5 Garden Keeper app shell, sole AdminClient, Authentication/session boundary, isolated workflows, contained Upload internals, and security invariants.
- [`architecture/FUNCTIONS_LAYER.md`](./architecture/FUNCTIONS_LAYER.md) — R6 thin Pages Function routes, explicit auth/media/catalog/storage/validation/abuse/http services, and preserved security boundaries.
- [`architecture/DESIGN_SYSTEM.md`](./architecture/DESIGN_SYSTEM.md) — R7 semantic CSS ownership, public/Reader/Keeper cascade contracts, variants, accessibility, and retired historical style layers.
- [`architecture/TEST_ARCHITECTURE.md`](./architecture/TEST_ARCHITECTURE.md) — R8 layered unit/service/DOM/browser-smoke testing, shared deterministic fixtures, priority reading flow, and test ownership.
- [`architecture/MOBILE_NAVIGATION.md`](./architecture/MOBILE_NAVIGATION.md) — reconciled v1.23.1–v1.23.5 mobile drawer viewport, fixed-header, layout-compensation, presentation, accessibility, and background-scroll-lock contract owned jointly by R7 navigation and R8 browser smoke.
- [`architecture/v1-entrypoints.json`](./architecture/v1-entrypoints.json) — machine-readable baseline/intentional-replacement entrypoint contract.
- [`architecture/r1-legacy-source-exceptions.json`](./architecture/r1-legacy-source-exceptions.json) — remaining grandfathered patch-style source plus refactor-proven removals.

## Active roadmap

- [`roadmaps/REFACTOR_ROADMAP.md`](./roadmaps/REFACTOR_ROADMAP.md) — active full-codebase refactor plan leading toward the next major architecture baseline. R0–R8 are complete; R9 build and deployment cleanup is next.

## Completed roadmaps

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

The complete root policy is documented in [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md). Root is limited to normal project entry/configuration files and top-level source/document/test/tool directories. Historical planning belongs under `docs/`; deterministic regression fixtures and tests belong under `tests/`; generated output belongs in ignored build directories.
