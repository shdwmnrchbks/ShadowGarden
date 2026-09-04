# Shadow Garden Architecture

This directory records the frozen v1.15.14 starting baseline, the accepted v2.0.0/R10 architecture baseline, and the post-baseline contracts that remain authoritative for current v2 work.

The active deployment/product line is **v2.11.0 — Engineering Audit, Refactor & Optimization**. The latest formal release remains **v2.10.0 — Maintenance & Supply Chain**. v2.11 is audit-first: accepted architecture remains valid unless evidence demonstrates duplicated ownership, unnecessary complexity, correctness risk, maintainability cost, a verification gap, or a reproducible runtime/build/test bottleneck.

The current roadmap is [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md). Evidence and decisions are recorded under [`../audits/`](../audits/). Completed v2.6–v2.10 product planning is archived at [`../archive/V2_6_TO_V2_10_ROADMAP.md`](../archive/V2_6_TO_V2_10_ROADMAP.md).

## Baselines

- [`V1_BASELINE.md`](./V1_BASELINE.md) — frozen v1.15.14 runtime/ownership/dependency baseline.
- [`v1-entrypoints.json`](./v1-entrypoints.json) — historical v1 entrypoint record.
- [`V2_BASELINE.md`](./V2_BASELINE.md) — accepted v2.0.0 post-refactor ownership/security/build/regression baseline.
- [`v2-entrypoints.json`](./v2-entrypoints.json) — frozen v2 direct/runtime entrypoint manifest used as audit comparison evidence, not a moving inventory.
- [`PERSISTENCE_CONTRACTS.md`](./PERSISTENCE_CONTRACTS.md) — browser-local storage, cookies, IndexedDB, and migration contracts.
- [`HTTP_STORAGE_CONTRACTS.md`](./HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and private B2 namespace contracts.

## Repository and build ownership

- [`MODULE_CONVENTIONS.md`](./MODULE_CONVENTIONS.md) — naming, ownership, DOM/state, CSS, dependency direction, and placement rules.
- [`BUILD_CONTRACT.md`](./BUILD_CONTRACT.md) — authored/generated boundaries, Node/CI policy, dependency strategy, root layout, and build-owned local asset cache stamping.
- [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) — lockfile/install, deterministic build metadata, CI pins, preview, no-bundler decision, and release-publisher ownership.
- [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) — active deployment version versus formal release version ownership. v2.11 currently deploys as 2.11.0 while formal release ownership remains 2.10.0.
- [`r1-legacy-source-exceptions.json`](./r1-legacy-source-exceptions.json) — retired-source tombstone manifest.

The first v2.11 cleanup restores the existing R10 cache-version boundary: authored Reader imports no longer carry hand-maintained local `?v=` history, and `tools/check-authored-cache-versions.mjs` now makes that rule part of active `npm run check`.

## Shared browser domain

- [`DOMAIN_LAYER.md`](./DOMAIN_LAYER.md) — canonical catalog, identity, progress, bookmarks, reading state, preferences, URL, formatting, and compatibility ownership.
- Implementation: `src/assets/js/domain/`.

## Public Library and Series

- [`PUBLIC_UI_LAYER.md`](./PUBLIC_UI_LAYER.md) — Library/Series controllers, query/render ownership, shared volume actions, refresh lifecycle, and removed repair layers.
- v2.11C audits realistic-scale behavior and ownership before any optimization decision.

## Reader

- [`READER_LAYER.md`](./READER_LAYER.md) — authorized Reader session, application orchestration, Pages/Continuous adapters, Page Map/state ownership, Pages-only navigation input, isolated image focus, and retained EPUB.js compatibility boundaries.
- Continuous EPUB documents receive no Reader-owned vertical touch interception.
- Split-XHTML chapter identity follows canonical navigation/spine ownership.
- v2.8 Reader Experience improved typography/progress/search/notes/resume behavior without replacing core owners.
- v2.11B audits post-v2 module growth and long-session/large-EPUB behavior; module count alone is not refactor evidence.

## Garden Keeper

- [`KEEPER_LAYER.md`](./KEEPER_LAYER.md) — single AdminClient, composition root, signed-session boundary, isolated workflows, and contained Upload internals.
- Retained current product owners include Library/Series editing, translation metadata, multi-EPUB upload/preflight, Maintenance, Catalog History, Trash/Recovery Readiness, Abuse Watch, and version/shell behavior.
- Catalog History retains the newest 15 snapshots through the canonical snapshot/prune flow.
- Batch Edit and Batch Artwork are intentionally retired; their workflow/style/test/backend paths are tombstoned and are not v2.11 refactor targets.
- v2.11D audits only retained Keeper workflows and measured operational cost.

## Pages Functions and storage

- [`FUNCTIONS_LAYER.md`](./FUNCTIONS_LAYER.md) — thin Pages Function routes over explicit Authentication, Media, Catalog, Storage, Validation, Abuse, HTTP, and Admin services.
- Private B2 transport remains owned by `functions/services/storage.js`; the v2.10 B2 metadata-integrity regression was fixed before the v2.11 baseline.
- Signed media authorization and Range delivery remain together in Media ownership; public cooldown enforcement remains outside `/media/*`.
- `functions/_lib/b2.js` and `functions/_lib/garden-maintenance.js` are explicit compatibility-facade audit candidates. v2.11A must prove current consumers before any removal.

## CSS and design system

- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — semantic public, Library, Reader, and Garden Keeper CSS ownership.
- Public/Keeper foundation tokens remain separate from Reader-scoped chrome/theme ownership.
- v2.11F removes/consolidates styles only with proven dead usage or conflicting ownership.

## Test and accessibility architecture

- [`TEST_ARCHITECTURE.md`](./TEST_ARCHITECTURE.md) — unit/service/DOM/browser-contract layers plus the permanent Playwright real-browser matrix.
- [`ACCESSIBILITY_TESTING.md`](./ACCESSIBILITY_TESTING.md) — application-owned accessibility verification and the boundary to publication-owned EPUB content.
- [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md) — mobile drawer geometry/accessibility/background-scroll ownership.
- [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md) — progressive motion ownership; motion cannot become state/request/workflow/persistence ownership.
- [`MAINTENANCE_BASELINE.md`](./MAINTENANCE_BASELINE.md) — recurring security/recovery/performance/build/browser/accessibility health baseline.

The real-browser authority remains Chromium desktop, Firefox desktop, WebKit desktop, Chromium Mobile, and WebKit Mobile.

## Historical architecture checkers

`tools/check-r0.mjs` through `tools/check-r10.mjs` remain historical architecture tools, while the active `npm run check` chain is owned by current repository/dependency/runtime/documentation/release/baseline/cache-version/performance checks.

v2.11G must map old assertions to current behavior coverage before any checker is modernized, reactivated, archived, or removed. Historical existence alone is not evidence that every old source-regex check belongs in the active gate.

## Completed release-era contracts

### v2.5 Motion & Continuity

[`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md) remains the active motion contract.

### v2.6 Reliability & Real-Browser Testing

The permanent five-project Playwright matrix, accessibility coverage, generated EPUB fixtures, diagnostics/artifacts, and exact-main E2E release gate remain authoritative.

### v2.8 Reader Experience

v2.8 is complete. Its release record is [`../releases/v2.8.0.md`](../releases/v2.8.0.md). Reader/session/persistence/security ownership remains permanent.

### v2.9 Keeper Productivity & Recovery

v2.9 is complete. Its release record is [`../releases/v2.9.0.md`](../releases/v2.9.0.md). Recovery readiness and upload/productivity additions remain only where still present after pre-v2.11 product simplification.

### v2.10 Maintenance & Supply Chain

v2.10 is complete and remains the latest formal release. Its release record is [`../releases/v2.10.0.md`](../releases/v2.10.0.md). Dependency/runtime policy, documentation/release freshness, scheduled baselines, and the publisher contract remain active in v2.11.

## v2.11 audit posture

- [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md) defines Audits A–H and implementation gates.
- [`../audits/README.md`](../audits/README.md) defines evidence standards.
- [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md) is the active findings/measurement register.
- [`../audits/POST_V2_10_ENTRYPOINT_INVENTORY.md`](../audits/POST_V2_10_ENTRYPOINT_INVENTORY.md) is the current ownership inventory.
- “No change needed”, “skipped”, and “deferred” are valid outcomes.
- Refactor requires demonstrated ownership/maintainability/correctness benefit.
- Optimization requires a reproducible realistic-scale bottleneck and before/after evidence.
- Architecture contracts remain authoritative; audit notes cannot become alternate design owners.

Future implementation starts from [`V2_BASELINE.md`](./V2_BASELINE.md), current post-baseline contracts, and recorded v2.11 evidence. Obsolete duplicate owners must not return.

- [`CATALOG_TAXONOMY.md`](./CATALOG_TAXONOMY.md) — canonical Novel Updates genres and catalog taxonomy ownership.
