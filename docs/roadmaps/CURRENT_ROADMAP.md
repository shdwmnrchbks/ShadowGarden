# Shadow Garden Current Roadmap — Post-v2.10 Audit, Refactor & Optimization

> **Status:** 🟨 **AUDIT IN PROGRESS**  
> **Active release:** v2.10.0 — Maintenance & Supply Chain  
> **Roadmap phase:** Audit first; refactor and optimization only when evidence justifies them  
> **Updated:** 2026-09-04

Shadow Garden has enough product features for the current website. The next work cycle is intentionally **not a feature roadmap**. It is an audit of the mature v2 codebase to determine whether any structural refactor, simplification, performance optimization, test/tooling improvement, or operational cleanup is actually warranted.

The completed v2.6–v2.10 roadmap is archived under [`../archive/V2_6_TO_V2_10_ROADMAP.md`](../archive/V2_6_TO_V2_10_ROADMAP.md). Earlier completed refactor and security roadmaps remain archived under [`../archive/README.md`](../archive/README.md). Audit findings and evidence belong under [`../audits/`](../audits/).

## Governing rule

**Audit before changing architecture.** Every proposed refactor or optimization must be backed by a concrete finding: duplicate ownership, unnecessary complexity, dead code, fragile coupling, repeated defects, measurable performance cost, excessive resource use, maintainability risk, or a gap in the permanent verification baseline.

A clean audit is a successful outcome. If a subsystem is healthy, its refactor/optimization step is marked **Skipped / no change needed** rather than rewritten for aesthetics.

## Status legend

- ⬜ Planned
- 🟨 In progress
- ✅ Complete
- 🛠 Change justified
- ⚡ Optimization justified
- ⏸ Deferred / no demonstrated need
- ⏭ Skipped / no change needed

## Non-negotiable constraints

1. **No feature expansion during the audit cycle.** New product ideas remain backlog material unless needed to fix a demonstrated defect.
2. **Preserve v2 ownership.** Do not create duplicate state, rendering, persistence, request, workflow, storage, or Reader owners.
3. **Preserve security invariants.** Private B2, signed media tickets, opaque identities, Turnstile/Garden Pass, signed Keeper sessions, abuse controls, protected Range delivery, and catalog redaction remain contracts.
4. **Reading data stays browser-local.** No Reader accounts or server-side reading history are introduced.
5. **Reader stability remains highest risk.** Pages, Continuous, Page Map, progress, bookmarks, image focus, ticket renewal, orientation changes, text search, and navigation require regression coverage around any change.
6. **Measure before optimizing.** Performance decisions use realistic personal-library scale (roughly 250–300 series) and representative large EPUBs rather than hypothetical enterprise-scale targets.
7. **No framework/bundler rewrite by default.** A platform/tooling change requires measured benefit that outweighs migration and ownership risk.
8. **Small, reversible implementation slices.** If the audit produces work, each slice must leave `main` deployable and independently verifiable.
9. **Permanent release gates stay authoritative.** `npm run check`, deterministic tests, production build, five-project real-browser E2E, deployment metadata, and production smoke remain the acceptance floor.

---

# v2.10.0 — Audited baseline

**Status:** ✅ Released and current baseline  
**Release record:** [`../releases/v2.10.0.md`](../releases/v2.10.0.md)  
**Purpose in this roadmap:** provide the fixed production baseline against which audit findings are measured.

The audit begins from the v2.10.0 ownership, security, maintenance, documentation, runtime, recovery, browser, accessibility, and realistic-scale verification contracts. Post-release dependency maintenance may advance `main`, but it does not change the formal baseline unless a later release is deliberately cut.

---

# Audit A — Repository and ownership inventory

**Status:** ⬜ Planned

## A1. Source inventory

- [ ] Inventory authored runtime entrypoints under `src/`, `functions/`, and operational `tools/`.
- [ ] Compare actual direct/runtime entrypoints with the frozen v2 architecture manifests and document intentional drift.
- [ ] Identify files that are generated, compatibility-only, legacy mirrors, one-off migration helpers, or no longer reachable.
- [ ] Identify dead code, unused exports, orphaned CSS selectors, unreachable routes, stale fixtures, and obsolete documentation references.
- [ ] Record findings in the post-v2.10 audit report before deleting or moving anything.

## A2. Ownership map

- [ ] Revalidate one-owner-per-responsibility across Library/Series, Reader, Keeper, Pages Functions, storage, catalog, auth, persistence, build/versioning, motion, and navigation.
- [ ] Flag duplicate state derivation, duplicated formatting/business rules, parallel request paths, or post-render repair layers.
- [ ] Check whether compatibility facades still earn their maintenance cost or can be retired safely.
- [ ] Check for cross-layer imports that violate the documented module/dependency direction.

## A decision gate

For each finding, classify one outcome:

- **⏭ No change needed** — ownership is clear and current structure is appropriate.
- **🛠 Refactor justified** — duplicated/fragile ownership or maintainability risk is demonstrated.
- **⏸ Deferred** — improvement is real but low-value or too risky relative to current use.

No structural rewrite is authorized merely because a different arrangement would look cleaner.

---

# Audit B — Reader architecture and long-session reliability

**Status:** ⬜ Planned

The Reader remains the highest-risk subsystem and receives a dedicated audit even if no Reader refactor follows.

## B1. Reader ownership review

- [ ] Recheck orchestration boundaries between the Reader app, Pages adapter, Continuous adapter, Page Map/progress, Contents/search, bookmarks, image focus, and protected book-session renewal.
- [ ] Look for duplicated position/progress calculations, mode-specific patches that could be consolidated, stale compatibility branches, or hidden global state.
- [ ] Review EPUB.js integration boundaries and confirm publication DOM manipulation remains minimal and mode-appropriate.
- [ ] Verify Pages-only gesture ownership and Continuous native-scroll ownership remain structurally obvious.

## B2. Reader runtime behavior

- [ ] Measure time-to-first-readable-page with a representative large EPUB fixture.
- [ ] Exercise extended Continuous reading and watch for runaway memory growth, repeated layout churn, event-listener accumulation, or long-task regressions.
- [ ] Exercise repeated Pages ↔ Continuous switching, Contents/search navigation, image focus, orientation changes, background/resume, and ticket renewal for state leaks.
- [ ] Inspect console/network diagnostics for avoidable repeated work or request churn.

## B decision gate

- [ ] Refactor only if ownership duplication, recurrent compatibility patches, or measurable reliability cost is demonstrated.
- [ ] Optimize only if large-EPUB/long-session measurements expose a meaningful bottleneck.
- [ ] Otherwise mark Reader refactor/optimization **⏭ Skipped / no change needed** and preserve the current architecture.

---

# Audit C — Library, Series and browser-local domain

**Status:** ⬜ Planned

## C1. Domain and UI ownership

- [ ] Revalidate canonical ownership for catalog normalization, filters/sort, reading state, progress, bookmarks, pinned state, preferences, URL state, and volume actions.
- [ ] Look for duplicated model work between Library and Series render paths.
- [ ] Identify repeated DOM repair, query recomputation, or state translation that should live in one domain helper.
- [ ] Review browser-local schema/migration code for obsolete compatibility paths that can now be retired safely.

## C2. Realistic-scale performance

- [ ] Reuse the deterministic ~300-series synthetic catalog as the normal upper-bound sanity case.
- [ ] Measure Library hydration, search, filtering, sorting, view changes, and Series navigation rather than relying only on the broad severe-regression ceiling.
- [ ] Inspect repeated sorting/filtering, unnecessary full rerenders, excessive DOM churn, and avoidable serialization/history work.
- [ ] Do not introduce virtualization or incremental rendering unless realistic measurements prove the current approach is inadequate.

## C decision gate

- [ ] If realistic-scale behavior is healthy and ownership is clear, mark Library/Series refactor and optimization **⏭ Skipped / no change needed**.
- [ ] If a bottleneck is reproduced, isolate the smallest change that fixes it and define a regression measurement before implementation.

---

# Audit D — Garden Keeper and operational workflows

**Status:** ⬜ Planned

## D1. Workflow structure

- [ ] Audit AdminClient, authentication/session, Library/Series, Upload, Maintenance, History, Trash, Abuse Watch, recovery readiness, and long-operation state ownership.
- [ ] Identify repeated request/busy/error patterns that can be simplified without creating a generic abstraction that obscures workflow behavior.
- [ ] Check high-impact mutation preview/confirmation/recovery paths for duplicated validation or divergent catalog/storage rules.
- [ ] Review bulk-edit, artwork, upload, recovery, and purge code for dead compatibility paths left after v2.9.

## D2. Operational cost

- [ ] Inspect expensive Keeper operations for unnecessary repeated catalog reads/writes, repeated object checks, or avoidable sequential network work.
- [ ] Verify any proposed batching/concurrency change respects B2/API limits, deterministic ordering, and recovery safety.

## D decision gate

- [ ] Skip Keeper refactor if current workflow ownership remains explicit and duplication is minor.
- [ ] Optimize only operations with measured latency/resource cost and a safe correctness-preserving improvement.

---

# Audit E — Pages Functions, security and storage boundaries

**Status:** ⬜ Planned

## E1. Service ownership

- [ ] Revalidate thin route adapters over auth, media, catalog, storage, validation, abuse, HTTP, and admin services.
- [ ] Check for duplicated response/error/header construction that causes real inconsistency rather than merely repeated syntax.
- [ ] Identify unused service exports, compatibility facades, obsolete routes, or redundant object-key/path normalization.
- [ ] Review request parsing and validation for unnecessary repeated work on hot paths.

## E2. Security/recovery invariants

- [ ] Rerun and inspect the security baseline, signed media flow, Keeper session flow, abuse controls, catalog redaction, private B2 boundaries, and recovery drill.
- [ ] Treat any simplification that weakens fail-closed behavior, signed authorization, Range delivery, object-key validation, or last-recoverable-state protection as invalid.
- [ ] Do not add fake client-side restrictions or security theater during cleanup.

## E decision gate

- [ ] Security-sensitive refactors require a demonstrated maintainability/correctness benefit plus service and real-browser regression coverage.
- [ ] If boundaries are already clear and reliable, mark the refactor **⏭ Skipped / no change needed**.

---

# Audit F — CSS, design system, motion and accessibility

**Status:** ⬜ Planned

- [ ] Inventory CSS ownership and identify genuinely unused selectors/tokens, duplicate component rules, specificity escalation, and obsolete compatibility classes.
- [ ] Revalidate separation between public/Keeper foundations and Reader-scoped chrome/theme ownership.
- [ ] Inspect responsive/mobile rules for repeated breakpoint patches that indicate a structural layout problem.
- [ ] Confirm motion remains observer-only and reduced-motion paths do not require parallel logic ownership.
- [ ] Rerun accessibility coverage and review keyboard/focus, forced colors, increased contrast, zoom/reflow, and touch targets for regressions introduced by accumulated styles.
- [ ] Avoid large CSS rewrites unless the audit demonstrates a concrete ownership/specificity/maintenance problem.

## F decision gate

- [ ] Remove dead CSS only when usage is proven absent across source and real-browser fixtures.
- [ ] Consolidate styling only when it reduces conflicting ownership or measurable maintenance risk.
- [ ] Otherwise mark design-system refactor **⏭ Skipped / no change needed**.

---

# Audit G — Build, dependencies, tests and tooling

**Status:** ⬜ Planned

## G1. Build/runtime/tooling

- [ ] Revalidate Node/npm pins, lockfile ownership, build-context/version stamping, no-bundler decision, preview server, and publisher workflow.
- [ ] Measure build/check/test duration and identify duplicated expensive work that provides no additional confidence.
- [ ] Review tools for overlapping responsibilities, stale migration scripts, brittle source-regex contracts, or checks that should become behavior tests.
- [ ] Keep dependency updates review-driven; do not broaden automation authority as part of refactoring.

## G2. Test architecture

- [ ] Map critical behavior to unit/service/DOM/browser-contract/real-browser layers and identify meaningful gaps or redundant tests.
- [ ] Prefer moving assertions to the lowest layer that can prove behavior without losing important browser truth.
- [ ] Review E2E duration/artifacts and fixture setup for avoidable duplication while preserving Chromium/Firefox/WebKit desktop and mobile authority.
- [ ] Inspect flaky or timing-sensitive tests before optimizing CI duration.

## G decision gate

- [ ] Tool/build/test refactors require either reduced fragility, lower duplicated cost, clearer ownership, or stronger coverage.
- [ ] If current tooling is simple and reliable, keep it.

---

# Audit H — Documentation and repository hygiene

**Status:** ⬜ Planned

- [ ] Verify every documentation index points to the current audit roadmap and canonical archived history.
- [ ] Remove stale statements that describe completed releases as active implementation work.
- [ ] Keep formal release records immutable except for factual corrections.
- [ ] Convert completed planning paths to archive links or clearly labeled compatibility mirrors where safe.
- [ ] Confirm architecture docs describe current owners rather than historical migration mechanics when both are mixed together.
- [ ] Identify documentation that can be merged or retired without losing operational/security knowledge.

---

# Findings triage and implementation gate

**Status:** ⬜ Planned

After Audits A–H, create one findings table in the audit record with these fields:

| Finding | Evidence | Impact | Risk | Decision | Verification |
| --- | --- | --- | --- | --- | --- |
| Example | Reproduced duplication or measurement | Maintainability / correctness / latency / memory | Low / Medium / High | Refactor / Optimize / Defer / Skip | Tests or measurement that prove completion |

Only findings classified **🛠 Refactor justified** or **⚡ Optimization justified** become implementation slices.

### Implementation rules

- [ ] Prefer deletion/simplification over new abstraction when both solve the same demonstrated problem.
- [ ] Do not combine unrelated subsystem findings into one large PR.
- [ ] Add regression coverage before or with each behavior-sensitive change.
- [ ] Preserve public URLs, persistence schemas, security contracts, and release ownership unless the finding specifically proves a migration is necessary.
- [ ] Re-measure optimized paths against the pre-change baseline.
- [ ] Mark findings **⏸ Deferred** when benefit does not justify risk/cost.
- [ ] Mark findings **⏭ Skipped** when audit evidence shows no refactor/optimization is needed.

---

# Audit-cycle completion criteria

The audit/refactor cycle is complete when:

- [ ] All major runtime/ownership surfaces have an evidence-backed audit outcome.
- [ ] Dead/obsolete code and documentation found by the audit are either removed or explicitly retained with a reason.
- [ ] Every proposed refactor has a demonstrated ownership/maintainability/correctness benefit, or is skipped/deferred.
- [ ] Every proposed optimization has a reproducible realistic-scale bottleneck and before/after evidence, or is skipped/deferred.
- [ ] Reader, Keeper, Functions, Library/Series, security, accessibility, build, and test contracts remain green.
- [ ] `npm run check`, `npm test`, production build, and the full five-project real-browser matrix pass on the final exact `main` commit.
- [ ] Architecture and audit documentation are reconciled with the final code state.

## Versioning after the audit

The audit itself does **not** require a new feature release number. If the audit produces only documentation/cleanup with no user-facing or runtime-significant change, v2.10.0 can remain the formal release baseline. If justified refactor/optimization work materially changes the shipped application, choose the next release version only after the implementation scope is known and verified.

## Explicit non-goals

- New feature expansion while the audit is open.
- A full-codebase rewrite for consistency or aesthetics.
- Framework adoption without measured need.
- Server-side Reader accounts/history.
- DRM-like browser restrictions.
- Virtualization or enterprise-scale architecture for hypothetical 1,000+ series libraries.
- Performance work without a reproduced realistic bottleneck.
- Refactoring stable code merely because it is old.
