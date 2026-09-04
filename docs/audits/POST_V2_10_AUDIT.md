# v2.11 Engineering Audit — Findings & Decisions

> **Status:** 🟨 Active — v2.11A in progress  
> **Formal baseline release:** v2.10.0  
> **v2.11 execution baseline:** `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`  
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
| A-002 | R6 compatibility facades | `functions/_lib/b2.js` and `functions/_lib/garden-maintenance.js` are compatibility facades over current services rather than second implementations. | Removing them blindly can break tests/tools/back-links; keeping unused facades also has maintenance cost. | Medium | 🔎 Trace runtime/test/tool consumers before retain/remove decision. | Reference graph plus service/security regression coverage. |
| A-003 | Historical R0–R10 checker ownership | `tools/check-r0.mjs`…`check-r10.mjs` still exist, while active `npm run check` is owned by newer repository/dependency/runtime/docs/release/baseline/performance checks. | Documentation and executable policy can drift; re-enabling every historical regex check would also duplicate or contradict evolved behavior coverage. | Medium | 🔎 Audit G must classify each checker as modernize, replace, standalone-history, or archive. | Map old assertions to current behavior checks/tests and measure duplicate CI cost. |
| A-004 | Authored Reader cache-version ownership | `src/assets/js/reader/app.js` carried `./toc.js?v=1.2.3`, `./page-map.js?v=1.2.0`, and `./book-search.js?v=2.8.1`, despite the R10/build contract assigning local cache versions to build-time deployment stamping. | Two cache-version owners can drift and preserve stale release-history strings in authored source. | Low runtime risk; medium maintainability/contract risk | 🧹 **Implemented in first v2.11 slice:** remove the three authored query versions and add `tools/check-authored-cache-versions.mjs` to active `npm run check`. | Verify must prove the repository-wide authored `src/` scan is clean; five-browser Reader coverage must pass exact head. |
| A-005 | Retired patch/dead-owner tombstones | Existing tombstones plus pre-v2.11 maintenance keep known patch-style owners and retired Batch Edit/Artwork source/backend paths absent. | Confirms prior duplicate/repair owners have not obviously returned. | Low | ⏭ No refactor from this evidence. | Active repository checks and current inventory. |
| A-006 | Keeper post-v2 ownership growth | Batch Edit and Batch Artwork were deliberately removed before v2.11. Normal Library editing, series-banner selection, cover maintenance, upload cover handling, and multi-EPUB upload remain separate canonical owners. | Smaller Keeper/API surface; avoids auditing removed product behavior as if it were still required. | Low | ⏭ Removal is the product decision; no replacement. | Exact-main Keeper/browser coverage and retired-path tombstones. |
| A-007 | Reader post-v2 module growth | Search, resume, error presentation, interaction/navigation helpers, and touch compatibility are post-v2 additions composed by the Reader app. File growth alone is not duplicate ownership. | Reader remains highest-risk and needs dedicated ownership/runtime review. | Medium | 🔎 Continue in Audit B; no structural refactor from inventory alone. | Reader ownership review plus long-session/large-EPUB evidence. |

## v2.11A — Repository & ownership inventory

### Completed evidence

- [x] Fixed execution baseline at `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`.
- [x] Preserved frozen v2.0 manifest as historical evidence rather than rewriting it into a moving manifest.
- [x] Confirmed retired Batch Edit/Artwork owners are absent from current composition and protected by tombstones.
- [x] Identified R6 compatibility facades as retain/remove candidates that require consumer evidence.
- [x] Identified active-vs-historical checker drift for Audit G.
- [x] Identified authored Reader `?v=` imports as a concrete build-contract drift.
- [x] Applied the smallest cleanup: remove the three confirmed authored query versions.
- [x] Added a permanent authored-source cache-version scan to active `npm run check`.

### Remaining v2.11A work

- [ ] Let exact-head Verify prove no other authored local `?v=` cache-history references remain.
- [ ] Finish current direct/composed entrypoint inventory for public Library/Series, Reader, Keeper, Functions, and operational tools.
- [ ] Trace runtime/test/tool consumers of `functions/_lib/b2.js` and `functions/_lib/garden-maintenance.js`.
- [ ] Identify any additional unreachable source, obsolete migration-only paths, unused exports, stale fixtures, or obsolete current documentation references.
- [ ] Give every candidate a retain / cleanup / refactor / defer / skip disposition before closing Audit A.

## Measurements

### Library / Series

Pending v2.11C. Use the deterministic ~300-series fixture for realistic upper-bound measurements.

### Reader

Pending v2.11B. Measure representative large-EPUB startup and long Continuous sessions before proposing optimization.

### Garden Keeper

Pending v2.11D. Audit only retained workflows; Batch Edit and Batch Artwork are retired product surface.

### Functions / storage / network

Pending v2.11E. R6 facade retention is the current inventory question; no second B2/auth implementation has been established.

### Build / tests / tooling

Pending v2.11G. A-003 is a policy/coverage reconciliation finding, not permission to re-enable all historical source-regex checks.

## Security and recovery notes

No current v2.11A finding justifies changing storage/auth/media/recovery ownership. Any facade cleanup crossing storage/auth/http boundaries is security-sensitive and requires explicit service regression evidence.

The v2.11 start does not change catalog storage, B2 credentials, signed media flow, Reader persistence ownership, recovery anchors, or catalog snapshot semantics.

## Implementation log

### I-001 — Restore single cache-version owner in authored Reader imports

**Source finding:** A-004  
**Status:** 🟨 Implemented on the v2.11 start branch; verification pending  
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
- generated assets continue receiving the active deployment version through build-time stamping.

## Deferred / skipped recommendations

- Do **not** rewrite `v2-entrypoints.json` into a moving manifest.
- Do **not** restore or replace retired Batch Edit/Artwork functionality.
- Do **not** restructure Reader modules from age/file-count alone.
- Do **not** delete R6 facades until consumer evidence exists.
- Do **not** re-enable historical R0–R10 checks wholesale; Audit G must reconcile overlap and obsolescence first.
- Do **not** optimize Library/Reader/Keeper without reproducible realistic-scale evidence.

## Audit closeout

v2.11 closes only after every major surface in the current roadmap has an explicit evidence-backed outcome and all accepted implementation slices are complete or deliberately deferred. A formal v2.11.0 release is a separate release-cut decision after that work is verified.
