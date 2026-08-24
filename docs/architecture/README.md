# Shadow Garden Architecture

This directory is the refactor contract surface for Shadow Garden. It begins with the **R0 frozen v1.15.14 baseline** and should be updated deliberately as later refactor milestones replace existing owners.

## Frozen v1 baseline

- [`V1_BASELINE.md`](./V1_BASELINE.md) — runtime surfaces, module ownership, dependency direction, Reader invariants, identity formats, and known duplicate ownership.
- [`PERSISTENCE_CONTRACTS.md`](./PERSISTENCE_CONTRACTS.md) — browser-local localStorage/IndexedDB contracts, server-issued cookies, and migration rules.
- [`HTTP_STORAGE_CONTRACTS.md`](./HTTP_STORAGE_CONTRACTS.md) — Pages Functions route/auth contracts and private Backblaze B2 namespace ownership.
- [`v1-entrypoints.json`](./v1-entrypoints.json) — machine-readable JS/CSS entrypoint manifest used by the R0 regression check.

## Permanent guardrail

`tools/check-r0.mjs` is part of `npm run check`. It is intentionally broader than the old milestone-specific checks: it freezes page entrypoint order, persistent key families, identity formats, protected routes, media Range/auth behavior, admin authorization, B2 boundaries, and the three-state reading contract.

Later milestones may change a frozen item only when the replacement architecture is intentional, documented here, and accompanied by tests that demonstrate the same contract or an explicitly approved behavior change. The manifest is therefore a change detector rather than a rule that v1 file names must exist forever.
