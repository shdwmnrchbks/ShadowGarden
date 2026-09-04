# Shadow Garden Current Roadmap — Engineering Audit, Refactor & Optimization

> **Status:** 🟨 **AUDIT PHASE ACTIVE**  
> **Starting baseline:** v2.10.0 — Maintenance & Supply Chain  
> **Active release:** v2.11.0 — Engineering Audit, Refactor & Optimization  
> **Latest formal release:** v2.10.0  
> **Updated:** 2026-09-04

Shadow Garden has enough product features for the current operating horizon. v2.11.0 is therefore an engineering-health milestone, not a feature milestone. Its first responsibility is to audit the mature v2 codebase and produce evidence about where structural refactoring or performance optimization is actually justified.

No refactor or optimization is pre-approved by this roadmap. A later implementation slice exists only when the audit demonstrates a concrete ownership, maintainability, reliability, testability, or measured performance problem. If the audit finds the current structure healthy, the corresponding refactor/optimization slices are explicitly **skipped or deferred** rather than performed to satisfy the release number.

Completed planning history is archived under [`../archive/README.md`](../archive/README.md). This file is the single active project roadmap.

## Working rules

1. **Audit before modification.** Establish evidence before changing architecture or performance behavior.
2. **No feature expansion.** v2.11 does not add new Reader, Library, Series, Keeper, or public-security product features unless a narrowly scoped correction is required to preserve an audited contract.
3. **Behavior-preserving refactors by default.** Structural changes must keep externally observable behavior stable and add regression coverage when ownership moves.
4. **Optimize only measured bottlenecks.** Use realistic personal-library scale: roughly 250–300 series plus representative large EPUBs and Keeper workflows.
5. **Skip healthy areas.** “No change required” is a valid audited outcome.
6. **Preserve v2 ownership.** Do not reintroduce duplicate state/UI owners, repair layers, or compatibility patches without an explicit compatibility requirement.
7. **Preserve security invariants.** Private B2, signed media tickets, opaque identities, Turnstile/Garden Pass, signed Keeper sessions, abuse controls, protected Range delivery, and catalog redaction remain contracts.
8. **Reading data stays browser-local.** No Reader accounts or server-side reading history.
9. **Accessibility and browser reliability remain functional requirements.** Existing deterministic and real-browser gates remain authoritative.
10. **Small mergeable slices.** Every accepted refactor or optimization must leave `main` deployable and independently reviewable.

## Finding disposition

Every audit finding must end in exactly one state:

- **No action** — healthy ownership/performance; record the evidence and leave the code alone.
- **Cleanup** — dead code, stale compatibility material, documentation drift, or low-risk simplification with no ownership redesign.
- **Targeted refactor** — a demonstrated maintainability/reliability/testability problem with a clear replacement owner and acceptance tests.
- **Measured optimization** — a reproduced realistic-scale bottleneck with before/after evidence.
- **Deferred** — valid issue but low value, high risk, or no present user/operational impact.

## Roadmap overview

| Slice | Status | Primary outcome |
| --- | --- | --- |
| **2.11A — Baseline & inventory** | ⬜ Planned | Freeze current module/runtime/test/performance evidence before judging structure |
| **2.11B — Architecture & ownership audit** | ⬜ Planned | Identify duplicate owners, unsafe coupling, dead compatibility paths, oversized responsibilities, and test-fragile seams |
| **2.11C — Performance & resource audit** | ⬜ Planned | Profile realistic Library, Reader, Keeper, build/test, and server-boundary costs |
| **2.11D — Targeted refactor slices** | ⏸ Conditional | Execute only refactors justified by 2.11B; skip if no material findings exist |
| **2.11E — Targeted optimization slices** | ⏸ Conditional | Execute only optimizations justified by 2.11C; skip if no material bottlenecks exist |
| **2.11F — Cleanup & reconciliation** | ⬜ Planned | Remove proven-dead debt and reconcile architecture/docs/tests with final audited state |
| **2.11G — Final audit acceptance** | ⬜ Planned | Close every finding with evidence and prove no baseline contract regressed |

---

# v2.11.0 — Engineering Audit, Refactor & Optimization

**Status:** 🟨 Audit planning active  
**Goal:** determine where the mature Shadow Garden v2 implementation genuinely needs structural or performance work, then make only evidence-backed changes.

## 2.11A — Baseline & inventory

- [ ] Record the current source/module inventory for `src/`, `functions/`, `tools/`, and the test layers.
- [ ] Record direct dependency/runtime ownership and identify which dependencies are production-runtime, build/test-only, or local-operator-only in practice.
- [ ] Identify the largest and most frequently changed source modules, high fan-in/fan-out modules, and known compatibility layers.
- [ ] Record the current deterministic test count/layers, five-project browser matrix, build path, and recurring maintenance baseline.
- [ ] Capture realistic performance observations for the existing 300-series Library sanity fixture and at least one representative large EPUB path.
- [ ] Record build/check/test duration only as comparative engineering evidence; do not create brittle CI budgets from one run.

### 2.11A acceptance

- [ ] Audit evidence can be reproduced from committed code/fixtures without production secrets.
- [ ] The baseline distinguishes architectural risk from simple file size or style preference.
- [ ] No production behavior changes are required to complete the baseline.

## 2.11B — Architecture & ownership audit

Audit each major owner independently:

- [ ] Shared browser domain/state: catalog, identity, progress, bookmarks, reading state, preferences, storage, URLs, formatting.
- [ ] Library + Series public UI: query/model/render ownership, navigation, volume actions, persistence boundaries.
- [ ] Reader: session/bootstrap, rendition adapters, Page Map/progress, navigation input, image focus, search/TOC/note compatibility, resume/ticket renewal.
- [ ] Garden Keeper: shell/client/session, Library/Series, Upload, Maintenance, History, Trash/Recovery, Abuse Watch, version UI.
- [ ] Pages Functions: routes, auth, media, catalog, storage, validation, abuse, HTTP, admin helpers.
- [ ] CSS/design system: duplicate selectors/tokens, cascade ownership, obsolete compatibility rules, component versus feature ownership.
- [ ] Tooling/build/tests: duplicate fixture logic, obsolete milestone-only checks, hidden source-contract coupling, generated/authored boundary leakage.

For each area, check for:

- duplicate state or workflow ownership;
- circular or reverse dependency direction;
- modules doing unrelated jobs that change for unrelated reasons;
- compatibility code whose original supported state no longer exists;
- repeated parsing/normalization/formatting logic that can diverge;
- tests that assert implementation text where behavior-level coverage can safely own the contract;
- dead code, unreachable branches, unused exports, obsolete aliases, and stale comments/docs;
- error handling or lifecycle logic that is materially harder to reason about than the behavior requires.

### Refactor trigger

Create a 2.11D implementation slice only when a finding has all of the following:

1. a concrete problem statement and affected owner;
2. evidence of duplication, coupling, fragility, recurring defect risk, or disproportionate change cost;
3. a smaller/clearer target ownership model;
4. deterministic and/or real-browser acceptance coverage appropriate to the risk;
5. a bounded migration that does not require a framework rewrite.

If no finding meets this threshold, **2.11D is marked skipped/deferred and no refactor is performed**.

## 2.11C — Performance & resource audit

- [ ] Measure Library hydration, search, filtering, sorting, view changes, and representative Series navigation around the expected 250–300-series ceiling.
- [ ] Measure or instrument Reader time-to-first-readable-content for a representative large EPUB without turning timing noise into a release budget.
- [ ] Exercise an extended Continuous session for obvious runaway memory/layout/long-task behavior using browser tooling or repeatable diagnostics where practical.
- [ ] Audit repeated catalog parsing, DOM rebuilds, event/listener lifetime, storage access, and unnecessary network/service round trips in representative flows.
- [ ] Audit Garden Keeper high-volume/batch workflows for avoidable serialization, duplicated fetches, or UI work that scales poorly at realistic use.
- [ ] Record build/check/test hotspots only if they materially slow maintenance iteration.

### Optimization trigger

Create a 2.11E implementation slice only when a bottleneck is reproducible at realistic scale and has a measurable user or maintenance cost. The optimization proposal must include a before measurement, expected mechanism, risk assessment, and an after measurement.

If realistic use remains healthy, **2.11E is marked skipped/deferred and no speculative optimization is performed**.

Explicitly prohibited without evidence:

- Library virtualization/infinite rendering for hypothetical 1,000+ series collections;
- framework or bundler migration as a generic “performance” project;
- server-side Reader state for convenience or speed;
- weakening accessibility, motion, browser support, security, or recovery gates;
- replacing clear native code with abstraction solely to reduce line count.

## 2.11D — Targeted refactor slices

**Status:** ⏸ Conditional pending 2.11B

- [ ] Convert each accepted architectural finding into its own small PR/slice.
- [ ] Document old owner → new owner and deletion/cutover boundary.
- [ ] Preserve public routes, persistence formats, security boundaries, Reader behavior, and Keeper workflows unless the audited issue is explicitly behavioral.
- [ ] Delete replaced compatibility/duplicate ownership in the same slice when safe; do not leave shadow owners behind.
- [ ] Update architecture contracts and regression guards with each accepted ownership change.

**Skip rule:** if 2.11B finds no material refactor candidate, mark this entire slice **⏸ Deferred / no refactor needed**.

## 2.11E — Targeted optimization slices

**Status:** ⏸ Conditional pending 2.11C

- [ ] Optimize only one reproduced hotspot per slice where practical.
- [ ] Preserve behavior and compare before/after evidence on the same realistic fixture/path.
- [ ] Prefer removing repeated work, unnecessary I/O, avoidable DOM churn, or accidental recomputation before introducing new infrastructure.
- [ ] Keep broad performance sanity thresholds as regression tripwires, not microbenchmark scoreboards.

**Skip rule:** if 2.11C finds no material bottleneck, mark this entire slice **⏸ Deferred / no optimization needed**.

## 2.11F — Cleanup & reconciliation

- [ ] Remove dead compatibility code, obsolete aliases, superseded milestone-only documentation, and duplicate comments only when the audit proves they are no longer contract owners.
- [ ] Reconcile `README.md`, `docs/README.md`, architecture index/contracts, roadmap/archive index, and test documentation with the audited final state.
- [ ] Keep historical release notes and archived planning immutable except for navigation/index corrections.
- [ ] Record deferred findings with enough evidence to avoid repeatedly re-auditing the same non-issue.

## 2.11G — Final audit acceptance

- [ ] A committed audit report lists every material finding, evidence, disposition, and resulting PR/commit when applicable.
- [ ] Every architecture area and realistic performance path has an explicit outcome, including “no action required” where appropriate.
- [ ] No refactor or optimization exists solely because the roadmap expected one.
- [ ] `npm run check`, `npm test`, production build, security/recovery baseline, and the complete five-project real-browser matrix remain green.
- [ ] Private B2/security, browser-local Reader data, accessibility, recovery, and release-publisher contracts remain intact.
- [ ] Formal release metadata is cut only after the audit/refactor/optimization work is actually complete.

---

# Deferred product backlog

The previous feature backlog is intentionally not active v2.11 scope. It remains deferred until there is a new product need:

- richer browser-local Recently Read/completion history;
- saved Library views or deeper multi-filter composition;
- additional Keeper metadata conveniences;
- optional customer-owned Cloudflare-zone hardening;
- new Reader features not required to correct an audited defect.

## Completion rule

v2.11 is complete when the audit evidence is complete, every material finding has a disposition, all justified structural/performance changes are finished, and conditional refactor/optimization slices are explicitly marked done, skipped, or deferred. A clean audit with no refactor and no optimization is a successful outcome.
