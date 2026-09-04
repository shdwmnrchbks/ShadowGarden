# Shadow Garden Documentation

This is the single documentation index for Shadow Garden. Architecture contracts, current planning, operational runbooks, archived milestone history, release records, security history, build conventions, test/accessibility contracts, and design guidance live under `docs/`.

## 🚧 Current engineering state

- [`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md) — **the single active roadmap**: v2.11.0 Engineering Audit, Refactor & Optimization.
- [`architecture/ENGINEERING_AUDIT.md`](./architecture/ENGINEERING_AUDIT.md) — audit methodology, finding/disposition format, and evidence thresholds for conditional refactor/optimization work.
- **Active deployment/product line:** v2.11.0 — Engineering Audit, Refactor & Optimization.
- **Latest formal release:** v2.10.0 — Maintenance & Supply Chain.
- [`architecture/VERSIONING_CONTRACT.md`](./architecture/VERSIONING_CONTRACT.md) — active/formal version ownership. v2.11 development intentionally advances `deploymentVersion` while formal `version` remains v2.10.0 until a later release cut.

Shadow Garden has enough product features for the current operating horizon. v2.11 is therefore an **audit-first engineering-health phase**, not a feature expansion. Refactor and optimization slices are conditional: when the audit shows an area is healthy, the corresponding implementation work is skipped/deferred rather than manufactured to satisfy the roadmap.

Completed or superseded planning must not remain marked as current. Historical roadmaps, audits, and milestone records are canonically indexed under [`archive/README.md`](./archive/README.md).

## Architecture contracts

- [`architecture/README.md`](./architecture/README.md) — architecture documentation index and current v2 ownership summary.
- [`architecture/ENGINEERING_AUDIT.md`](./architecture/ENGINEERING_AUDIT.md) — v2.11 audit/refactor/optimization decision contract.
- [`architecture/V1_BASELINE.md`](./architecture/V1_BASELINE.md) — frozen v1.15.14 starting-point runtime/ownership/dependency baseline.
- [`architecture/V2_BASELINE.md`](./architecture/V2_BASELINE.md) — accepted v2.0.0 post-refactor ownership/security/build/regression baseline.
- [`architecture/PERSISTENCE_CONTRACTS.md`](./architecture/PERSISTENCE_CONTRACTS.md) — browser persistence, IndexedDB, cookie, and migration contracts.
- [`architecture/HTTP_STORAGE_CONTRACTS.md`](./architecture/HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and Backblaze B2 namespace contracts.
- [`architecture/MODULE_CONVENTIONS.md`](./architecture/MODULE_CONVENTIONS.md) — module naming, ownership, DOM/state, dependency direction, and placement rules.
- [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md) — authored/generated boundaries, Node/CI policy, dependency policy, root layout, and deploy asset versioning.
- [`architecture/BUILD_DEPLOYMENT.md`](./architecture/BUILD_DEPLOYMENT.md) — locked dependency tree, `npm ci`, deterministic build context, deployment metadata, no-bundler decision, and verified v2 publisher contract.
- [`architecture/VERSIONING_CONTRACT.md`](./architecture/VERSIONING_CONTRACT.md) — active deployment version versus formal release version ownership.
- [`architecture/DOMAIN_LAYER.md`](./architecture/DOMAIN_LAYER.md) — canonical catalog, identity, progress, bookmarks, reading-state, preferences, URL, and formatting services.
- [`architecture/PUBLIC_UI_LAYER.md`](./architecture/PUBLIC_UI_LAYER.md) — Library/Series controllers, renderers, shared volume actions, and ownership boundaries.
- [`architecture/READER_LAYER.md`](./architecture/READER_LAYER.md) — Reader session/application, Page/Continuous adapters, input ownership, image focus, Page Map/progress, and EPUB.js compatibility boundaries.
- [`architecture/KEEPER_LAYER.md`](./architecture/KEEPER_LAYER.md) — Garden Keeper shell/client/workflow ownership.
- [`architecture/FUNCTIONS_LAYER.md`](./architecture/FUNCTIONS_LAYER.md) — thin Pages Function routes, explicit services, and security boundaries.
- [`architecture/DESIGN_SYSTEM.md`](./architecture/DESIGN_SYSTEM.md) — semantic CSS/design-system ownership.
- [`architecture/TEST_ARCHITECTURE.md`](./architecture/TEST_ARCHITECTURE.md) — deterministic unit/service/DOM/browser-contract layers plus the permanent five-project Playwright matrix.
- [`architecture/ACCESSIBILITY_TESTING.md`](./architecture/ACCESSIBILITY_TESTING.md) — application accessibility verification and publication-content boundary.
- [`architecture/MOBILE_NAVIGATION.md`](./architecture/MOBILE_NAVIGATION.md) — responsive drawer/viewport/focus/background-scroll contract.
- [`architecture/MOTION_SYSTEM.md`](./architecture/MOTION_SYSTEM.md) — progressive motion ownership and accessibility/performance rules.
- [`architecture/CATALOG_TAXONOMY.md`](./architecture/CATALOG_TAXONOMY.md) — canonical genres/tags/EPUB normalization and audit-first migration rules.
- [`architecture/MAINTENANCE_BASELINE.md`](./architecture/MAINTENANCE_BASELINE.md) — monthly deterministic/security/recovery/realistic-scale and real-browser health baselines.
- [`architecture/v1-entrypoints.json`](./architecture/v1-entrypoints.json) — historical v1 entrypoint manifest.
- [`architecture/v2-entrypoints.json`](./architecture/v2-entrypoints.json) — accepted v2 direct/runtime entrypoint manifest.
- [`architecture/r1-legacy-source-exceptions.json`](./architecture/r1-legacy-source-exceptions.json) — retired-source tombstone manifest.

## Operations

These remain active operational contracts during the v2.11 engineering audit:

- [`operations/CATALOG_RECOVERY.md`](./operations/CATALOG_RECOVERY.md) — private catalog snapshot retention, integrity verification, recovery anchors, destructive-operation preflight, restore, and recovery-readiness policy.
- [`operations/DEPENDENCY_MAINTENANCE.md`](./operations/DEPENDENCY_MAINTENANCE.md) — weekly Dependabot review policy, Node/npm and lockfile ownership, scheduled audit reporting, high-impact dependency review, and its relationship to the v2.11 audit.

The audit may recommend changes to an operational owner only when evidence meets the same refactor/optimization thresholds as application code. Existing recovery and dependency policies remain authoritative until explicitly replaced and verified.

## Current planning and archive

- [`roadmaps/README.md`](./roadmaps/README.md) — active roadmap index.
- [`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md) — v2.11 audit-first roadmap and conditional refactor/optimization slices.
- [`archive/README.md`](./archive/README.md) — canonical index for completed roadmaps, audits, and milestone records.
- [`archive/ROADMAP_V2_6_TO_V2_10.md`](./archive/ROADMAP_V2_6_TO_V2_10.md) — completed v2.6–v2.10 roadmap.
- [`archive/REFACTOR_ROADMAP.md`](./archive/REFACTOR_ROADMAP.md) — completed R0–R10 refactor roadmap.
- [`archive/SECURITY_ROADMAP.md`](./archive/SECURITY_ROADMAP.md) — completed Security & Anti-Abuse roadmap.
- [`archive/V2_8_FOOTNOTE_AUDIT.md`](./archive/V2_8_FOOTNOTE_AUDIT.md) — completed v2.8 Reader note-compatibility audit.
- [`archive/security/`](./archive/security/) — canonical Security Milestone 5–9 records.

`docs/roadmaps/CURRENT_ROADMAP.md` is the only active planning document. The old `REFACTOR_ROADMAP.md` and `SECURITY_ROADMAP.md` roadmap paths remain as Git symlinks into `docs/archive/` only so permanent historical guards and older links resolve without duplicated content.

Likewise, `docs/security/MILESTONE_5_CLOUDFLARE.md` through `MILESTONE_9_FINAL_AUDIT.md` remain as Git symlink compatibility paths to the canonical files under `docs/archive/security/`. The completed security milestone records are historical evidence, not active planning.

## Releases

Release notes remain under `docs/releases/`. The latest formal release is v2.10.0.

- [`releases/v2.0.0.md`](./releases/v2.0.0.md) — v2 architecture baseline release.
- [`releases/v2.4.0.md`](./releases/v2.4.0.md) — Interaction & UX Polish release.
- [`releases/v2.5.0.md`](./releases/v2.5.0.md) — Motion & Continuity release.
- [`releases/v2.6.0.md`](./releases/v2.6.0.md) — Reliability & Real-Browser Testing release.
- [`releases/v2.6.1.md`](./releases/v2.6.1.md) through [`releases/v2.6.7.md`](./releases/v2.6.7.md) — targeted Reader reliability hotfix series.
- [`releases/v2.8.0.md`](./releases/v2.8.0.md) — Reader Experience release.
- [`releases/v2.9.0.md`](./releases/v2.9.0.md) — Keeper Productivity & Recovery release.
- [`releases/v2.10.0.md`](./releases/v2.10.0.md) — Maintenance & Supply Chain release.

There is no formal v2.11 release yet. v2.11 remains a development/audit line until its roadmap is complete and a release cut explicitly converges formal metadata.

## Verification layers

The permanent baseline combines deterministic checks, real browsers, and recurring maintenance health:

- `npm test` — unit, service, DOM, and deterministic browser-contract layers;
- `npm run check` — architecture/security, dependency/runtime policy, documentation/release freshness, maintenance-baseline, and realistic-scale guards;
- `npm run build` — repeats the full check through `prebuild` before generating production output;
- `npm run test:e2e` — Playwright across Chromium/Firefox/WebKit desktop and Chromium/WebKit mobile;
- `.github/workflows/verify.yml` — repository checks and production build;
- `.github/workflows/e2e.yml` — permanent five-project real-browser matrix plus monthly/manual baseline reruns;
- `.github/workflows/baseline-health.yml` — monthly/manual deterministic security, recovery, performance, test, and build health baseline;
- `.github/workflows/dependency-audit.yml` — weekly/manual policy-driven production dependency audit reporting;
- `.github/workflows/release-v2.yml` — exact-main Verify + real-browser success, matching Cloudflare version/commit, production smoke, then formal GitHub v2 release publication.

v2.11 audit work does not weaken these gates. New measurements should reuse existing deterministic/Playwright fixtures where practical and must not require production secrets for the core audit.

## Security history

Security Milestones 1–9 remain completed baseline contracts. Their roadmap is archived at [`archive/SECURITY_ROADMAP.md`](./archive/SECURITY_ROADMAP.md), and the Milestone 5–9 records are canonical under [`archive/security/`](./archive/security/). Compatibility symlinks under `docs/security/` exist only for permanent checks and historical links.

## Product/design guidance

- [`style/SITE_VOICE.md`](./style/SITE_VOICE.md) — shared copy and tone rules for Library, Reader, and Garden Keeper.

## Repository-root policy

The complete root policy is documented in [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md). Root is limited to normal project entry/configuration files and top-level source/document/test/tool directories. Historical planning is canonically archived under `docs/archive/`; active planning belongs in `docs/roadmaps/CURRENT_ROADMAP.md`; active operational runbooks belong in `docs/operations/`; deterministic fixtures and tests belong under `tests/`; generated output belongs in ignored build directories. `package-lock.json` remains an intentional committed root file under the dependency/build contract.
