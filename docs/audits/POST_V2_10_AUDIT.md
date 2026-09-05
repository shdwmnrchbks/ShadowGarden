# v2.11 Engineering Audit — Findings & Decisions

> **Status:** ✅ v2.11A–H complete · release convergence next  
> **Formal baseline release:** v2.10.0  
> **Active deployment line:** v2.11.0  
> **Execution baseline:** `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`  
> **Audit G exact-green head:** `974fb1d8212ed4afc713da0ed340e22a58f1adff`  
> **Roadmap:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)

This is the **current consolidated findings register** for v2.11. Detailed subsystem measurements stay in dedicated audit records; this file records the accepted decisions and prevents intermediate audit state from becoming a second roadmap.

Valid outcomes are **No change needed**, **Cleanup**, **Targeted refactor**, **Measured optimization**, **Deferred**, and **Skipped**. Refactoring is not the default.

## Consolidated register

| Audit | Evidence | Decision |
| --- | --- | --- |
| A — repository/ownership | One disconnected browser compatibility facade; stale authored cache versions; obsolete R-series executable policy; forwarding-only R6 facades. Final reachability: 25 HTML roots → 85 browser scripts; 15 Function routes → 38 Functions sources. | Cleanup only. Retire demonstrated dead/obsolete owners, guard their absence, keep frozen historical manifests historical. |
| B — Reader reliability | Page Map source/supersession defects plus EPUB.js manager/hook and trimmed-section retention. Final flow drain ~+2.31 MiB/+702 Nodes/+4 Documents/+14 listeners; Continuous soak 0 Documents/+44 Nodes/0 listeners/~+0.68 MiB. | Targeted lifecycle/source fixes. Keep Reader module split/startup/Page Map timing/buffering; no virtualization or broad rewrite. |
| C — Library/Series | Realistic 300-series fixture exposed repeated browser-local state reads and duplicate action/request ownership. Hydration reads 121,905 → 14,211; interaction reads 314,387 → 11,645. | Measured optimization only. Keep domain/controller/render split; no virtualization or new persistence/cache architecture. |
| D — Garden Keeper | Maintenance/History/Trash duplicated one snapshot GET three times; Upload preflight refetched an already-materialized Library catalog. | Bounded request-owner cleanup. Keep workflow split, single AdminClient, recovery-sensitive ordering, and sequential operations without speculative parallelization. |
| E — Functions/security/storage | Read-only handlers incorrectly required write B2 credentials; service export surface had unconsumed implementation symbols; normal Verify lacked the complete service/security gate. | Least-privilege credentials, nine private implementation symbols, policy tests, full security/service coverage in Verify. No backend/router rewrite. |
| F — CSS/motion/accessibility | 36 stylesheets/2,254 selectors; cleanup converged to 0 literal unreferenced class candidates and 0 unused custom properties. Remaining cascade pressure is concentrated in deliberate layers. | Remove proven stale CSS only. Retain surface ownership and accessibility/motion behavior; no broad stylesheet rewrite. |
| G — build/dependencies/tests/tooling | Seven self-invalid release-era tools remained executable; useful security behavior mixed with stale wiring; current flavor checker was orphaned; Verify/Baseline duplicated repository checks. | Retire stale policy behind absence guard, migrate behavior to 47 service tests, activate flavor guard, remove duplicate CI cost. Keep runtime/lockfiles/no-bundler/dependency/preview/publisher/test architecture. |
| H — documentation/repository hygiene | Current architecture/operations docs described superseded version state, deleted executable guards, pre-G workflow ownership, and stale G closeout state. | Reconcile current source of truth, preserve historical evidence, and mechanically guard current status/architecture/operations freshness. |

## Audit A — repository & ownership

Accepted cleanup:

- build-time deployment stamping is the only local authored asset-version owner;
- obsolete R-series executable policy remains absent behind `check-retired-milestone-checkers.mjs`;
- forwarding-only R6 compatibility facades remain absent behind `check-retired-r6-facades.mjs`;
- disconnected top-level reading-state facade and stale deployment-header rule remain retired;
- browser and Functions reachability are mechanically checked;
- deterministic `*.test.mjs` files remain because `tools/run-tests.mjs` actively discovers them.

No inventory evidence justified broader Reader, Library, Keeper, Functions, CSS, or tooling restructuring.

## Audit B — Reader reliability

Deterministic large EPUB: 6,315,313 bytes, 18 chapters × 72 passages.

Final measurements:

- first readable ~1.09–1.13 s;
- isolated Page Map: 360 device pages in ~2.49 s, hidden sandbox returns to zero;
- repeated Pages ↔ Continuous + viewport ownership drain: ~+2.31 MiB heap, +702 Nodes, +4 Documents, +14 listeners;
- sustained Continuous traversal: transient 18 views/iframes → 5, 0 retained Documents, +44 Nodes, 0 listeners, ~+0.68 MiB heap;
- one access request in isolated Continuous soak, no renewal churn, no measured long tasks.

Accepted implementation is protected-source/cancellation ownership plus narrow EPUB.js lifecycle/cache cleanup. Broad Reader consolidation, Page Map deferral, new virtualization, and runner-sensitive heap ceilings remain unjustified.

## Audits C–H — detailed evidence

- [`V2_11_LIBRARY_SERIES_AUDIT.md`](./V2_11_LIBRARY_SERIES_AUDIT.md) — Audit C.
- [`V2_11_KEEPER_AUDIT.md`](./V2_11_KEEPER_AUDIT.md) — Audit D.
- [`V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md`](./V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md) — Audit E.
- [`V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md`](./V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md) — Audit F.
- [`V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md`](./V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md) — Audit G.
- [`V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md`](./V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md) — Audit H.

## Global skip/defer decisions

Do not:

- turn the frozen v2 entrypoint manifest into a moving source of truth;
- restore Batch Edit/Batch Artwork or retired compatibility facades;
- restructure Reader modules from age/file count alone;
- defer Page Map or add Reader virtualization without new measurements;
- add Library virtualization/new persistence architecture at intended ~300-series scale;
- parallelize recovery-sensitive Keeper operations without measured benefit and equivalent safety evidence;
- add a router/framework/bundler or second publisher without a demonstrated problem;
- perform dependency auto-fix/auto-merge as maintenance policy;
- delete deterministic tests because their names are historical;
- normalize CSS specificity/`!important` counts merely to reduce aggregate numbers;
- rewrite historical release/archive/security records as though they were current contracts.

## Audit H closeout

Current architecture/operations documentation now describes the owners that actually run after Audits A–G. Root status, roadmap, docs/architecture/audit indexes, build/test/maintenance/CSS/dependency contracts, and final G evidence are protected by the expanded documentation freshness guard. Historical records are intentionally outside that current-state scan.

No H change modifies runtime product behavior, dependency graph, lockfiles, security/storage boundaries, persistence, or formal release metadata.

## Release boundary

v2.11 audit completion and v2.11 formal release are separate events. Formal release metadata remains v2.10.0 until the accepted A–H stack is assembled on the intended final main state, exact-main gates are green, release record/changelog/lockfile deliberately converge, Cloudflare reports the final commit, and production smoke passes.
