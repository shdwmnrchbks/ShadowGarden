# Shadow Garden Architecture

This directory is the refactor contract surface for Shadow Garden. It begins with the **R0 frozen v1.15.14 baseline** and is extended by later milestones as ownership and tooling become explicit.

## Frozen v1 baseline

- [`V1_BASELINE.md`](./V1_BASELINE.md) — runtime surfaces, module ownership, dependency direction, Reader invariants, identity formats, and known duplicate ownership.
- [`PERSISTENCE_CONTRACTS.md`](./PERSISTENCE_CONTRACTS.md) — browser-local localStorage/IndexedDB contracts, server-issued cookies, and migration rules.
- [`HTTP_STORAGE_CONTRACTS.md`](./HTTP_STORAGE_CONTRACTS.md) — Pages Functions route/auth contracts and private Backblaze B2 namespace ownership.
- [`v1-entrypoints.json`](./v1-entrypoints.json) — machine-readable JS/CSS entrypoint manifest used by the R0 regression check.

## R1 repository/tooling contracts

- [`MODULE_CONVENTIONS.md`](./MODULE_CONVENTIONS.md) — naming, ownership, DOM/state, CSS, dependency-direction, and file-placement conventions for new refactor code.
- [`BUILD_CONTRACT.md`](./BUILD_CONTRACT.md) — authored vs generated boundaries, root policy, Node/CI pinning, dependency policy, and centralized build-time asset cache-busting.
- [`r1-legacy-source-exceptions.json`](./r1-legacy-source-exceptions.json) — the exact pre-R1 patch-style filenames allowed to remain until their owning cleanup milestone.

## R2 shared browser domain

- [`DOMAIN_LAYER.md`](./DOMAIN_LAYER.md) — canonical catalog, book identity, progress, bookmarks, reading state, Library preferences, URL, formatting, and compatibility-boundary ownership introduced in v1.16.0.
- Browser implementation: `src/assets/js/domain/`.

The R2 layer is the required persistence/state dependency for Library, Series, and Reader code going forward. It preserves the R0 browser-local persistence formats while moving interpretation and writes behind explicit owners.

## Permanent guardrails

- `tools/check-r0.mjs` protects the frozen behavior/security/persistence contracts even when their implementation owner moves.
- `tools/check-r1.mjs` protects repository layout, source naming, build boundaries, CI pins, dead-file removal, and asset versioning.
- `tools/check-r2.mjs` protects canonical browser domain ownership and the Unread / In Progress / Finished state transitions.

Later milestones may change a frozen item only when the replacement architecture is intentional, documented here, and accompanied by tests that demonstrate the same contract or an explicitly approved behavior change. The manifests are change detectors rather than a rule that v1 file names must exist forever.
