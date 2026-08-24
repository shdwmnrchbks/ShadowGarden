# Shadow Garden Documentation

This is the single documentation index for Shadow Garden. Architecture contracts, project planning, security history, build conventions, and design guidance live under `docs/` rather than accumulating at the repository root.

## Architecture and refactor contracts

- [`architecture/README.md`](./architecture/README.md) — architecture documentation index.
- [`architecture/V1_BASELINE.md`](./architecture/V1_BASELINE.md) — frozen v1.15.14 runtime/ownership/dependency baseline.
- [`architecture/PERSISTENCE_CONTRACTS.md`](./architecture/PERSISTENCE_CONTRACTS.md) — browser persistence, IndexedDB, cookie, and migration contracts.
- [`architecture/HTTP_STORAGE_CONTRACTS.md`](./architecture/HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and Backblaze B2 namespace contracts.
- [`architecture/MODULE_CONVENTIONS.md`](./architecture/MODULE_CONVENTIONS.md) — post-R1 module naming, ownership, DOM/state, and placement rules.
- [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md) — authored/generated boundaries, Node/CI policy, dependency policy, root layout, and deploy asset versioning.
- [`architecture/v1-entrypoints.json`](./architecture/v1-entrypoints.json) — machine-readable R0 JS/CSS entrypoint manifest.
- [`architecture/r1-legacy-source-exceptions.json`](./architecture/r1-legacy-source-exceptions.json) — explicit grandfather list for pre-R1 patch-style source names.

## Active roadmap

- [`roadmaps/REFACTOR_ROADMAP.md`](./roadmaps/REFACTOR_ROADMAP.md) — active full-codebase refactor plan leading toward the next major architecture baseline. R0 and R1 are complete; R2 is next.

## Completed roadmaps

- [`roadmaps/SECURITY_ROADMAP.md`](./roadmaps/SECURITY_ROADMAP.md) — completed security and anti-abuse roadmap, Milestones 1–9.

## Security records

- [`security/MILESTONE_5_CLOUDFLARE.md`](./security/MILESTONE_5_CLOUDFLARE.md)
- [`security/MILESTONE_6_CRAWLER_POLICY.md`](./security/MILESTONE_6_CRAWLER_POLICY.md)
- [`security/MILESTONE_7_GARDEN_KEEPER.md`](./security/MILESTONE_7_GARDEN_KEEPER.md)
- [`security/MILESTONE_8_ABUSE_RESPONSE.md`](./security/MILESTONE_8_ABUSE_RESPONSE.md)
- [`security/MILESTONE_9_FINAL_AUDIT.md`](./security/MILESTONE_9_FINAL_AUDIT.md)

## Product/design guidance

- [`style/SITE_VOICE.md`](./style/SITE_VOICE.md) — shared copy and tone rules for Library, Reader, and Garden Keeper.

## Files intentionally kept at repository root

The complete root policy is documented in [`architecture/BUILD_CONTRACT.md`](./architecture/BUILD_CONTRACT.md). In short, the root is limited to normal project entry/configuration files and the top-level source directories: README/CHANGELOG, package/config files, `.github/`, `docs/`, `functions/`, `library/`, `src/`, and `tools/`.

Historical planning documents should be archived under `docs/`; generated output belongs in ignored build directories.
