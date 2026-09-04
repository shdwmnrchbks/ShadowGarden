# v2.11 Entry Point & Ownership Inventory

> **Status:** 🟨 v2.11A working record  
> **Execution baseline:** `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`  
> **Frozen architecture comparison:** [`../architecture/v2-entrypoints.json`](../architecture/v2-entrypoints.json)  
> **Findings register:** [`POST_V2_10_AUDIT.md`](./POST_V2_10_AUDIT.md)

This working inventory compares current composition with the frozen v2.0 architecture manifest without rewriting that historical baseline.

## Current decisions

- The frozen v2 manifest stays immutable; current ownership is documented separately.
- Library and Series keep their established controller/model/renderer/domain ownership pending the dedicated v2.11C audit.
- Reader post-v2 modules are not refactor candidates from file count alone; v2.11B owns the deeper ownership and long-session review.
- The three historical Reader import query versions identified before v2.11 are removed in the first v2.11 cleanup. A new authored-source guard now verifies that local cache-version history remains build-owned.
- Batch Edit and Batch Artwork were retired before v2.11 and are not replacement/refactor targets.
- The retained multi-EPUB upload queue remains separate from those retired features.
- `functions/_lib/b2.js` and `functions/_lib/garden-maintenance.js` remain compatibility-facade candidates; v2.11A must trace current consumers before deciding retain/remove.
- Historical `check-r0.mjs` through `check-r10.mjs` remain an Audit G policy/coverage question; they are not automatically restored to the active check chain.

## v2.11A remaining inventory work

- [ ] Finish current public, Reader, Keeper, Functions, and operational-tool entrypoint inventory.
- [ ] Trace consumers of the two R6 compatibility facades.
- [ ] Identify additional unreachable source, obsolete migration-only paths, unused exports, stale fixtures, and stale current documentation references.
- [ ] Record retain / cleanup / refactor / defer / skip decisions for every candidate.
