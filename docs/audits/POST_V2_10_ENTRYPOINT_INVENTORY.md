# v2.11 Entry Point & Ownership Inventory

> **Status:** 🟨 v2.11A working record  
> **Execution baseline:** `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`  
> **First landed v2.11 slice:** `8c5145b490bda77b5db5527f957ad4bcfea0b113`  
> **Frozen architecture comparison:** [`../architecture/v2-entrypoints.json`](../architecture/v2-entrypoints.json)  
> **Findings register:** [`POST_V2_10_AUDIT.md`](./POST_V2_10_AUDIT.md)

This working inventory compares current composition with the frozen v2.0 architecture manifest without rewriting that historical baseline.

## Current ownership map

### Public Library / Series

- `src/index.html`, `src/nsfw.html`, and `src/series.html` remain the direct public HTML entrypoints.
- Library composition remains split between `library.js`, `library-model.js`, `library-renderers.js`, and shared domain/state modules.
- Series composition remains split between `series.js`, `series-renderers.js`, and shared public volume actions/domain state.
- Post-v2 module growth is not itself evidence of duplicate ownership; v2.11C owns deeper runtime and realistic-scale review.

### Reader

- `src/reader.html` remains the direct Reader entrypoint.
- `reader-bootstrap.js` owns the authorized session/application handoff.
- `reader/book-session.js` owns the authorized book session boundary; `reader/app.js` composes Reader controllers/adapters.
- Search, resume, error presentation, input/navigation, image focus, Page Map, bookmarks, progress, Pages, and Continuous remain separately named owners pending v2.11B reliability review.
- Authored local `?v=` history has been removed from Reader imports; build-time stamping is the only local cache-version owner.

### Garden Keeper

- `src/admin.html` plus `admin/core.js` and `admin/app.js` remain the Keeper shell/client/composition roots.
- Auth/session, Library/Series, Upload, Maintenance, History, Trash, Abuse, and version/shell workflows remain retained owners.
- Batch Edit and Batch Artwork are retired product surface and remain tombstoned; the multi-EPUB upload queue is a separate retained workflow.

### Pages Functions

- Route files remain thin adapters into `functions/services/` ownership for auth, media, catalog, storage, validation, abuse, HTTP, and admin behavior.
- Real `_lib` helpers remain implementation dependencies where current services use them.
- `functions/_lib/b2.js` and `functions/_lib/garden-maintenance.js` are forwarding compatibility facades only. The retired R6 milestone checker was a known executable consumer; incomplete code-search indexing is not sufficient evidence to delete the facades yet. v2.11E must finish consumer/security evidence first.

### Tooling and verification

- Fast per-change ownership: active `npm run check`, targeted Verify regressions, and production build.
- Full deterministic/security/performance ownership: manual/monthly Baseline Health (`npm run check`, `check:security`, `npm test`, performance sanity, build).
- Real-browser ownership: the five-project Chromium/Firefox/WebKit desktop plus Chromium/WebKit mobile E2E matrix.
- Formal publication ownership: the verified v2 release workflow; formal package/release version remains v2.10.0 during the audit line.
- R0–R10 milestone checker executables were release-era executable policy snapshots. Every reviewed R-series checker encoded stale self-retention/test-chain assumptions that contradict the current verification split. They are retired in v2.11 and protected by `check-retired-milestone-checkers.mjs`.
- M-series checks, `check-v2-6.mjs`, and other release-era standalone tools are **not** implied redundant by the R-series decision; v2.11G must review them separately.

## Current decisions

- The frozen v2 manifest stays immutable; current ownership is documented here instead.
- Library and Series keep established controller/model/renderer/domain ownership pending v2.11C.
- Reader post-v2 modules are not refactor candidates from file count alone; v2.11B owns deeper ownership and long-session review.
- Build-time deployment stamping remains the sole local asset-cache version owner.
- Batch Edit and Batch Artwork remain retired with no replacement.
- The retained multi-EPUB upload queue remains separate from those retired features.
- The two R6 forwarding facades remain for now; delete/retain is deferred until consumer evidence is complete.
- Historical R0–R10 executable milestone checkers are retired; historical architecture/release documentation and Git history remain the record of those milestones.

## v2.11A remaining inventory work

- [ ] Finish any unresolved public, Reader, Keeper, Functions, and operational-tool ownership edges not captured above.
- [ ] Finish consumer tracing of the two R6 compatibility facades.
- [ ] Identify additional unreachable source, obsolete migration-only paths, unused exports, stale fixtures, and stale current documentation references.
- [ ] Record retain / cleanup / refactor / defer / skip decisions for every remaining candidate.
