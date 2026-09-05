# Shadow Garden Architecture

This directory contains the frozen v1 starting baseline, the accepted v2.0/R10 baseline, and the **current authoritative ownership contracts** for later v2 work.

The active deployment/product line and formal release source are **v2.11.0 — Engineering Audit, Refactor & Optimization**. Audits A–H are complete, their stack is assembled and exact-main verified, and the formal v2.11.0 release candidate is converged behind the existing publisher gates.

The single current roadmap is [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md). Current findings are in [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md). Formal release notes are [`../releases/v2.11.0.md`](../releases/v2.11.0.md). Historical planning belongs under [`../archive/`](../archive/).

## Baselines and repository contracts

- [`V1_BASELINE.md`](./V1_BASELINE.md) — frozen pre-v2 baseline.
- [`V2_BASELINE.md`](./V2_BASELINE.md) — accepted v2.0 post-refactor baseline.
- [`v1-entrypoints.json`](./v1-entrypoints.json) and [`v2-entrypoints.json`](./v2-entrypoints.json) — historical entrypoint comparison records, not moving manifests.
- [`MODULE_CONVENTIONS.md`](./MODULE_CONVENTIONS.md) — module naming, dependency direction, DOM/state, CSS, and placement rules.
- [`BUILD_CONTRACT.md`](./BUILD_CONTRACT.md) — authored/generated files, Node/npm/dependency policy, repository layout, and asset stamping.
- [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) — current build, preview, CI, deployment metadata, dependency and publisher ownership.
- [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) — active deployment version versus formal release ownership.

## Browser product ownership

- [`DOMAIN_LAYER.md`](./DOMAIN_LAYER.md) — catalog, identity, reading state, progress, bookmarks, preferences, URLs, formatting.
- [`PUBLIC_UI_LAYER.md`](./PUBLIC_UI_LAYER.md) — Library/Series controllers/renderers and shared volume actions.
- [`READER_LAYER.md`](./READER_LAYER.md) — authorized session, app/controllers, Pages/Continuous, Page Map, input, image focus, EPUB.js compatibility boundaries.
- [`KEEPER_LAYER.md`](./KEEPER_LAYER.md) — Garden Keeper composition, single AdminClient, retained operational workflows.
- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — semantic CSS ownership and Audit F accessibility/motion/cascade decision.

Audits B–D retained the current Reader, Library/Series/domain, and Keeper responsibility splits after targeted lifecycle/state-read/request-owner fixes rather than broad restructuring.

## Functions, storage, security, recovery

- [`FUNCTIONS_LAYER.md`](./FUNCTIONS_LAYER.md) — thin route adapters over explicit services.
- [`HTTP_STORAGE_CONTRACTS.md`](./HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization/private B2 boundaries.
- [`PERSISTENCE_CONTRACTS.md`](./PERSISTENCE_CONTRACTS.md) — browser-local and cookie persistence contracts.
- [`MAINTENANCE_BASELINE.md`](./MAINTENANCE_BASELINE.md) — recurring health verification.

Audit A retired unused forwarding compatibility facades after proving no consumers. Audit E retained route/service/helper architecture, restored method-level least-privilege B2 credentials, made unowned implementation exports private, and moved the complete security/service regression layer into normal Verify.

## Verification, accessibility, motion

- [`TEST_ARCHITECTURE.md`](./TEST_ARCHITECTURE.md) — deterministic tests plus five-project Playwright matrix.
- [`ACCESSIBILITY_TESTING.md`](./ACCESSIBILITY_TESTING.md) — application accessibility versus publication-content boundary.
- [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md) — responsive navigation geometry/focus/scroll-lock contract.
- [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md) — progressive enhancement only; motion never becomes state/request/persistence ownership.

Current repository policy is enforced by modern purpose-specific guards/tests. Obsolete R-series and release-era standalone policy executables are intentionally absent behind `tools/check-retired-milestone-checkers.mjs` and `tools/check-retired-release-tools.mjs`; historical architecture/release records remain evidence rather than executable policy.

Audit G retained current deterministic tests, Node 22/npm 10.9.8, two committed lockfiles, no-bundler build, static preview, review-driven dependency maintenance, EPUB.js lifecycle revision guard, and the existing release publisher. It removed duplicate execution rather than weakening gates.

## CSS/design result

Audit F converged static cleanup to 0 literal unreferenced class candidates and 0 unused custom properties across 36 authored stylesheets / 2,254 selectors. Remaining specificity/`!important` pressure is concentrated in deliberate late-loaded workflow/theme/layout layers. Existing semantic surface split and behavioral accessibility/motion gates remain authoritative; no broad CSS rewrite was justified.

## Documentation/repository result

Audit H reconciled current roadmap/findings/index/build/test/CSS/maintenance/dependency documentation with accepted A–G ownership and expanded `check-documentation-freshness.mjs` to protect current status/architecture/operations surfaces, including root README and final Audit G closeout evidence. Release/archive/security milestone/history records remain outside the current-state scan by design.

Audits C–H were assembled onto the already-merged A/B history through PR #231. The resulting exact-main commit `cdbc57384a01e8c83dc13ff5fc1df6753fe93f97` independently passed Verify, Cloudflare Pages, Chromium desktop/mobile, Firefox desktop, and WebKit desktop/mobile before formal release metadata was converged. The exact release commit must still pass the reusable publisher's main-push verification, matching production version/commit, and smoke gates before GitHub release publication.
