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

## Permanent guardrails

`tools/check-r0.mjs` remains the frozen behavior/security/state contract. `tools/check-r1.mjs` adds repository-layout, naming, build-boundary, CI-pin, dead-file, and asset-versioning checks.

Later milestones may change a frozen item only when the replacement architecture is intentional, documented here, and accompanied by tests that demonstrate the same contract or an explicitly approved behavior change. The manifests are change detectors rather than a rule that v1 file names must exist forever.
