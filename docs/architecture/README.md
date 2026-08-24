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

## R4 + R4.1 Reader application

- [`READER_LAYER.md`](./READER_LAYER.md) — authorized book session, Reader orchestrator, rendition/Page/Continuous adapters, canonical progress/bookmark/completion/settings ownership, retained EPUB.js compatibility boundaries, Pages-only input, and isolated focused-image zoom.
- R4 shipped in v1.18.0; R4.1 stabilizes the Reader in v1.19.0 after the v1.18.1–v1.18.3 corrective releases.
- Implementation: `src/assets/js/reader/`, with `reader-bootstrap.js` as the protected startup entrypoint.

R4.1 permanently separates `page-navigation-input.js` from `image-focus.js`. EPUB documents receive no Reader-owned `touchmove` or `touch-action` override, so Continuous vertical touch scrolling remains native. Magnification exists only in the top-level focused-image overlay; the live EPUB viewport is never scaled.

## R5 Garden Keeper application

- [`KEEPER_LAYER.md`](./KEEPER_LAYER.md) — Garden Keeper composition root, single admin client, signed-session boundary, isolated workflows, contained Upload internals, lifecycle events, and Keeper security invariants introduced in v1.20.0.
- Direct entrypoints: `admin/core.js` and `admin/app.js`.
- First-class workflow owners: Authentication/session, shell, Library/Series, Maintenance, Catalog History, Trash & Recovery, Abuse Watch, and deployed version.
- Upload remains internally composed because local EPUB validation/batch processing is substantial, but those internals are contained behind the R5 application root and no longer replace the shared API/session or Library/Series owners.

R5 is deliberately browser-side only. Pages Functions route/service extraction begins in R6 so the existing token + signed-session authorization, server-side cooldown, opaque cover identity, and private B2 boundaries remain unchanged while Keeper ownership moves.

## Permanent guardrails

- `tools/check-r0.mjs` protects frozen behavior/security/persistence contracts when owners move.
- `tools/check-r1.mjs` protects repository layout, source naming, build boundaries, CI pins, dead-file removal, and asset versioning.
- `tools/check-r2.mjs` protects canonical domain/state ownership and Unread / In Progress / Finished transitions.
- `tools/check-r3.mjs` protects single-owner Library/Series rendering and parity across all volume entry points.
- `tools/check-r4.mjs` protects the core R4 Reader session/application/state boundaries.
- `tools/check-r4-1.mjs` protects post-R4 stabilization: Reader startup wiring, split input ownership, native Continuous touch behavior, isolated image zoom, focus/chrome behavior, and removal of Reader-wide zoom remnants.
- `tools/check-r5.mjs` protects the Garden Keeper shell/client/session ownership, isolated workflows, and frontend-only R5 boundary.

Later milestones may replace a frozen implementation only when the new owner is intentional, documented here, and covered by equivalent or stronger regression checks.