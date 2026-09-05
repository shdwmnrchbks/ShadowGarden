# Shadow Garden Documentation

This is the canonical documentation index for current architecture, active planning, audit evidence, operations policy, release records, and archived history.

## Current project state

- [`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md) — **the single current roadmap**; Audits A–H are complete and the v2.11.0 formal release cut is converged.
- [`audits/POST_V2_10_AUDIT.md`](./audits/POST_V2_10_AUDIT.md) — the consolidated v2.11 findings/decision register.
- **Active deployment/product line:** v2.11.0 — Engineering Audit, Refactor & Optimization.
- **Latest formal release:** v2.11.0 — Engineering Audit, Refactor & Optimization.
- [`architecture/VERSIONING_CONTRACT.md`](./architecture/VERSIONING_CONTRACT.md) — deployment version versus formal release ownership and final convergence rules.

Completed planning and historical milestone material belongs under [`archive/`](./archive/). Formal release notes under [`releases/`](./releases/) and historical security milestone records remain historical evidence; current freshness enforcement does not rewrite them to remove old version/tool references.

## Current architecture contracts

- [`architecture/README.md`](./architecture/README.md) — architecture index and current v2.11 posture.
- [`architecture/V2_BASELINE.md`](./architecture/V2_BASELINE.md) — accepted v2.0.0 architecture baseline.
- [`architecture/DOMAIN_LAYER.md`](./architecture/DOMAIN_LAYER.md) — browser-local catalog/identity/reading-state/preferences ownership.
- [`architecture/PUBLIC_UI_LAYER.md`](./architecture/PUBLIC_UI_LAYER.md) — Library/Series controller/render ownership.
- [`architecture/READER_LAYER.md`](./architecture/READER_LAYER.md) — Reader session/app/Pages/Continuous/Page Map/input/image-focus ownership.
- [`architecture/KEEPER_LAYER.md`](./architecture/KEEPER_LAYER.md) — Garden Keeper client/workflow ownership.
- [`architecture/FUNCTIONS_LAYER.md`](./architecture/FUNCTIONS_LAYER.md) — thin route/service/storage/security ownership.
- [`architecture/DESIGN_SYSTEM.md`](./architecture/DESIGN_SYSTEM.md) — current CSS/accessibility/motion ownership after Audit F.
- [`architecture/TEST_ARCHITECTURE.md`](./architecture/TEST_ARCHITECTURE.md) — deterministic and five-project real-browser verification ownership.
- [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md) — authored/generated, runtime, dependency, and repository boundaries.
- [`architecture/BUILD_DEPLOYMENT.md`](./architecture/BUILD_DEPLOYMENT.md) — build/preview/CI/deployment/release-publisher ownership after Audit G.
- [`architecture/MAINTENANCE_BASELINE.md`](./architecture/MAINTENANCE_BASELINE.md) — scheduled deterministic/browser health checks.
- [`architecture/ACCESSIBILITY_TESTING.md`](./architecture/ACCESSIBILITY_TESTING.md) — application accessibility contract and EPUB publication boundary.
- [`architecture/MOTION_SYSTEM.md`](./architecture/MOTION_SYSTEM.md) — progressive motion ownership.
- [`architecture/PERSISTENCE_CONTRACTS.md`](./architecture/PERSISTENCE_CONTRACTS.md) and [`architecture/HTTP_STORAGE_CONTRACTS.md`](./architecture/HTTP_STORAGE_CONTRACTS.md) — persistence and server/storage boundaries.

## v2.11 audit evidence

- [`audits/POST_V2_10_ENTRYPOINT_INVENTORY.md`](./audits/POST_V2_10_ENTRYPOINT_INVENTORY.md) — Audit A production entrypoint inventory.
- [`audits/POST_V2_10_AUDIT.md`](./audits/POST_V2_10_AUDIT.md) — consolidated A–H decisions plus detailed A/B evidence.
- [`audits/V2_11_LIBRARY_SERIES_AUDIT.md`](./audits/V2_11_LIBRARY_SERIES_AUDIT.md) — Audit C.
- [`audits/V2_11_KEEPER_AUDIT.md`](./audits/V2_11_KEEPER_AUDIT.md) — Audit D.
- [`audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md`](./audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md) — Audit E.
- [`audits/V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md`](./audits/V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md) — Audit F.
- [`audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md`](./audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md) — Audit G.
- [`audits/V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md`](./audits/V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md) — Audit H.

## Active operations

- [`operations/DEPENDENCY_MAINTENANCE.md`](./operations/DEPENDENCY_MAINTENANCE.md) — review-driven dependency maintenance and non-mutating audit policy.
- [`operations/CATALOG_RECOVERY.md`](./operations/CATALOG_RECOVERY.md) — recovery readiness, snapshot retention, integrity, and destructive-operation safety.

## Verification ownership

- `npm run check` — current repository/dependency/runtime/docs/release/baseline/cache/retired-owner/reachability/performance guards.
- `npm run check:security` — signed media, opaque identity, human-session, protected-route and related security contracts.
- `npm test` — all deterministic unit/service/DOM/browser-contract tests.
- `npm run build` — self-validating local/Cloudflare/E2E production build (`prebuild` runs the repository check).
- `.github/workflows/verify.yml` — repository/security/service/targeted regressions once, then `npm run build:dist` to avoid repeating the passed repository check.
- `.github/workflows/e2e.yml` — Chromium desktop/mobile, Firefox desktop, WebKit desktop/mobile against production `dist/`.
- `.github/workflows/baseline-health.yml` — monthly/manual check + security + full deterministic suite + post-check `build:dist`.
- `.github/workflows/dependency-audit.yml` — scheduled/manual non-mutating production dependency audit report.
- `.github/workflows/release-v2.yml` — exact-main Verify + real-browser + matching Cloudflare deployment + production smoke before GitHub release publication.

## Releases and history

[`releases/README.md`](./releases/README.md) owns formal release-record indexing; the latest formal release is [`releases/v2.11.0.md`](./releases/v2.11.0.md). [`archive/README.md`](./archive/README.md) owns completed roadmaps and milestone history, including the R0–R10 refactor and v2.6–v2.10 product planning.

## Repository documentation policy

Current architecture/operations contracts describe current ownership. Audit records describe evidence/decisions. Release/archive/security records may describe historical implementation exactly as it existed at the time. A current contract must not advertise a deleted historical executable or superseded release/version state as a live owner merely because the historical record remains preserved elsewhere.
