# v2.11 Entry Point & Ownership Inventory

> **Status:** ✅ v2.11A inventory complete on current cleanup candidate  
> **Execution baseline:** `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`  
> **First landed v2.11 slice:** `8c5145b490bda77b5db5527f957ad4bcfea0b113`  
> **Frozen architecture comparison:** [`../architecture/v2-entrypoints.json`](../architecture/v2-entrypoints.json)  
> **Findings register:** [`POST_V2_10_AUDIT.md`](./POST_V2_10_AUDIT.md)

This inventory records current production composition without rewriting the frozen v2.0 architecture manifest. It answers whole-file ownership/reachability questions for current browser source and Pages Functions, then hands deeper surface-specific review to Audits B–H.

## Current ownership map

### Public Library / Series

- `src/index.html`, `src/nsfw.html`, and `src/series.html` remain the direct public HTML entrypoints.
- Library composition remains split between `library.js`, `library-model.js`, `library-renderers.js`, and shared domain/state modules.
- Series composition remains split between `series.js`, `series-renderers.js`, and shared public volume actions/domain state.
- The active browser reachability guard follows HTML script roots, ESM imports, dynamic imports, and absolute `/assets/js/*.js` composition edges. After the v2.11A cleanup it proves all authored browser JavaScript is production-reachable.
- Post-v2 module growth is not itself evidence of duplicate ownership; v2.11C owns deeper runtime and realistic-scale review.

### Reader

- `src/reader.html` remains the direct Reader entrypoint.
- `reader-bootstrap.js` owns the authorized session/application handoff.
- `reader/book-session.js` owns the authorized book session boundary; `reader/app.js` composes Reader controllers/adapters.
- Search, resume, error presentation, input/navigation, image focus, Page Map, bookmarks, progress, Pages, and Continuous remain separately named owners pending v2.11B reliability review.
- Authored local `?v=` history has been removed from Reader imports; build-time stamping is the only local cache-version owner.
- The former top-level `reading-status.js` compatibility facade was not reachable from any production HTML/module composition root. Current Library/Series/Reader code consumes canonical `domain/reading-state.js` ownership through the domain layer, so the unused facade and its stale `_headers` rule are retired in v2.11A.

### Garden Keeper

- `src/admin.html` plus `admin/core.js` and `admin/app.js` remain the Keeper shell/client/composition roots.
- Keeper composition deliberately includes dynamic `loadScript()` edges; the browser reachability guard recognizes those absolute script references rather than treating them as unowned files.
- Auth/session, Library/Series, Upload, Maintenance, History, Trash, Abuse, Recovery Readiness, version, shell, and motion workflows remain retained owners.
- Batch Edit and Batch Artwork are retired product surface and remain tombstoned; the multi-EPUB upload queue is a separate retained workflow.

### Pages Functions

- Route files remain thin adapters into `functions/services/` ownership for auth, media, catalog, storage, validation, abuse, HTTP, recovery, translations, and admin behavior.
- Real `_lib` helpers remain implementation dependencies where current services use cryptographic/session, identity, throttling, crawler-policy, taxonomy, and other primitive behavior.
- The old `functions/_lib/b2.js` and `functions/_lib/garden-maintenance.js` forwarding facades had no implementation of their own. Current repository tracing found no remaining route/service/test/tool import after the historical R6 checker was retired, so v2.11 removed both aliases and guards against their reintroduction.
- `functions/services/storage.js` remains the single B2 transport owner; `functions/services/catalog.js` remains the single server-side catalog persistence/Garden Maintenance owner. Auth/HTTP/validation ownership remains in their existing services.
- The active Functions reachability guard treats every Pages Function route as a production root and follows relative module edges through `services/` and `_lib/`. The current candidate proves 15 route roots reach all 38 Functions sources, so no additional whole-file backend dead source is established by Audit A.

### Tooling and verification

- Fast per-change ownership: active `npm run check`, targeted Verify regressions, and production build.
- Full deterministic/security/performance ownership: manual/monthly Baseline Health (`npm run check`, `check:security`, `npm test`, performance sanity, build).
- Real-browser ownership: the five-project Chromium/Firefox/WebKit desktop plus Chromium/WebKit mobile E2E matrix.
- Formal publication ownership: the verified v2 release workflow; formal package/release version remains v2.10.0 during the audit line.
- `tools/run-tests.mjs` discovers every `*.test.mjs` file in the unit/service/dom/browser layers. Historical-looking regression filenames are therefore active deterministic coverage, not stale fixtures by name alone.
- R0–R10 milestone checker executables were release-era executable policy snapshots. Every reviewed R-series checker encoded stale self-retention/test-chain assumptions that contradict the current verification split. They are retired in v2.11 and protected by `check-retired-milestone-checkers.mjs`.
- The former R6 forwarding facades are separately protected by `check-retired-r6-facades.mjs`, which rejects both retired paths and any new JS/MJS/CJS import of them.
- M-series checks, `check-v2-6.mjs`, and other release-era standalone tools are **explicitly deferred to v2.11G**. Audit A does not infer redundancy from age or the R-series decision.

## Current decisions

- The frozen v2 manifest stays immutable; current ownership is documented here instead.
- Library and Series keep established controller/model/renderer/domain ownership pending v2.11C.
- Reader post-v2 modules are not refactor candidates from file count alone; v2.11B owns deeper ownership and long-session review.
- Build-time deployment stamping remains the sole local asset-cache version owner.
- Batch Edit and Batch Artwork remain retired with no replacement.
- The retained multi-EPUB upload queue remains separate from those retired features.
- The two forwarding-only R6 compatibility facades are retired; current code imports the actual service owner instead.
- The unreachable top-level `reading-status.js` compatibility facade is retired; `domain/reading-state.js` remains the canonical owner and the stylesheet remains directly composed by HTML.
- Historical R0–R10 executable milestone checkers are retired; historical architecture/release documentation and Git history remain the record of those milestones.
- Current deterministic test files are retained because the test runner actively discovers them; filename age is not evidence of staleness.
- Release-era standalone tooling is deferred to Audit G; CSS/selectors to Audit F; documentation hygiene to Audit H; deeper unused-export/ownership questions inside Reader, Library/Series, Keeper, and Functions remain owned by Audits B–E.

## v2.11A closeout

- [x] Current public, Reader, Keeper, and Functions production entrypoints/composition roots are documented.
- [x] Browser whole-file reachability is mechanically guarded; the single disconnected compatibility facade found by the first run is removed and tombstoned.
- [x] Pages Functions whole-file reachability is mechanically guarded; no additional unreachable backend source is present in the current graph.
- [x] Current test-layer ownership is explicit; historical-looking tests remain active deterministic regressions.
- [x] Remaining specialized candidates have explicit owners/dispositions in Audits B–H rather than speculative Audit-A deletion.
