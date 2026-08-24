# Shadow Garden Documentation

This directory contains architecture contracts, project planning, security history, and design guidance that should not live at the repository root.

## Architecture baseline

- [`architecture/README.md`](./architecture/README.md) — architecture documentation index.
- [`architecture/V1_BASELINE.md`](./architecture/V1_BASELINE.md) — frozen v1.15.14 runtime/ownership/dependency baseline.
- [`architecture/PERSISTENCE_CONTRACTS.md`](./architecture/PERSISTENCE_CONTRACTS.md) — browser persistence, IndexedDB, cookie, and migration contracts.
- [`architecture/HTTP_STORAGE_CONTRACTS.md`](./architecture/HTTP_STORAGE_CONTRACTS.md) — Pages Functions authorization and Backblaze B2 namespace contracts.
- [`architecture/v1-entrypoints.json`](./architecture/v1-entrypoints.json) — machine-readable R0 JS/CSS entrypoint manifest.

## Active roadmap

- [`roadmaps/REFACTOR_ROADMAP.md`](./roadmaps/REFACTOR_ROADMAP.md) — active full-codebase refactor plan leading toward the next major architecture baseline. R0 is complete; R1 is next.

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

- `README.md` — project entry point and development overview.
- `CHANGELOG.md` — release history.
- `package.json` / configuration files — build/runtime configuration.

Historical planning documents should be archived under `docs/` rather than accumulating at the repository root.
