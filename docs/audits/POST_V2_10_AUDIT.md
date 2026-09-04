# Post-v2.10 Audit — Findings & Decisions

> **Status:** 🟨 Active — Audit A in progress  
> **Baseline release:** v2.10.0  
> **Audit execution baseline:** `1884d713f604e2db3a85f70e68cb4042ba13b6a4`  
> **Roadmap:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)  
> **Started:** 2026-09-04

This is the working evidence record for the post-v2.10 audit. It intentionally contains no predetermined refactor conclusion. Findings are recorded before implementation, and a healthy subsystem is allowed to finish with no change needed.

## Decision vocabulary

- ⏭ **No change needed / skipped**
- 🛠 **Refactor justified**
- ⚡ **Optimization justified**
- ⏸ **Deferred**
- 🔎 **Investigate in later audit section**

## Findings register

| ID | Area | Evidence | Impact | Risk | Decision | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| A-001 | v2 baseline manifest vs current runtime inventory | `docs/architecture/v2-entrypoints.json` is correctly frozen at R10/v2.0.0, while later shipped Reader/Keeper modules are loaded by current composition roots and therefore intentionally absent from the historical manifest. | A frozen baseline can be mistaken for a current exhaustive inventory during maintenance. | Low | ⏭ No refactor. Keep the frozen manifest immutable; maintain current audit inventory separately. | Compare current composition roots/direct HTML entrypoints against the frozen manifest and document intentional additions. |
| A-002 | R6 compatibility facades | `functions/_lib/b2.js` is explicitly a facade over `services/storage.js`, `auth.js`, and `http.js`; `check-r6.mjs` requires it and `garden-maintenance.js` to remain facade-only rather than second implementations. | Removing them without a reference/contract review could break compatibility or historical verification; keeping unused facades also has maintenance cost. | Medium because storage/auth boundaries are sensitive | 🔎 Investigate runtime/test consumers before deciding retain vs retire. No deletion in Audit A. | Audit import/reference graph and service tests; if retired, prove no route/tool/test depends on the facade and preserve service ownership. |
| A-003 | Historical R0–R10 guard ownership | Architecture docs call `check-r0.mjs`…`check-r10.mjs` permanent guardrails, but current `package.json#scripts.check` runs modern repository/dependency/runtime/docs/release/baseline checks and does not invoke R0–R10. `check-r10.mjs` itself still asserts that it must remain in `npm run check`. | Verification documentation, executable policy, and historical guard assumptions have diverged. Blindly re-enabling old regex/source-history checks would also fail against intentionally evolved post-v2 code/docs. | Medium | 🔎 Audit G must classify each historical check as replace, modernize, archive, or intentionally standalone. Do not re-enable wholesale. | Map each historical assertion to current unit/service/browser/E2E/modern check coverage and measure duplicated CI cost before changing the active chain. |
| A-004 | Authored Reader cache-version ownership | `src/assets/js/reader/app.js` currently imports local modules with hard-coded `?v=` values (`toc.js?v=1.2.3`, `page-map.js?v=1.2.0`, `book-search.js?v=2.8.1`). `BUILD_CONTRACT.md` and `check-r10.mjs` state authored local `?v=` cache history should be absent and build-time stamping should be the sole owner. | Two cache-version owners can drift and make source history/versioning harder to reason about. | Low runtime risk; medium contract/maintainability risk | 🛠 Refactor justified, but defer implementation until the authored-source scan establishes the complete scope. | Remove only confirmed local hard-coded cache-history strings, then run build/check and five-browser Reader coverage; verify generated assets still receive deployment-version stamping. |
| A-005 | Retired patch/dead-owner tombstones | `r1-legacy-source-exceptions.json` has no grandfathered patch-style files and records the prior duplicate/repair Reader, Keeper, Library, Series, and CSS paths as removed. Current inspected trees do not show those known retired owners returning. | Confirms the old patch-layer problem has not obviously regressed. | Low | ⏭ No change needed at this stage. | Complete path inventory and retain tombstone comparison as audit evidence. |
| A-006 | Keeper post-v2 ownership growth | Current `admin/app.js` explicitly loads v2.9-era bulk edit, bulk artwork, recovery readiness, similarity warning, and preflight-report modules in named workflow groups. The composition root still initializes one workflow registry and keeps Upload internals isolated from shared API/auth/Library/Maintenance owners. | More modules than the frozen v2 manifest, but current composition still documents ownership instead of creating a parallel admin application. | Low | ⏭ No structural refactor justified by inventory alone. Reassess duplication/cost in Audit D. | Audit workflow dependencies and repeated request/busy/error patterns in Audit D. |
| A-007 | Reader post-v2 ownership growth | Current Reader directory includes intentional post-baseline modules such as `book-search.js`, `error-presentation.js`, `resume-controller.js`, `interaction-controller.js`, `navigation-state.js`, and `image-focus-touch-compat.js`; `reader/app.js` composes search/resume while retaining the established session/application/controller model. | Frozen v2 manifest is incomplete as a current inventory, but module growth alone is not evidence of duplicate ownership. | Medium because Reader is highest-risk | ⏭ No Reader refactor from inventory alone. Continue with dedicated Audit B. | Audit B must check progress/navigation/input/resume/search ownership and long-session behavior before any structural recommendation. |

## Audit A — Repository and ownership inventory

### Current conclusions

- The accepted v2 ownership model is still recognizable in the inspected Library/Reader/Keeper/Functions structure.
- Known R1/R10 patch-style owners have not obviously returned.
- Post-v2.0 feature work added legitimate modules that should be tracked as **current inventory**, not retroactively inserted into the frozen v2.0 manifest.
- Two old Functions facade paths need a consumer/reference audit before they can be declared dead.
- The historical R0–R10 check suite is no longer aligned with the active `npm run check` chain; this is a real tooling-policy audit item, but not evidence that all historical checks should return.
- Hard-coded local Reader `?v=` imports are a confirmed build-contract drift and the first justified cleanup candidate.

### Audit A remaining work

- [ ] Finish authored-source scan for all local hard-coded `?v=` references so A-004 scope is exact.
- [ ] Finish current entrypoint inventory for public pages, Reader, Keeper, Functions routes/services, and operational tools.
- [ ] Trace runtime/test/tool consumers of the R6 compatibility facades.
- [ ] Identify any additional unreachable source or obsolete migration-only paths not already covered by the tombstone manifest.
- [ ] Mark Audit A complete only after each candidate has retain/refactor/defer/skip evidence.

## Measurements

Record reproducible measurements here before proposing optimizations. Include fixture/input, environment, command or scenario, observed result, and enough context to repeat the check.

### Library / Series

Pending Audit C.

### Reader

Pending Audit B. Inventory confirms the Reader remains modular but has grown beyond the frozen v2.0 manifest.

### Garden Keeper

Pending Audit D. Inventory confirms the current composition root explicitly loads v2.9 workflow additions.

### Functions / storage / network

Pending Audit E. Audit A identified R6 facade-retention questions but no second storage/auth implementation.

### Build / tests / tooling

Pending Audit G. Audit A identified active-vs-historical guard drift and authored Reader cache-version drift.

## Ownership and maintainability notes

The frozen `v2-entrypoints.json` should remain a v2.0.0 baseline artifact. It should not be continuously rewritten to match later releases, because doing so would erase the architecture cutover record. Current ownership should instead be demonstrated by current composition roots, architecture contracts, tests, and this audit's inventory evidence.

Keeper currently remains one application composition root (`admin/core.js` + `admin/app.js`) with a named workflow registry. Later modules for bulk edit/artwork and recovery are visible additions, not hidden second owners.

Reader still uses an explicit application orchestrator and controllers, but the dedicated Audit B is required before claiming the expanded search/resume/interaction modules are optimally factored.

## Dead-code / compatibility-path notes

`functions/_lib/b2.js` is only  a re-export facade and does not contain a second B2 implementation. The historical R6 checker deliberately permits/requires that shape. This audit has **not yet proved** whether current runtime/tests/tools still need the path, so it is not safe to delete merely because service ownership moved.

The same rule applies to `functions/_lib/garden-maintenance.js`: facade status is evidence of legacy compatibility, not evidence of current necessity.

Known tombstoned R1/R10 patch paths remain listed in `r1-legacy-source-exceptions.json` and should stay absent.

## Security and recovery notes

No Audit A finding currently justifies changing storage/auth/media/recovery ownership. R6 facade cleanup, if later justified, must be treated as security-sensitive because its exports cross storage/auth/http boundaries.

## Documentation notes

The documentation handoff PR established the audit-first roadmap and archive structure before source inspection. Audit A then found that the phrase “permanent guardrails” for R0–R10 is stronger than the current executable `npm run check` ownership. Audit G must reconcile that wording and tooling based on overlap evidence rather than historical intent.

## Implementation candidates

### Candidate I-001 — Restore single cache-version owner in authored Reader imports

**Source finding:** A-004  
**Status:** Accepted as a cleanup candidate; implementation held until the complete authored-source scan is recorded.  
**Goal:** remove hard-coded local Reader `?v=` import history and leave deployment-version stamping as the sole local asset cache owner.

This should be a minimal source-contract cleanup, not a Reader architecture rewrite.

## Deferred / skipped recommendations

- Do **not** rewrite `v2-entrypoints.json` into a moving current manifest; keep it frozen and create separate current inventory evidence.
- Do **not** collapse Keeper modules simply because the v2.9 workflow additions increased file count.
- Do **not** restructure Reader modules from file-count/age alone; Audit B must produce ownership or runtime evidence first.
- Do **not** delete R6 facades until the consumer/reference audit proves they no longer earn compatibility value.
- Do **not** re-enable all R0–R10 source-regex checks wholesale; Audit G must determine which assertions remain valuable versus obsolete/duplicated.

## Audit closeout

The audit closes only after every major surface in the current roadmap has an explicit evidence-backed outcome and all accepted implementation slices are either complete or deliberately deferred.
