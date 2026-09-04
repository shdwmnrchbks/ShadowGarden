# v2.11 Engineering Audit — Findings & Decisions

> **Status:** ✅ v2.11A–B complete · v2.11C next  
> **Formal baseline release:** v2.10.0  
> **v2.11 execution baseline:** `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`  
> **First landed v2.11 slice:** `8c5145b490bda77b5db5527f957ad4bcfea0b113`  
> **Reader Audit-B measured code head:** `4c9e41fda640926c393dd72397058447d0af92bf`  
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
| A-002 | R6 compatibility facades | `functions/_lib/b2.js` and `functions/_lib/garden-maintenance.js` contain only re-exports from current service owners. The known historical executable consumer, `check-r6.mjs`, was retired with the R-series milestone checkers. Current routes, services, security checks, tests, and operational tooling use the service owners and retained real `_lib` primitives directly; current repository review found no remaining import of either facade. | Keeping unused compatibility files preserves obsolete ownership surface and invites new code to depend on historical aliases. | Low runtime risk; medium ownership-drift risk | 🧹 Retire both compatibility facades and guard their absence/import paths. | Active `npm run check` includes `check-retired-r6-facades.mjs`; exact PR head and exact main passed Verify/build and all five real-browser projects. |
| A-003 | Historical R0–R10 checker ownership | Every reviewed R-series milestone checker (`check-r0.mjs` through `check-r10.mjs`, including R4.1) asserted that itself and/or earlier milestone scripts must still be chained through `npm run check`. That is intentionally false in the current architecture: fast Verify owns current repository contracts/build, Baseline Health owns modern security/full deterministic tests/performance, and real-browser E2E owns the five-project browser matrix. Several R checks also encode frozen release-era file lists and exact historical test-chain assumptions. | Keeping self-invalid executables beside current checks makes obsolete policy look runnable and increases drift/maintenance risk. Re-enabling them would contradict the evolved verification split. | Low runtime risk; medium tooling-policy risk | 🧹 Retire the obsolete R-series executables and guard their absence. Preserve historical architecture/release records and current modern checks/tests. | Active `npm run check` includes `check-retired-milestone-checkers.mjs`; Verify/build and five-project E2E remain green. Broader M-series and post-R historical tooling remain Audit G scope. |
| A-004 | Authored Reader cache-version ownership | `src/assets/js/reader/app.js` carried `./toc.js?v=1.2.3`, `./page-map.js?v=1.2.0`, and `./book-search.js?v=2.8.1`, despite the R10/build contract assigning local cache versions to build-time deployment stamping. | Two cache-version owners can drift and preserve stale release-history strings in authored source. | Low runtime risk; medium maintainability/contract risk | 🧹 Implemented: remove the three authored query versions and add `tools/check-authored-cache-versions.mjs` to active `npm run check`. | Exact-head Verify and all five real-browser projects passed; exact-main Verify/E2E passed on `8c5145b...`; Cloudflare deployed that exact commit successfully. |
| A-005 | Retired patch/dead-owner tombstones | Existing tombstones plus pre-v2.11 maintenance keep known patch-style owners and retired Batch Edit/Artwork source/backend paths absent. | Confirms prior duplicate/repair owners have not obviously returned. | Low | ⏭ No refactor from this evidence. | Active repository checks and current inventory. |
| A-006 | Keeper post-v2 ownership growth | Batch Edit and Batch Artwork were deliberately removed before v2.11. Normal Library editing, series-banner selection, cover maintenance, upload cover handling, and multi-EPUB upload remain separate canonical owners. | Smaller Keeper/API surface; avoids auditing removed product behavior as if it were still required. | Low | ⏭ Removal is the product decision; no replacement. | Exact-main Keeper/browser coverage and retired-path tombstones. |
| A-007 | Reader post-v2 module growth | Search, resume, error presentation, interaction/navigation helpers, and touch compatibility are post-v2 additions composed by the Reader app. File growth alone is not duplicate ownership. Audit B found targeted Page Map/EPUB lifecycle defects but no duplicate Reader responsibility requiring structural consolidation. | Reader remains highest-risk, but the existing module split is not itself a demonstrated problem. | Medium | ⏭ Keep current Reader ownership boundaries; apply only the measured lifecycle/source fixes below. | Audit B large-EPUB, flow-churn, Continuous-soak, resume/navigation, and five-project browser evidence on `4c9e41f...`. |
| A-008 | Current browser / Functions whole-file reachability | A production-root graph over HTML scripts, ESM imports/dynamic imports, Keeper absolute `loadScript()` edges, and Pages Function route imports found exactly one disconnected browser file: `src/assets/js/reading-status.js`. It was an R2 compatibility facade over canonical `domain/reading-state.js`, its stylesheet was already linked directly by production HTML, and no current consumer used its global/path. Removing it exposed one stale `/assets/js/reading-status.js` `_headers` rule. After cleanup, 25 HTML script roots reach all 85 authored browser scripts and 15 Pages Function route roots reach all 38 Functions sources. | Dead compatibility source and stale deployment metadata can persist even when referenced-path and syntax checks are green. A permanent reachability invariant reduces future ownership drift. | Low | 🧹 Remove the disconnected facade and stale header rule; add browser and Functions reachability guards to normal `npm run check`. | Final candidate must pass repository checks, targeted regressions, production build, and all five real-browser projects; first clean Verify run proved the 25/85 and 15/38 graphs. |
| A-009 | Historical-looking deterministic tests | `tools/run-tests.mjs` discovers every `*.test.mjs` under unit/service/dom/browser layers, and Baseline Health runs `npm test` as part of the full deterministic baseline. | Deleting tests based on release-era names would reduce active regression coverage. | Medium verification risk | ⏭ Retain current deterministic test files; filename age is not staleness evidence. | Test-runner discovery plus Baseline Health ownership. |
| B-001 | Canonical Page Map protected source ownership | Reader created the Page Map with `session.publicBookId || session.storageIdentity`, but the sandbox treats `bookUrl` as a fetchable EPUB URL. The authorized Reader session already separates logical identity from the protected media path in `session.sourcePath`. | Large protected EPUB Page Map generation could stall because a logical identity was resolved as a URL instead of the authorized media source. | High Reader reliability | 🛠 Pass the protected `session.sourcePath` to Page Map generation; keep logical Reader identity ownership elsewhere unchanged. | Isolated 6.3 MiB fixture Page Map completes at 360 device pages in ~2.49 s on the final Chromium audit; all five browser projects pass. |
| B-002 | Superseded Page Map sandbox lifecycle | Viewport/layout changes can supersede an in-progress mapping pass. The original generator had no cancellation owner and could leave external EPUB work racing after a newer generation became canonical. | Overlapping hidden rendition work can create unnecessary resource/request pressure and make lifecycle behavior nondeterministic. | Medium | 🧹 Add generation abort ownership and deterministic sandbox teardown; do not otherwise redesign Page Map. | Page Map sandbox returns to zero after generation; viewport churn ends at only +4 Documents / +14 listeners total after the full audit sequence, with no lingering Page Map sandbox. |
| B-003 | EPUB.js rendition/manager lifecycle retention | Six Pages ↔ Continuous cycles initially retained about +18.95 MiB heap, +13,752 Nodes, +76 Documents, and +288 listeners. Upstream EPUB.js 0.3.93 manager code used anonymous bound unload listeners, a mismatched `orientationChange` removal, and a long-lived Book content hook that could keep destroyed Renditions reachable. | Repeated flow switching produced linear retained Reader resources. | High long-session reliability | 🛠 Carry the narrowly scoped lifecycle compatibility patch, pin/guard the expected EPUB.js package revision, preserve Continuous native scroll/debounce setup, and deregister rendition-owned Book hooks on destroy. | After the corrected Default/Continuous patch and full drain, the same ownership workload ends at +2.31 MiB, +702 Nodes, +4 Documents, and +14 listeners total; unit tests cover Default-first/Continuous-second inheritance and hook/listener release. |
| B-004 | Continuous trimmed-section DOM cache | EPUB.js removes trimmed iframe views, but `Section.load()` caches `document`, `contents`, and serialized `output` on the long-lived `Book.spine`; `IframeView.destroy()` does not call `section.unload()`. Before cleanup, a nine-chapter Continuous traversal returned to five live views yet retained +13 Documents and +3,047 Nodes. | Long Continuous sessions retained parsed chapter DOM after the live view buffer had already discarded those chapters. | Medium-high | 🧹 Release a section cache when its final live view is removed and release remaining view sections on rendition teardown; never unload while another live view still owns the same section. | Same nine-chapter soak now retains 0 Documents, +44 Nodes, 0 listeners, and ~+0.68 MiB heap; peak 18 views trims back to 5; deterministic tests cover duplicate-view safety and teardown. |
| B-005 | Large-EPUB startup / Page Map cost | Final Chromium measurements on the deterministic 6,315,313-byte / 18-chapter fixture show first readable at ~1.09–1.13 s, isolated 360-page mapping at ~2.49 s, and zero long tasks. | No measured startup bottleneck remains that justifies deferring or rearchitecting Page Map generation. | Low | ⏭ No optimization. Retain current startup architecture. | Isolated Page Map audit and combined runtime audit on `4c9e41f...`; complete five-project E2E green. |
| B-006 | Sustained Continuous request/buffer behavior | Nine chapter jumps across the large EPUB use one signed-access request in the isolated soak, finish with 5 live views/iframes after a transient peak of 18, and record zero long tasks. | Continuous buffering and protected-media request behavior are bounded after lifecycle cleanup. | Low | ⏭ No additional buffering, virtualization, or request optimization. | `READER_V2_11B_CONTINUOUS_AUDIT` on `4c9e41f...` plus five-project browser matrix. |

## v2.11A — Repository & ownership inventory

### Completed evidence

- [x] Fixed execution baseline at `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`.
- [x] Preserved frozen v2.0 manifest as historical evidence rather than rewriting it into a moving manifest.
- [x] Confirmed retired Batch Edit/Artwork owners are absent from current composition and protected by tombstones.
- [x] Identified, traced, retired, and guarded the forwarding-only R6 compatibility facades; PR #222 was reverified on exact main `3da056a70a483836391a8d9761c8307eb754144d` with Verify/build plus all five real-browser projects.
- [x] Identified active-vs-historical checker drift for Audit G.
- [x] Identified authored Reader `?v=` imports as a concrete build-contract drift.
- [x] Removed the three confirmed authored query versions and added a permanent authored-source cache-version scan.
- [x] Verified the cache-version cleanup on exact PR head and exact main with Verify plus the complete five-project real-browser matrix; exact-main Cloudflare deployment also succeeded.
- [x] Classified the R0–R10 executable milestone checkers as obsolete/self-invalid policy snapshots and implemented their retirement with a permanent absence guard.
- [x] Completed current production browser composition tracing, including Garden Keeper dynamic script loading; mechanically guard whole-file reachability.
- [x] Completed Pages Functions route-to-service/helper tracing; mechanically guard whole-file reachability.
- [x] Removed the one disconnected browser compatibility facade (`reading-status.js`) and its stale deployment-header rule while preserving canonical reading-state and stylesheet owners.
- [x] Confirmed current deterministic test files are active test-runner inputs rather than stale fixtures by filename.
- [x] Assigned specialized remaining questions to their evidence-owning audits: Reader B, Library/Series C, Keeper D, Functions/security E, CSS/accessibility F, tooling G, and docs hygiene H.

### Audit A disposition

No unresolved **inventory-level** candidate remains. Audit A deliberately does not pre-answer deeper unused-export, reliability, performance, CSS-selector, release-tooling, or documentation questions owned by Audits B–H.

## v2.11B — Reader architecture & long-session reliability

### Completed evidence

- [x] Revalidated Reader orchestration boundaries across session/app, Pages, Continuous, Page Map/progress, Contents/search, bookmarks, image focus, input, resume, and ticket renewal. No duplicate responsibility justified a broad structural refactor.
- [x] Added a deterministic large audit EPUB: 6,315,313 bytes, 18 chapters, 72 passages per chapter.
- [x] Isolated Page Map generation from live-rendition churn and identified the protected-source path bug.
- [x] Added cancellation/teardown ownership for superseded hidden Page Map generations.
- [x] Isolated flow-switch retention from viewport/Page Map churn and traced the dominant retention to EPUB.js rendition/manager lifecycle ownership.
- [x] Added an EPUB.js 0.3.93 compatibility guard and deterministic lifecycle tests while preserving Continuous's native scroll/debounce setup.
- [x] Traced the remaining long-Continuous DOM slope to cached `Section.document/contents/output` retained after view trimming and released those caches only after the final live view is gone.
- [x] Exercised repeated Pages ↔ Continuous switching, viewport changes, TOC/search/navigation, resume/ticket behavior, and sustained Continuous traversal under the existing full browser suite plus dedicated Chromium CDP audits.
- [x] Verified the measured code head `4c9e41fda640926c393dd72397058447d0af92bf` with Verify and the complete Chromium desktop/mobile, Firefox desktop, and WebKit desktop/mobile matrix.

### Audit B disposition

The Reader audit found **targeted lifecycle defects**, not a justification for architectural consolidation. Page Map, progress, Continuous, Pages, search, resume, input, and other Reader modules keep their current ownership. The accepted implementation is limited to protected Page Map source/cancellation and EPUB.js lifecycle/cache cleanup. No startup deferral, broad Reader rewrite, virtualization, or new memory-management abstraction is justified by the final measurements.

## Measurements

### Library / Series

Pending v2.11C. Use the deterministic ~300-series fixture for realistic upper-bound measurements.

### Reader

Final v2.11B measurements use the deterministic 6,315,313-byte EPUB with 18 chapters × 72 semantic passages.

- **First readable:** ~1.09–1.13 s in the final Chromium audit runs.
- **Isolated Page Map:** 360 device pages ready in ~2.49 s; sandbox drops from 1 to 0; Documents 15 → 4; listeners 282 → 178; heap falls by ~4.24 MiB after mapping cleanup.
- **Repeated flow + viewport ownership audit:** after six Pages ↔ Continuous cycles, drain, and six viewport changes, final retained delta is ~+2.31 MiB heap, +702 Nodes, +4 Documents, +14 listeners; no Page Map sandbox remains.
- **Sustained Continuous traversal:** chapter jumps 2, 4, 6, 8, 10, 12, 14, 16, 18; live buffer peaks at 18 views/iframes and trims back to 5; final retained delta is ~+0.68 MiB heap, +44 Nodes, 0 Documents, 0 listeners.
- **Request behavior in isolated Continuous soak:** one access request, three protected media requests, no renewal churn.
- **Long tasks:** zero in the final combined/Continuous audit workloads.

These measurements close the previously demonstrated linear Reader retention problem. They do not establish a need for Page Map startup deferral or a brittle runner-specific heap ceiling; structural lifecycle invariants, deterministic cleanup tests, request assertions, and the existing live-view bound are the stronger regression contracts.

### Garden Keeper

Pending v2.11D. Audit only retained workflows; Batch Edit and Batch Artwork are retired product surface.

### Functions / storage / network

The R6 forwarding-facade question is resolved at inventory level. Current route reachability proves all 38 Functions source files participate in a route-owned production graph, but v2.11E still owns security-sensitive export/route/service behavior review. No current v2.11A evidence justifies changing B2/auth/media/catalog implementation.

### Build / tests / tooling

R0–R10 executable milestone-checker ownership has been reconciled: they are historical policy snapshots, not current verification owners. Current deterministic test files remain active because the test runner discovers them and Baseline Health runs the full suite. Audit G still owns M-series, `check-v2-6.mjs`, dependency/build context, duration, and remaining standalone tooling review.

## Security and recovery notes

Audit B does not weaken protected Reader media ownership. The Page Map fix uses the already-authorized `session.sourcePath` rather than treating a logical public/storage identity as a fetchable URL. Signed access, protected media delivery, ticket renewal, browser-local Reader persistence, and recovery semantics remain owned by their existing layers.

The Continuous soak required one access request and showed no renewal churn across the sustained traversal. Existing resume/ticket and public-reading lifecycle browser tests remain green on the exact measured code head.

No v2.11A cleanup changes storage/auth/media/recovery implementation ownership. The R6 facade cleanup removes forwarding aliases only; the browser cleanup removes an unused reading-state compatibility facade only; current service/domain owners and security primitives remain unchanged.

Retiring the R-series milestone executables does not remove current security coverage: `tools/check.mjs` retains the per-change security baseline; `tools/check-security.mjs` remains the dedicated security contract and is exercised by Baseline Health; service tests and real-browser coverage remain unchanged.

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
**Status:** ✅ Landed and reverified on exact main `3da056a70a483836391a8d9761c8307eb754144d`  
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
- complete five-project real-browser E2E passes on PR head and exact main;
- no route, dependency, lockfile, or formal release-version change is introduced.

### I-004 — Guard current runtime reachability and retire dead reading-state facade

**Source finding:** A-008  
**Status:** ✅ Audit-A implementation complete  
**Scope:**

- add `tools/check-browser-entrypoint-reachability.mjs` to require every authored browser JS file to be reachable from production HTML composition through static/dynamic ESM or absolute script edges;
- add `tools/check-functions-entrypoint-reachability.mjs` to require every Functions source file to be reachable from a Pages Function route;
- retire unreachable `src/assets/js/reading-status.js`, preserving canonical `domain/reading-state.js` ownership;
- remove the stale `_headers` rule for the retired JS facade while retaining the live `reading-status.css` rule;
- wire both reachability checks into normal `npm run check` and tombstone the retired facade;
- record retain/defer dispositions for test/tooling and deeper surface-specific work.

**Acceptance:**

- browser graph reports 25 production HTML script roots reaching all 85 remaining browser scripts;
- Functions graph reports 15 route roots reaching all 38 Functions sources;
- repository checks, storage/recovery regressions, Reader resume regressions, and production build pass;
- complete five-project real-browser E2E passes on the exact final head;
- no dependency, lockfile, route, security implementation, or formal release-version change occurs.

### I-005 — Make canonical Page Map source and supersession ownership explicit

**Source findings:** B-001, B-002  
**Status:** ✅ Verified in Audit-B candidate  
**Scope:**

- pass the authorized `session.sourcePath` to the Page Map sandbox rather than a logical book/storage identity;
- give every generation an AbortController and one active-generation owner;
- abort superseded script/book/display/media waits and destroy the hidden rendition, Book, and iframe exactly once;
- keep the existing canonical Page Map/progress ownership and cache model otherwise unchanged.

**Acceptance:**

- deterministic large-EPUB Page Map reaches 360 pages;
- hidden Page Map sandbox returns to zero;
- repeated viewport/layout supersession remains bounded;
- complete five-project Reader regression matrix passes.

### I-006 — Close EPUB.js rendition/manager lifecycle retention

**Source finding:** B-003  
**Status:** ✅ Verified on measured code head `4c9e41fda640926c393dd72397058447d0af92bf`  
**Scope:**

- carry named unload-listener cleanup for Default and Continuous managers without replacing Continuous native scroll/debounce behavior;
- remove the stage `orientationchange` listener with the same event name used for registration;
- release rendition-owned `Book.spine.hooks.content` callbacks on destroy;
- guard the supported EPUB.js 0.3.93 dependency revision during build;
- add deterministic lifecycle tests, including the Default-first/Continuous-second inheritance case.

**Acceptance:**

- former six-cycle flow-retention slope collapses after lifecycle drain;
- unit contract proves manager listeners, orientation listener, and Book hook ownership return to zero;
- production build rejects an unexpected EPUB.js lifecycle dependency revision;
- Verify plus all five browser projects pass.

### I-007 — Release Continuous section caches with the live view lifecycle

**Source finding:** B-004  
**Status:** ✅ Verified on measured code head `4c9e41fda640926c393dd72397058447d0af92bf`  
**Scope:**

- unload a cached EPUB section only when its final live manager view is removed;
- release the sections owned by remaining views during full rendition teardown;
- preserve a shared section cache while another live view still references the same section;
- test duplicate-view safety and destroy-time release deterministically.

**Acceptance:**

- nine-chapter Continuous soak returns from transient 18 views to 5;
- retained Documents improve from +13 before this fix to 0 after it;
- retained Nodes improve from +3,047 to +44, listeners remain 0, and heap remains near-flat (~+0.68 MiB);
- access-request count stays at one in the isolated soak;
- Verify and all five browser projects pass.

## Deferred / skipped recommendations

- Do **not** rewrite `v2-entrypoints.json` into a moving manifest.
- Do **not** restore or replace retired Batch Edit/Artwork functionality.
- Do **not** restructure Reader modules from age/file-count alone; Audit B found no duplicate responsibility requiring consolidation.
- Do **not** defer Page Map generation merely to chase startup numbers; the final large-EPUB first-readable/Page-Map measurements and zero-long-task result do not justify it.
- Do **not** add Reader virtualization or a new buffering abstraction; Continuous returns to five live views and the sustained traversal is bounded after lifecycle cleanup.
- Do **not** encode a brittle CI heap ceiling when structural cleanup invariants and exact before/after ownership probes provide a stronger regression contract.
- Do **not** restore the retired R6 forwarding facades unless a concrete compatibility contract is re-established; current code must import the real service owner.
- Do **not** restore the retired top-level `reading-status.js` facade; current code must use canonical domain reading-state ownership.
- Do **not** delete deterministic tests because their filenames reference historical milestones; they remain active test-runner inputs.
- Do **not** assume M-series, `check-v2-6.mjs`, or later release-era standalone checks are redundant because the R-series was retired; Audit G must review them separately.
- Do **not** treat a clean whole-file Functions graph as proof that every export/route/service behavior is optimal; Audit E owns that security-sensitive review.
- Do **not** optimize Library/Keeper without reproducible realistic-scale evidence.

## Audit A closeout

v2.11A is complete. Its output is an evidence-backed current ownership inventory, permanent browser/Functions reachability checks, removal of confirmed dead compatibility material, and explicit handoff of specialized questions to Audits B–H.

## Audit B closeout

v2.11B is complete on the measured Reader code head `4c9e41fda640926c393dd72397058447d0af92bf`: Verify and the complete Chromium desktop/mobile, Firefox desktop, and WebKit desktop/mobile matrix are green. The audit removed demonstrated Page Map and EPUB.js lifecycle retention defects while preserving the established Reader architecture. The final large-EPUB and Continuous measurements do not justify a broader Reader refactor or further performance optimization.

This does **not** complete v2.11 overall; Audits C–H and any evidence-justified implementation slices still precede a formal v2.11.0 release cut.