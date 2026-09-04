# Shadow Garden Current Roadmap — v2.11 Engineering Audit, Refactor & Optimization

> **Status:** ✅ **v2.11A–E COMPLETE · v2.11F NEXT**  
> **Active release:** v2.11.0 — Engineering Audit, Refactor & Optimization  
> **Latest formal release:** v2.10.0 — Maintenance & Supply Chain  
> **Baseline commit:** `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`  
> **First landed v2.11 slice:** `8c5145b490bda77b5db5527f957ad4bcfea0b113`  
> **Reader Audit-B measured code head:** `4c9e41fda640926c393dd72397058447d0af92bf`  
> **Library/Series Audit-C measured code head:** `f64fa1ea4e74287146800687ca9d2e27efa6e9c3`  
> **Keeper Audit-D measured code head:** `78ceaff278cfbb56a808ab91030eda182cc917b4`  
> **Functions Audit-E measured code head:** `e9f9001ff50aa4f915ee397927fde0698309b805`  
> **Updated:** 2026-09-05

Shadow Garden has enough product features for the current operating horizon. v2.11 is therefore an **audit-first engineering-health cycle**, not a feature expansion roadmap.

The audit asks whether the mature v2 codebase has demonstrated structural, reliability, maintainability, verification, or realistic-scale performance problems. Refactor and optimization work are conditional. If evidence shows an area is already healthy, its implementation step is **skipped / no change needed**.

Completed v2.6–v2.10 product planning is archived under [`../archive/V2_6_TO_V2_10_ROADMAP.md`](../archive/V2_6_TO_V2_10_ROADMAP.md). Current findings and measurements live in [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md), with Audit-C measurements in [`../audits/V2_11_LIBRARY_SERIES_AUDIT.md`](../audits/V2_11_LIBRARY_SERIES_AUDIT.md), Audit-D measurements in [`../audits/V2_11_KEEPER_AUDIT.md`](../audits/V2_11_KEEPER_AUDIT.md), Audit-E measurements in [`../audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md`](../audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md), and current ownership inventory in [`../audits/POST_V2_10_ENTRYPOINT_INVENTORY.md`](../audits/POST_V2_10_ENTRYPOINT_INVENTORY.md).

## Governing rule

**Audit before architecture change.** A refactor or optimization must have concrete evidence: duplicated ownership, dead/compatibility code, fragile coupling, repeated defects, measurable runtime/build/test cost, excessive resource use, maintainability risk, or a real verification gap.

A clean audit is a successful result.

## Status legend

- ⬜ Planned
- 🟨 In progress
- ✅ Complete
- 🛠 Refactor/cleanup justified
- ⚡ Optimization justified
- ⏸ Deferred
- ⏭ Skipped / no change needed

## Non-negotiable constraints

1. No feature expansion during v2.11 unless required to correct a demonstrated defect.
2. Preserve one owner per responsibility across domain state, rendering, persistence, Reader, Keeper, Functions, storage, auth, catalog, build, and tests.
3. Preserve private B2, signed media tickets, opaque identities, Turnstile/Garden Pass, signed Keeper sessions, abuse controls, protected Range delivery, and recovery invariants.
4. Reader progress, bookmarks, Finished state, preferences, and history remain browser-local.
5. Reader stability is the highest-risk product contract.
6. Measure realistic personal-library usage before optimizing; roughly 250–300 series and representative large EPUBs are the normal upper-bound audit fixtures.
7. No framework/bundler rewrite, speculative virtualization, server-side Reader history, or 1,000+ series engineering without evidence.
8. Prefer deletion and simplification over new abstraction when both solve the same demonstrated problem.
9. Keep implementation slices small, reversible, deployable, and independently verifiable.
10. `npm run check`, deterministic tests, production build, complete five-project real-browser E2E, deployment metadata, and production smoke remain authoritative gates.

---

# v2.10.0 — Formal release baseline

**Status:** ✅ Released  
**Release record:** [`../releases/v2.10.0.md`](../releases/v2.10.0.md)

v2.10.0 remains the latest formal release and fixed comparison baseline. Post-release hotfix/maintenance commits are part of the execution baseline for v2.11 but do not rewrite the v2.10 release tag.

The v2.11 audit begins after:

- the B2 integrity regression hotfix;
- catalog-history retention reduction from 30 to 15;
- complete retirement of Batch Edit and Batch Artwork;
- preservation of normal single-series editing, banner selection, cover maintenance, upload handling, and the multi-EPUB upload queue.

---

# v2.11.0 — Engineering Audit, Refactor & Optimization

**Status:** 🟨 Active development line  
**Formal release:** not cut; `package.json#version` remains 2.10.0 until release convergence

## v2.11A — Repository & ownership inventory

**Status:** ✅ Complete

### Audit goals

- [x] Establish the post-maintenance execution baseline at `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`.
- [x] Confirm retired Batch Edit/Artwork owners remain removed and tombstoned.
- [x] Confirm the frozen v2.0 entrypoint manifest remains historical evidence rather than a moving inventory.
- [x] Identify authored Reader local `?v=` cache-history imports as build-contract drift.
- [x] Start the v2.11 deployment line at 2.11.0 while keeping formal release ownership at 2.10.0.
- [x] Remove the three confirmed Reader cache-history imports and add a permanent authored-source cache-version guard.
- [x] Verify the cache-version guard on exact PR head and exact main with Verify plus the complete five-project real-browser matrix; confirm exact-main Cloudflare deployment succeeds.
- [x] Reconcile R0–R10 executable milestone checker ownership: classify the self-invalid historical snapshots for retirement and add an active absence guard while preserving modern verification owners.
- [x] Finish current consumer tracing of the R6 compatibility facades (`functions/_lib/b2.js`, `functions/_lib/garden-maintenance.js`): both were forwarding-only aliases with no current repository consumer after R6 checker retirement; retire them behind an active absence/import guard and reverify exact main.
- [x] Finish current public/Reader/Keeper/Functions production entrypoint and composition tracing. Browser reachability follows HTML roots, ESM/dynamic imports, and Keeper absolute script-loader edges; Functions reachability follows Pages Function routes through service/helper imports.
- [x] Identify and dispose of whole-file unreachable source at the inventory level. The first browser graph found one dead R2 `reading-status.js` compatibility facade plus its stale `_headers` rule; both are retired while canonical `domain/reading-state.js` and the live stylesheet remain.
- [x] Classify remaining Audit-A candidates. Current deterministic tests are retained because the active runner discovers them; release-era standalone tooling is deferred to G; CSS/docs and deeper surface-specific export/behavior questions are assigned to B–H.

### Audit A closeout evidence

- Browser graph: **25 production HTML script roots → all 85 remaining authored browser scripts**.
- Functions graph: **15 Pages Function route roots → all 38 Functions source files**.
- Current deterministic test files remain live inputs to `npm test`; filename age alone is not stale-fixture evidence.
- No inventory-level evidence justifies broader Reader, Library, Keeper, Functions, CSS, or tooling restructuring.

### Decision gate

Audit A closes with evidence and explicit dispositions, not with speculative module cleanup. The permanent reachability checks become part of normal `npm run check`; deeper behavior/performance/export questions remain with Audits B–H.

## v2.11B — Reader architecture & long-session reliability

**Status:** ✅ Complete on measured Reader code head `4c9e41fda640926c393dd72397058447d0af92bf`

### Audit goals and outcomes

- [x] Revalidate Reader app/session, Pages, Continuous, Page Map/progress, Contents/search, bookmarks, image focus, input, resume, and ticket-renewal ownership. **Outcome:** current modular ownership is retained; no broad Reader restructuring is justified.
- [x] Measure time-to-first-readable-page with a representative large EPUB. **Outcome:** deterministic 6,315,313-byte / 18-chapter fixture reaches first readable in ~1.09–1.13 s on final Chromium audit runs.
- [x] Exercise long Continuous sessions for listener accumulation, layout churn, memory growth, request churn, and long-task regressions. **Outcome:** nine chapter jumps finish at 5 live views/iframes after a transient peak of 18, with ~+0.68 MiB heap, +44 Nodes, 0 Documents, 0 listeners, one access request, and zero long tasks.
- [x] Exercise repeated Pages ↔ Continuous switching, search/TOC navigation, image focus, orientation/viewport changes, background/resume, and ticket renewal. **Outcome:** full Reader/browser coverage remains green and the dedicated ownership workload ends at ~+2.31 MiB heap, +702 Nodes, +4 Documents, +14 listeners after lifecycle work drains.
- [x] Isolate canonical Page Map generation and supersession. **Outcome:** fix protected-source ownership by using `session.sourcePath`; add cancellation/teardown for superseded hidden mapping work; final isolated Page Map reaches 360 pages in ~2.49 s and returns the sandbox count to zero.
- [x] Trace the dominant flow-switch retention rather than refactoring speculatively. **Outcome:** carry targeted EPUB.js 0.3.93 lifecycle cleanup for Default/Continuous unload listeners, stage orientation cleanup, and rendition-owned Book hooks; guard the dependency revision and unit-test the inheritance/lifecycle contract.
- [x] Trace remaining Continuous DOM retention after live-buffer trim. **Outcome:** release cached `Section.document/contents/output` after the final live view disappears; retained Documents improve from +13 to 0 and retained Nodes from +3,047 to +44 in the same traversal.
- [x] Verify the final measured code head with `npm run check`, production build, and all five real-browser projects. **Outcome:** Chromium desktop/mobile, Firefox desktop, WebKit desktop/mobile all pass.

### Audit B decision gate

Audit B found **targeted lifecycle/source defects**, not evidence for architectural consolidation or a performance rewrite. Keep the existing Reader module ownership. Do not defer Page Map generation, add virtualization, replace Continuous buffering, or impose a runner-sensitive heap ceiling: final startup, Page Map, long-session, request, and long-task measurements do not justify those changes.

## v2.11C — Library, Series & browser-local domain

**Status:** ✅ Complete on measured code head `f64fa1ea4e74287146800687ca9d2e27efa6e9c3`  
**Evidence:** [`../audits/V2_11_LIBRARY_SERIES_AUDIT.md`](../audits/V2_11_LIBRARY_SERIES_AUDIT.md)

### Audit goals and outcomes

- [x] Revalidate catalog normalization, filters/sort, reading state, progress, bookmarks, pinned state, preferences, URL state, and volume-action ownership. **Outcome:** canonical domain/controller boundaries remain valid; no Library/Series consolidation is justified.
- [x] Measure hydration/search/filter/sort/view/series-navigation behavior with the deterministic 300-series / 1,950-volume fixture. **Outcome:** final measured hydration is ~441 ms; a 12-volume Series page is ~358 ms with zero long tasks; the Library uses one catalog request and Series uses one.
- [x] Trace excessive browser-local state work. **Outcome:** remove unconditional Finished-state evaluation from blank reading-status filtering and reuse materialized volume state across cards/banner decisions; hydration localStorage reads fall from 121,905 to 14,211 (−88.3%) and the interaction workload from 314,387 to 11,645 (−96.3%).
- [x] Trace duplicate render/request ownership. **Outcome:** active-filter and Recent “View all” actions now perform one canonical catalog render; pinned navigation and the page controller share one bounded startup catalog result while ordinary later loads remain fresh.
- [x] Inspect DOM/listener growth at realistic scale. **Outcome:** Library stays at 2 Documents / 61 listeners from hydration through the measured interaction sequence while rendered cards intentionally grow from 36 to 120; no leak shape was demonstrated.
- [x] Decide virtualization from evidence. **Outcome:** no virtualization, framework rewrite, or new persistence/cache architecture is justified for the intended ~300-series scale.

### Audit C decision gate

Audit C found **repeated state reads and duplicate action/network ownership**, not a structural Library/Series problem. Keep the current catalog/domain/controller split. The accepted changes are lazy reading-state evaluation, reuse of already-materialized volume state, one-shot public startup catalog sharing, and one canonical render per Library action. Do not add virtualization or a broad localStorage cache without new measurements.

## v2.11D — Garden Keeper & operational workflows

**Status:** ✅ Complete on measured Keeper code head `78ceaff278cfbb56a808ab91030eda182cc917b4`  
**Evidence:** [`../audits/V2_11_KEEPER_AUDIT.md`](../audits/V2_11_KEEPER_AUDIT.md)

### Audit goals and outcomes

- [x] Revalidate only retained workflows: auth/session, Library/Series, translations, Upload, Maintenance, History, Trash, Abuse Watch, Recovery Readiness, and multi-EPUB upload. **Outcome:** current decomposition and the single `AdminClient` boundary remain valid; no Keeper rewrite is justified.
- [x] Confirm retired Batch Edit/Artwork owners have not returned. **Outcome:** no retired catalog-wide owner is composed; the surviving `admin-batch*` files belong only to the live New Books multi-EPUB queue.
- [x] Measure duplicate Maintenance snapshot ownership. **Outcome:** Maintenance, History, and Trash previously issued 3 identical `GET /admin-api/maintenance` requests per dialog open; Maintenance now owns one canonical GET and publishes `maintenance:data` for History/Trash presentation.
- [x] Preserve invalidation correctness around Trash. **Outcome:** Trash restore/purge reuses its returned maintenance snapshot with 0 follow-up GETs, while an external `trash:changed` invalidation still causes exactly 1 fresh load.
- [x] Measure first-preflight Upload catalog ownership. **Outcome:** unlock already materializes `/admin-api/library`; first preflight previously added +1 GET. Upload now mirrors canonical `library:changed` data into its batch-local duplicate-detection snapshot, so the normal preflight delta is 0 while the deliberately missing-snapshot fallback remains exactly +1 GET.
- [x] Inspect auth/session, translation, Abuse Watch, Recovery Readiness, sequential B2 checks, cover optimization, multi-EPUB queue ordering, busy/error behavior, and retry/recovery paths. **Outcome:** no second catalog/session/security owner or measured sequential-work bottleneck justified additional change.
- [x] Preserve deterministic and recovery-sensitive ordering. **Outcome:** 25-object deep B2 batches, one-at-a-time cover optimization, and ordered multi-EPUB upload remain unchanged because Audit D found duplicate snapshot reads—not evidence for speculative parallelization.

### Audit D decision gate

Audit D found **two bounded request-ownership defects**, not a structural Keeper problem. Keep the existing workflow split, single `AdminClient`, auth/session security boundary, explicit invalidation events, and recovery-sensitive ordering. The accepted implementation is limited to one canonical Maintenance snapshot GET owner plus reuse of already-materialized Library state by Upload duplicate detection with a safe one-GET fallback.

## v2.11E — Pages Functions, security & storage

**Status:** ✅ Complete on measured code head `e9f9001ff50aa4f915ee397927fde0698309b805`  
**Evidence:** [`../audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md`](../audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md)

### Audit goals and outcomes

- [x] Revalidate thin routes independently from Audit-A whole-file reachability. **Outcome:** the live guard proves **15 thin route roots → all 38 Functions sources** and rejects route-owned logic/imports outside the service layer; no routing rewrite is justified.
- [x] Measure read/write storage credential ownership. **Outcome:** Library, Series Banner, Maintenance, and Recovery read-only GETs previously failed without write credentials even though they only issued GET/HEAD. Storage transport now routes GET/HEAD through read credentials and mutation methods through write credentials lazily, preserving the existing service call graph and least privilege.
- [x] Audit service export ownership. **Outcome:** nine implementation-only catalog/media/storage exports with no repository consumer are now private. Three validation-policy exports are retained deliberately and directly regression-tested. Final ownership guard: **91 retained service exports have consumers**.
- [x] Re-run signed media, Keeper auth/session, opaque-ID/catalog redaction, Range/abuse, B2 integrity, recovery, translation, and upload-validation contracts. **Outcome:** normal Verify is green with **43/43 service tests**, the core security checker, targeted Reader/Library regressions, and production build.
- [x] Close the verification gap. **Outcome:** `npm run check:security` and the complete service-test layer now run in normal pull-request Verify rather than only in periodic Baseline Health.
- [x] Reconcile current Functions architecture ownership. **Outcome:** auth, media, catalog, recovery/readiness, storage, validation, abuse, HTTP, admin, and translations retain explicit owners; retired R6 facades remain absent.

### Audit E decision gate

Audit E found **one bounded least-privilege defect, stale export surface, and a normal-CI coverage gap**, not an architectural backend problem. Keep the current route/service/helper decomposition. The accepted changes are method-routed B2 credentials, a permanent thin-route/export-consumer guard, nine private implementation symbols, explicit tests for retained upload-policy seams, and full security/service regression coverage in Verify. Do not add a router framework, collapse auth/media/recovery ownership, or expose direct B2 access without new evidence.

## v2.11F — CSS, motion & accessibility

**Status:** ⬜ Planned

- Identify genuinely unused selectors/tokens, conflicting component ownership, specificity escalation, and obsolete compatibility classes.
- Revalidate public/Keeper versus Reader-scoped ownership.
- Re-run keyboard/focus, reduced motion, forced colors, increased contrast, zoom/reflow, and mobile target checks.
- Avoid broad CSS rewrites without demonstrated ownership or maintenance problems.

## v2.11G — Build, dependencies, tests & tooling

**Status:** ⬜ Planned — R-series executable subset already reconciled during v2.11A; EPUB.js lifecycle revision guard added during v2.11B

- Revalidate Node/npm/lockfile, build context, deployment stamping, no-bundler decision, preview, and publisher ownership.
- Treat R0–R10 executable milestone checkers as retired historical policy snapshots; current verification remains owned by modern checks/tests/Baseline Health/E2E.
- Audit remaining M-series, `check-v2-6.mjs`, and other release-era standalone tools independently; do not infer redundancy from the R-series decision.
- Retain current deterministic `*.test.mjs` files unless Audit G produces evidence beyond historical naming; the active test runner and Baseline Health currently own them.
- Treat `tools/check-epub-lifecycle-vendor.mjs` as an accepted Reader safety guard unless dependency review proves the compatibility patch obsolete.
- Measure check/test/build duration and remove duplicate cost only when confidence is preserved.
- Keep dependency maintenance review-driven and non-destructive.

## v2.11H — Documentation & repository hygiene

**Status:** ⬜ Planned

- Keep one current roadmap and canonical archive ownership.
- Remove stale statements about retired features or completed releases being active work.
- Preserve formal release records except factual corrections.
- Reconcile architecture contracts with final accepted ownership after implementation slices.

---

# Findings → implementation gate

Every material finding must record:

| Finding | Evidence | Impact | Risk | Decision | Verification |
| --- | --- | --- | --- | --- | --- |
| ID/area | reproducible evidence | correctness / maintainability / latency / memory / build/test cost | Low / Medium / High | Skip / Cleanup / Refactor / Optimize / Defer | test or measurement proving completion |

Only **Cleanup/Refactor justified** or **Optimization justified** findings become implementation slices.

## Completion criteria

v2.11 is complete when:

- [ ] Audits A–H have explicit evidence-backed outcomes.
- [ ] Dead/obsolete material is removed or explicitly retained with a reason.
- [ ] Every structural recommendation is implemented, skipped, or deferred based on evidence.
- [ ] Every optimization has a reproducible before/after measurement or is skipped/deferred.
- [ ] Reader, Keeper, Functions, Library/Series, security, recovery, accessibility, build, and test contracts remain green.
- [ ] Final exact-main Verify and complete five-browser E2E pass.
- [ ] Cloudflare production reports the final deployment version/commit and production smoke succeeds for a formal release cut.
- [ ] Documentation and audit records match the final code state.

A v2.11 formal release is cut only after accepted implementation scope is complete and release-owned metadata deliberately converges from 2.10.0 to 2.11.0.
