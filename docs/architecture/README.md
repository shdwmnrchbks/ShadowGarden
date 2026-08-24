# Shadow Garden Architecture

This directory is the refactor contract surface for Shadow Garden. It begins with the **R0 frozen v1.15.14 baseline** and is extended as ownership becomes explicit.

## Frozen v1 baseline

- [`V1_BASELINE.md`](./V1_BASELINE.md) — runtime surfaces, dependency direction, Reader invariants, identity formats, and original duplicate ownership.
- [`PERSISTENCE_CONTRACTS.md`](./PERSISTENCE_CONTRACTS.md) — browser-local localStorage/IndexedDB contracts, cookies, and migration rules.
- [`HTTP_STORAGE_CONTRACTS.md`](./HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and private B2 namespaces.
- [`v1-entrypoints.json`](./v1-entrypoints.json) — machine-readable entrypoint contract updated only for intentional refactor replacements.

## R1 repository/tooling contracts

- [`MODULE_CONVENTIONS.md`](./MODULE_CONVENTIONS.md) — naming, ownership, DOM/state, CSS, dependency direction, and placement conventions.
- [`BUILD_CONTRACT.md`](./BUILD_CONTRACT.md) — authored/generated boundaries, root policy, Node/CI policy, dependency strategy, and asset cache-busting.
- [`r1-legacy-source-exceptions.json`](./r1-legacy-source-exceptions.json) — grandfathered v1 patch-style files plus refactor-proven removals.

## R2 shared browser domain

- [`DOMAIN_LAYER.md`](./DOMAIN_LAYER.md) — canonical catalog, identity, progress, bookmarks, reading state, preferences, URL, formatting, and compatibility ownership introduced in v1.16.0.
- Implementation: `src/assets/js/domain/`.

## R3 public Library/Series UI

- [`PUBLIC_UI_LAYER.md`](./PUBLIC_UI_LAYER.md) — Library/Series controllers, query/render ownership, shared volume actions, refresh lifecycle, and removed post-render repair layers introduced in v1.17.0.
- Implementations: `library.js`, `library-model.js`, `library-renderers.js`, `series.js`, `series-renderers.js`, and `public/volume-actions.js`.

## R4 Reader application

- [`READER_LAYER.md`](./READER_LAYER.md) — explicit authorized book session, Reader orchestrator, rendition/Page/Continuous adapters, canonical progress/bookmark/completion/settings ownership, retained EPUB.js compatibility boundaries, and session-only viewport zoom introduced in v1.18.0.
- Implementation: `src/assets/js/reader/`, with `reader-bootstrap.js` as the protected startup entrypoint.

R4 removes the old monolithic Reader, gesture hook, swipe/wheel polish, flow-visibility patch, and separate Finished controller. Pinch/pan/double-tap/desktop zoom is deliberately a visual viewport transform and must never become Page Map or saved-position geometry.

## Permanent guardrails

- `tools/check-r0.mjs` protects frozen behavior/security/persistence contracts when owners move.
- `tools/check-r1.mjs` protects repository layout, source naming, build boundaries, CI pins, dead-file removal, and asset versioning.
- `tools/check-r2.mjs` protects canonical domain/state ownership and Unread / In Progress / Finished transitions.
- `tools/check-r3.mjs` protects single-owner Library/Series rendering and parity across all volume entry points.
- `tools/check-r4.mjs` protects explicit Reader session/feature ownership, zoom-vs-layout separation, and retirement of competing Reader controllers.

Later milestones may replace a frozen implementation only when the new owner is intentional, documented here, and covered by equivalent or stronger regression checks.
