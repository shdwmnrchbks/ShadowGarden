# Shadow Garden Architecture

This directory records the frozen **v1.15.14 starting baseline**, the accepted **v2.0.0 architecture baseline**, and the post-baseline contracts that remain authoritative for current v2 work.

Shadow Garden's active development line is **v2.11.0 — Engineering Audit, Refactor & Optimization**. The latest formal release remains **v2.10.0 — Maintenance & Supply Chain**. v2.11 does not replace the v2.0 ownership model or introduce a feature-expansion mandate; it audits the mature system and authorizes structural/performance work only when evidence demonstrates a real need.

## Current engineering phase

- [`ENGINEERING_AUDIT.md`](./ENGINEERING_AUDIT.md) — v2.11 audit methodology, finding/disposition format, refactor threshold, optimization threshold, and realistic-scale evidence rules.
- [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md) — the single active roadmap. Refactor and optimization slices are conditional and may be skipped/deferred after a clean audit.
- [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) — formal v2.10.0 release ownership versus active v2.11.0 deployment/development ownership.

## Baselines

- [`V1_BASELINE.md`](./V1_BASELINE.md) — original runtime surfaces, dependency direction, Reader invariants, identity formats, and duplicate ownership at the start of R0.
- [`v1-entrypoints.json`](./v1-entrypoints.json) — historical R0 entrypoint contract.
- [`V2_BASELINE.md`](./V2_BASELINE.md) — accepted v2 domain/UI/Reader/Keeper/Functions/design/test/build/security ownership baseline.
- [`v2-entrypoints.json`](./v2-entrypoints.json) — accepted v2 direct/runtime entrypoint manifest.
- [`PERSISTENCE_CONTRACTS.md`](./PERSISTENCE_CONTRACTS.md) — browser-local localStorage/IndexedDB contracts, cookies, and migration rules.
- [`HTTP_STORAGE_CONTRACTS.md`](./HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and private B2 namespace contracts.

## R10 final cutover and release gate

R10 established the accepted v2.0.0 architecture baseline and removed the final known obsolete compatibility/patch ownership paths. The permanent R10 guard continues to verify the frozen v2 entrypoint manifest, retired-source tombstones, semantic source ownership, build/release contracts, and the archived completed R0–R10 roadmap. The canonical completed roadmap is [`../archive/REFACTOR_ROADMAP.md`](../archive/REFACTOR_ROADMAP.md); the historical `docs/roadmaps/REFACTOR_ROADMAP.md` path is only a Git symlink for permanent guard/back-link compatibility.

## Repository/tooling contracts

- [`MODULE_CONVENTIONS.md`](./MODULE_CONVENTIONS.md) — naming, ownership, DOM/state, CSS, dependency direction, and placement conventions.
- [`BUILD_CONTRACT.md`](./BUILD_CONTRACT.md) — authored/generated boundaries, root policy, Node/CI policy, dependency strategy, and build-time asset cache-busting.
- [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) — locked dependency/install contract, deterministic build metadata, dependency-free preview, and no-bundler decision.
- [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) — deployment versus formal release version ownership and release-cut convergence.
- [`r1-legacy-source-exceptions.json`](./r1-legacy-source-exceptions.json) — retired-source tombstone manifest.

## Shared browser domain

- [`DOMAIN_LAYER.md`](./DOMAIN_LAYER.md) — canonical catalog, identity, progress, bookmarks, reading state, preferences, URL, formatting, and compatibility ownership.
- Implementation: `src/assets/js/domain/`.

The v2.11 audit checks this layer for duplicate interpretation/state ownership, unnecessary compatibility paths, circular dependencies, dead exports, and repeated normalization/formatting logic. No rewrite is implied by the audit.

## Public Library and Series

- [`PUBLIC_UI_LAYER.md`](./PUBLIC_UI_LAYER.md) — Library/Series controllers, query/render ownership, shared volume actions, refresh lifecycle, and removed repair layers.
- [`TRANSLATION_METADATA.md`](./TRANSLATION_METADATA.md) — fan translator credits, translation status, series-to-volume inheritance, filtering, Series attribution, and Keeper write ownership.

The audit focuses on model/render separation, navigation restoration, DOM churn at realistic library scale, and whether any duplicated state/action owner has reappeared.

## Reader application

- [`READER_LAYER.md`](./READER_LAYER.md) — authorized Reader session, orchestrator/controllers, Page/Continuous adapters, canonical Page Map/state ownership, Pages-only navigation input, image focus, search/TOC/note compatibility, resume behavior, and retained EPUB.js boundaries.
- Continuous EPUB documents retain native vertical scrolling with no Reader-owned EPUB-document `touchmove` interception.
- Split-XHTML chapter identity, protected media ticket renewal, image focus, Pages/Continuous ownership separation, and visual containment remain permanent regression contracts.
- v2.8 Reader Experience features remain layered on the same owners; the completed footnote/endnote audit is archived under [`../archive/V2_8_FOOTNOTE_AUDIT.md`](../archive/V2_8_FOOTNOTE_AUDIT.md).

The v2.11 audit may profile Reader startup and extended Continuous sessions at realistic EPUB scale. It must not introduce a Reader rewrite merely because the Reader is a high-risk subsystem.

## Garden Keeper application

- [`KEEPER_LAYER.md`](./KEEPER_LAYER.md) — single AdminClient, composition root, signed-session boundary, isolated workflows, and contained Upload internals.
- v2.9 productivity/recovery work remains owned by the same canonical admin/catalog/storage layers.

The audit checks workflow duplication, request/catalog repetition, operation lifetime/error ownership, and high-volume batch behavior. Any refactor remains conditional on material findings.

## Pages Functions service layer

- [`FUNCTIONS_LAYER.md`](./FUNCTIONS_LAYER.md) — thin Pages Function routes over Authentication, Media, Catalog, Storage, Validation, Abuse, HTTP, and Admin services.
- Persistent public cooldown enforcement remains outside `/media/*`; Range delivery remains signed-ticket authorized.
- Production B2 access remains owned by `functions/services/storage.js` using `aws4fetch`; local operator tools may use the AWS S3 client with explicit static credentials.

The v2.11 audit checks route/service responsibility, repeated request/object/error handling, service coupling, and unnecessary network/storage work without weakening the security boundary.

## CSS and design system

- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — semantic public, Library, Reader, and Garden Keeper CSS ownership.
- Public/Keeper foundation tokens remain scoped to `site.css`; Reader chrome/theme tokens remain Reader-scoped.
- [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md) — progressive motion ownership, navigation intent, Keeper observer-only feedback, and reduced-motion rules.
- [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md) — responsive drawer viewport/focus/layout/background-scroll contract.

The audit checks dead selectors, duplicated tokens, compatibility rules, specificity workarounds, and feature/component ownership before proposing any CSS consolidation.

## Test and accessibility architecture

- [`TEST_ARCHITECTURE.md`](./TEST_ARCHITECTURE.md) — deterministic unit/service/DOM/browser-contract testing plus the permanent Playwright real-browser layer.
- [`ACCESSIBILITY_TESTING.md`](./ACCESSIBILITY_TESTING.md) — Library/Series/Reader/Keeper accessibility verification and the application-chrome versus publication-content boundary.
- Deterministic fixtures cover Main/Adult, single/multi-volume, long metadata, visual EPUB pages, reading-state variants, media authorization, recovery, and other high-risk contracts.
- `.github/workflows/e2e.yml` runs Chromium, Firefox, WebKit, Chromium Mobile, and WebKit Mobile on pull requests and `main`, plus monthly/manual baseline reruns.

v2.11 audits whether milestone-era source-text guards still own a meaningful permanent contract and whether any behavior can safely move to stronger behavior-level coverage. Existing guards are not removed merely because they are old.

## Maintenance baseline

- [`MAINTENANCE_BASELINE.md`](./MAINTENANCE_BASELINE.md) — monthly/manual deterministic security, recovery, realistic-scale Library sanity, production build, and complete real-browser/accessibility baselines.
- `tools/check-dependency-maintenance.mjs`, `tools/dependency-audit-report.mjs`, and `tools/check-runtime-lockfiles.mjs` keep dependency changes reviewable, audit findings policy-driven, and runtime/lockfile drift explicit.
- `tools/check-documentation-freshness.mjs` guards current-roadmap/docs/version markers.
- `tools/check-release-metadata.mjs` guards formal package/lockfile/changelog/release-note/publisher/build-context synchronization.
- `tools/check-baseline-maintenance.mjs` guards recurring maintenance and realistic-scale baseline ownership.

## Completed planning history

Completed planning is canonical under [`../archive/README.md`](../archive/README.md):

- [`../archive/SECURITY_ROADMAP.md`](../archive/SECURITY_ROADMAP.md) — Security & Anti-Abuse Milestones 1–9.
- [`../archive/REFACTOR_ROADMAP.md`](../archive/REFACTOR_ROADMAP.md) — R0–R10 full-codebase refactor ending at v2.0.0.
- [`../archive/ROADMAP_V2_6_TO_V2_10.md`](../archive/ROADMAP_V2_6_TO_V2_10.md) — v2.6 reliability through v2.10 maintenance.
- [`../archive/V2_8_FOOTNOTE_AUDIT.md`](../archive/V2_8_FOOTNOTE_AUDIT.md) — completed Reader note-compatibility audit.

`docs/roadmaps/CURRENT_ROADMAP.md` is the only active planning document. The old Security and Refactor roadmap paths remain only as Git symlinks into the archive so historical guardrails and back-links keep resolving without duplicate content.

## Permanent guardrails

The mature v2 codebase retains its established deterministic guards, including R0–R10 ownership/security/build checks, v2.6 real-browser structure checks, dependency/runtime/documentation/release/baseline maintenance checks, and the complete deterministic + Playwright suites. The v2.11 audit determines whether any old guard has become obsolete only by proving that its contract has another stronger owner or no supported state remains.

Future structural work starts from [`V2_BASELINE.md`](./V2_BASELINE.md), the active post-baseline contracts above, [`ENGINEERING_AUDIT.md`](./ENGINEERING_AUDIT.md), and [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md). Historical implementations may be restored only for explicit compatibility requirements with clear ownership and regression coverage; obsolete duplicate owners must not return.

- [`CATALOG_TAXONOMY.md`](./CATALOG_TAXONOMY.md) — canonical Novel Updates genres and catalog taxonomy ownership.
