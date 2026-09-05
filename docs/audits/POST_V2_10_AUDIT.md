# v2.11 Engineering Audit — Findings & Decisions

> **Status:** ✅ v2.11A–G complete · v2.11H in progress  
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
| A — repository/ownership | One disconnected browser compatibility facade; stale authored cache-version strings; obsolete R-series executable policy; forwarding-only R6 facades. Final reachability: 25 HTML roots → 85 browser scripts; 15 Function routes → 38 Functions sources. | Cleanup only. Retire demonstrated dead/obsolete owners, guard their absence, keep frozen historical manifests historical. |
| B — Reader reliability | Page Map used logical identity as fetch source; superseded hidden maps lacked cancellation; EPUB.js 0.3.93 retained manager listeners/hooks and trimmed section DOM. Final flow drain ~+2.31 MiB/+702 Nodes/+4 Documents/+14 listeners; Continuous soak 0 Documents/+44 Nodes/0 listeners/~+0.68 MiB. | Targeted lifecycle/source fixes. Keep Reader module split, startup architecture, Page Map timing, and existing buffering; no virtualization or broad rewrite. |
| C — Library/Series | Realistic 300-series fixture exposed repeated browser-local state reads and duplicate action/request ownership. Hydration reads 121,905 → 14,211; interaction reads 314,387 → 11,645. | Measured optimization only. Keep domain/controller/render split; no virtualization or new persistence/cache architecture. |
| D — Garden Keeper | Maintenance/History/Trash duplicated one snapshot GET three times; Upload preflight refetched an already-materialized Library catalog. | Bounded request-owner cleanup. Keep workflow split, single AdminClient, recovery-sensitive ordering, and sequential operations without speculative parallelization. |
| E — Functions/security/storage | Authenticated read-only handlers incorrectly required write B2 credentials; service export surface contained unconsumed implementation symbols; normal Verify lacked the complete service/security gate. | Least-privilege credential routing, nine private implementation symbols, direct policy tests, full security/service coverage in Verify. No backend/router rewrite. |
| F — CSS/motion/accessibility | 36 stylesheets/2,254 selectors; cleanup converged to 0 literal unreferenced class candidates and 0 unused custom properties. Remaining specificity/`!important` pressure is concentrated in deliberate cascade layers. | Remove proven stale CSS only. Retain surface ownership and accessibility/motion behavior; no broad stylesheet rewrite. |
| G — build/dependencies/tests/tooling | Seven self-invalid release-era tools remained executable; useful security behavior was mixed with stale wiring; site-voice checker was a current orphan; Verify/Baseline duplicated the repository check. | Retire stale executable policy behind an absence guard, migrate behavior to 47 service tests, activate current flavor guard, and remove duplicate CI cost. Keep Node/npm, lockfiles, no-bundler build, dependencies, preview, publisher, and deterministic tests. |
| H — documentation/repository hygiene | Current architecture documents still described v2.8/v2.6 state, deleted executable guards, and pre-G workflow ownership after the implementation had moved on. | In progress: reconcile authoritative current docs, preserve archives/releases unchanged, and extend freshness checks to the current architecture set. |

## Audit A — repository & ownership

Accepted cleanup:

- build-time deployment stamping is the only local authored asset-version owner;
- obsolete R-series executable policy snapshots remain absent behind `check-retired-milestone-checkers.mjs`;
- forwarding-only R6 compatibility facades remain absent behind `check-retired-r6-facades.mjs`;
- the disconnected top-level reading-state facade and stale deployment-header rule remain retired;
- current browser and Functions reachability are mechanically checked;
- deterministic `*.test.mjs` files remain because `tools/run-tests.mjs` actively discovers them.

No inventory evidence justified broader Reader, Library, Keeper, Functions, CSS, or tooling restructuring.

## Audit B — Reader reliability

The deterministic large EPUB is 6,315,313 bytes with 18 chapters × 72 passages.

Final measurements:

- first readable: ~1.09–1.13 s;
- isolated Page Map: 360 device pages in ~2.49 s and hidden sandbox count returns to zero;
- repeated Pages ↔ Continuous + viewport ownership drain: ~+2.31 MiB heap, +702 Nodes, +4 Documents, +14 listeners;
- sustained Continuous traversal: transient peak 18 views/iframes → 5, 0 retained Documents, +44 Nodes, 0 listeners, ~+0.68 MiB heap;
- isolated Continuous soak: one access request and no renewal churn;
- no measured long-task evidence requiring an architecture change.

The accepted implementation is protected-source/cancellation ownership plus narrow EPUB.js lifecycle/cache cleanup. Broad Reader consolidation, Page Map deferral, new virtualization, and runner-sensitive heap ceilings remain unjustified.

## Audits C–G — detailed evidence

- [`V2_11_LIBRARY_SERIES_AUDIT.md`](./V2_11_LIBRARY_SERIES_AUDIT.md) — Audit C.
- [`V2_11_KEEPER_AUDIT.md`](./V2_11_KEEPER_AUDIT.md) — Audit D.
- [`V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md`](./V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md) — Audit E.
- [`V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md`](./V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md) — Audit F.
- [`V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md`](./V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md) — v2.11G build/dependency/test/tooling closeout.

## Audit H — current work

[`V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md`](./V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md) owns final current-document reconciliation. Historical release notes, archived roadmaps, milestone evidence, and Git history are intentionally not rewritten to remove historical version/tool references.

## Global skip/defer decisions

Do not:

- turn the frozen v2 entrypoint manifest into a moving source of truth;
- restore Batch Edit/Batch Artwork or retired compatibility facades;
- restructure Reader modules from age/file count alone;
- defer Page Map or add Reader virtualization without new measurements;
- add Library virtualization/new persistence architecture at the intended ~300-series scale;
- parallelize recovery-sensitive Keeper operations without measured benefit and equivalent safety evidence;
- add a router/framework/bundler or second publisher without a demonstrated problem;
- perform dependency auto-fix/auto-merge as maintenance policy;
- delete deterministic tests because their names are historical;
- normalize CSS specificity/`!important` counts merely to reduce aggregate numbers;
- rewrite historical release/archive documents as though they were current contracts.

## Release boundary

v2.11 audit completion and v2.11 formal release are separate events. Formal release metadata remains v2.10.0 until the accepted A–H stack is assembled, exact-main gates are green, release records/changelog/lockfile deliberately converge, Cloudflare reports the final commit, and production smoke passes.
