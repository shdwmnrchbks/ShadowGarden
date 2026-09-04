# v2.11 Engineering Audit — Findings & Decisions

> **Status:** 🟨 Active — v2.11A in progress  
> **Formal baseline release:** v2.10.0  
> **v2.11 execution baseline:** `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`  
> **First landed v2.11 slice:** `8c5145b490bda77b5db5527f957ad4bcfea0b113`  
> **Roadmap:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)  
> **Started:** 2026-09-04

This is the working evidence record for v2.11. Findings are recorded before implementation. Refactoring and optimization are not assumed outcomes: stable areas are allowed to close with **no change needed**, and valid concerns may be deferred when benefit does not justify risk.

The execution baseline includes the v2.10 release plus subsequent maintenance that fixed the B2 integrity regression, reduced catalog-history retention from 30 to 15, and retired Batch Edit/Batch Artwork without replacing the canonical single-item owners.

## Decision vocabulary

- ⏭ **No change needed / skipped**
- 🧹 **Cleanup justified**
- 🛠 **Targeted refactor justified**
- ⚡ **Measured optimization justified**
- ⏸ **Deferred**
- 🔎 **Investigate**

## Findings register

| ID | Area | Evidence | Impact | Risk | Decision | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| A-001 | Frozen v2 manifest vs current runtime inventory | `docs/architecture/v2-entrypoints.json` is intentionally frozen at the v2.0/R10 cutover while later releases added legitimate modules. | A historical manifest can be mistaken for a moving current inventory. | Low | ⏭ Keep the frozen manifest immutable; maintain current inventory separately. | Compare current composition roots/direct entrypoints against the frozen manifest and record intentional additions. |
| A-002 | R6 compatibility facades | `functions/_lib/b2.js` and `functions/_lib/garden-maintenance.js` contain only re-exports from current service owners. The known historical executable consumer, `check-r6.mjs`, was retired with the R-series milestone checkers. Current routes, services, security checks, tests, and operational tooling use the service owners and retained real `_lib` primitives directly; current repository review found no remaining import of either facade. | Keeping unused compatibility files preserves obsolete ownership surface and invites new code to depend on historical aliases. | Low runtime risk; medium ownership-drift risk | 🧹 Retire both compatibility facades and guard their absence/import paths. | Active `npm run check` includes `check-retired-r6-facades.mjs`; Verify, security/service coverage, build, and five-project E2E must remain green. |
| A-003 | Historical R0–R10 checker ownership | Every reviewed R-series milestone checker (`check-r0.mjs` through `check-r10.mjs`, including R4.1) asserted that itself and/or earlier milestone scripts must still be chained through `npm run check`. That is intentionally false in the current architecture: fast Verify owns current repository contracts/build, Baseline Health owns modern security/full deterministic tests/performance, and real-browser E2E owns the five-project browser matrix. Several R checks also encode frozen release-era file lists and exact historical test-chain assumptions. | Keeping self-invalid executables beside current checks makes obsolete policy look runnable and increases drift/maintenance risk. Re-enabling them would contradict the evolved verification split. | Low runtime risk; medium tooling-policy risk | 🧹 Retire the obsolete R-series executables and guard their absence. Preserve historical architecture/release records and current modern checks/tests. | Active `npm run check` includes `check-retired-milestone-checkers.mjs`; Verify/build and five-project E2E must remain green. Broader M-series and post-R historical tooling remain Audit G scope. |
| A-004 | Authored Reader cache-version ownership | `src/assets/js/reader/app.js` carried `./toc.js?v=1.2.3`, `./page-map.js?v=1.2.0`, and `./book-search.js?v=2.8.1`, despite the R10/build contract assigning local cache versions to build-time deployment stamping. | Two cache-version owners can drift and preserve stale release-history strings in authored source. | Low runtime risk; medium maintainability/contract risk | 🧹 Implemented: remove the three authored query versions and add `tools/check-authored-cache-versions.mjs` to active `npm run check`. | Exact-head Verify and all five real-browser projects passed; exact-main Verify/E2E passed on `8c5145b...`; Cloudflare deployed that exact commit successfully. |
| A-005 | Retired patch/dead-owner tombstones | Existing tombstones plus pre-v2.11 maintenance keep known patch-style owners and retired Batch Edit/Artwork source/backend paths absent. | Confirms prior duplicate/repair owners have not obviously returned. | Low | ⏭ No refactor from this evidence. | Active repository checks and current inventory. |
| A-006 | Keeper post-v2 ownership growth | Batch Edit and Batch Artwork were deliberately removed before v2.11. Normal Library editing, series-banner selection, cover maintenance, upload cover handling, and multi-EPUB upload remain separate canonical owners. | Smaller Keeper/API surface; avoids auditing removed product behavior as if it were still required. | Low | ⏭ Removal is the product decision; no replacement. | Exact-main Keeper/browser coverage and retired-path tombstones. |
| A-007 | Reader post-v2 module growth | Search, resume, error presentation, interaction/navigation helpers, and touch compatibility are post-v2 additions composed by the Reader app. File growth alone is not duplicate ownership. | Reader remains highest-risk and needs dedicated ownership/runtime review. | Medium | 🔎 Continue in Audit B; no structural refactor from inventory alone. | Reader ownership review plus long-session/large-EPUB evidence. |

## v2.11A — Repository & ownership inventory

### Completed evidence

- [x] Fixed execution baseline at `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`.
- [x] Preserved frozen v2.0 manifest as historical evidence rather than rewriting it into a moving manifest.
- [x] Confirmed retired Batch Edit/Artwork owners are absent from current composition and protected by tombstones.
- [x] Identified and traced the R6 compatibility facades: both are forwarding-only aliases with no current repository consumer; retirement is guarded against reintroduction/imports.
- [x] Identified active-vs-historical checker drift for Audit G.
- [x] Identified authored Reader `?v=` imports as a concrete build-contract drift.
- [x] Removed the three confirmed authored query versions and added a permanent authored-source cache-version scan.
- [x] Verified the cache-version cleanup on exact PR head and exact main with Verify plus the complete five-project real-browser matrix; exact-main Cloudflare deployment also succeeded.
- [x] Classified the R0–R10 executable milestone checkers as obsolete/self-invalid policy snapshots and implemented their retirement with a permanent absence guard.

### Remaining v2.11A work

- [ ] Finish current direct/composed entrypoint inventory for public Library/Series, Reader, Keeper, Functions, and operational tools.
- [ ] Identify any additional unreachable source, obsolete migration-only paths, unused exports, stale fixtures, or obsolete current documentation references.
- [ ] Give every remaining Audit A candidate a retain / cleanup / refactor / defer / skip disposition before closing Audit A.

## Measurements

### Library / Series

Pending v2.11C. Use the deterministic ~300-series fixture for realistic upper-bound measurements.

### Reader

Pending v2.11B. Measure representative large-EPUB startup and long Continuous sessions before proposing optimization.

### Garden Keeper

Pending v2.11D. Audit only retained workflows; Batch Edit and Batch Artwork are retired product surface.

### Functions / storage / network

The R6 forwarding-facade question is resolved at inventory level: current B2/auth/http/catalog/validation ownership lives in `functions/services/`, while retained `_lib` files are real primitives consumed by those services. Deleting the two forwarding aliases does not change storage/auth/media/catalog implementation; v2.11E still owns the deeper security/storage audit.

### Build / tests / tooling

R0–R10 executable milestone-checker ownership has been reconciled: they are historical policy snapshots, not current verification owners. Current verification remains split between fast Verify/current checks, Baseline Health security/full deterministic/performance coverage, and complete real-browser E2E. Audit G still owns M-series, v2.6-era, dependency, duration, and remaining tooling review.

## Security and recovery notes

No current v2.11A finding justifies changing storage/auth/media/recovery implementation ownership. The R6 facade cleanup removes only forwarding aliases; current services and security primitives remain unchanged and require their existing service/security/browser regression evidence.

Retiring the R-series milestone executables does not remove current security coverage: `tools/check.mjs` retains the per-change security baseline; `tools/check-security.mjs` remains the dedicated security contract and is exercised by Baseline Health; service tests and real-browser coverage remain unchanged.

The v2.11 start does not change catalog storage, B2 credentials, signed media flow, Reader persistence ownership, recovery anchors, or catalog snapshot semantics.

## Implementation log

### I-001 — Restore single cache-version owner in authored Reader imports

**Source finding:** A-004  
**Status:** ✅ Landed and verified on exact main `8c5145b490bda77b5db5527f957ad4bcfea0b113`  
**Scope:**

- remove hard-coded `?v=` history from Reader imports of TOC, Page Map, and book search;
- add `tools/check-authored-cache-versions.mjs`;
- wire the check into normal `npm run check`;
- advance `deploymentVersion` to 2.11.0 while formal `version` remains 2.10.0.

**Acceptance:**

- repository-wide authored cache-version scan passes;
- Verify passes;
- production build passes;
- full Chromium/Firefox/WebKit desktop plus Chromium/WebKit mobile Reader regression matrix passes;
- Cloudflare deploys the exact main commit successfully;
- generated assets continue receiving the active deployment version through build-time stamping.

### I-002 — Retire obsolete R0–R10 executable milestone policy

**Source finding:** A-003  
**Status:** ✅ Landed on main `3a44c1c3cd0f1b1bea0bd694fc527d467b684d61`  
**Scope:**

- remove `tools/check-r0.mjs` through `tools/check-r10.mjs`, including `tools/check-r4-1.mjs`;
- keep historical refactor roadmap, architecture baselines, release notes, and Git history unchanged;
- add `tools/check-retired-milestone-checkers.mjs` and wire it into active `npm run check` so the obsolete executable snapshots cannot silently return;
- leave current M-series, `check-v2-6.mjs`, current dependency/runtime/docs/release/baseline/cache checks, security checker, deterministic tests, and browser E2E unchanged.

**Acceptance:**

- active repository check passes with all twelve retired executable paths absent;
- production build passes;
- complete five-project real-browser E2E passes;
- no package version/release metadata convergence occurs from this tooling-only cleanup.

### I-003 — Retire unused R6 compatibility facades

**Source finding:** A-002  
**Status:** 🧹 Implemented in the current v2.11 cleanup candidate  
**Scope:**

- remove forwarding-only `functions/_lib/b2.js` and `functions/_lib/garden-maintenance.js`;
- keep the actual B2/auth/http/catalog/validation owners unchanged under `functions/services/`;
- add `tools/check-retired-r6-facades.mjs` to reject either retired path and any future JS/MJS/CJS import of it;
- wire that guard into active `npm run check`;
- reconcile current audit/inventory/Functions-layer documentation without rewriting frozen R6 release history.

**Acceptance:**

- the retired-facade guard passes with both files absent and no current import;
- current security/service checks pass against the real service owners;
- production build passes;
- complete five-project real-browser E2E passes;
- no route, dependency, lockfile, or formal release-version change is introduced.

## Deferred / skipped recommendations

- Do **not** rewrite `v2-entrypoints.json` into a moving manifest.
- Do **not** restore or replace retired Batch Edit/Artwork functionality.
- Do **not** restructure Reader modules from age/file-count alone.
- Do **not** restore the retired R6 forwarding facades unless a concrete compatibility contract is re-established; current code must import the real service owner.
- Do **not** restore historical R0–R10 milestone executables as current policy; the active absence guard owns that decision.
- Do **not** assume M-series or later release-era standalone checks are redundant because the R-series was retired; Audit G must review them separately.
- Do **not** optimize Library/Reader/Keeper without reproducible realistic-scale evidence.

## Audit closeout

v2.11 closes only after every major surface in the current roadmap has an explicit evidence-backed outcome and all accepted implementation slices are complete or deliberately deferred. A formal v2.11.0 release is a separate release-cut decision after that work is verified.
