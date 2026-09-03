# Shadow Garden Versioning Contract

**Status:** Active contract  
**Active deployment/product version:** v2.10.0 — Maintenance & Supply Chain  
**Formal release source version:** v2.9.0

Shadow Garden intentionally separates the version shown by a live development deployment from the version eligible for a formal GitHub release.

## Two version owners

`package.json` contains two distinct fields:

- `version` — the latest **formal release** version. This remains synchronized with `package-lock.json` and is the version consumed by `.github/workflows/release-v2.yml`.
- `deploymentVersion` — the **active deployed product line**. This is the version exposed by generated deployment metadata and shown by the public Library and Garden Keeper.

At a formal release cut these values converge. The completed v2.9.0 release used:

```json
{
  "version": "2.9.0",
  "deploymentVersion": "2.9.0"
}
```

During the next in-progress milestone they intentionally diverge again. v2.10 development uses:

```json
{
  "version": "2.9.0",
  "deploymentVersion": "2.10.0"
}
```

The formal release source therefore remains v2.9.0 until a future release cut explicitly advances it, while current development/deployment metadata identifies the v2.10.0 product line.

## Deployment metadata

`tools/lib/build-context.mjs` owns deployment identity. It resolves:

1. `releaseVersion` from `package.json#version`;
2. `version` from `package.json#deploymentVersion`, falling back to `version` when no deployment override exists;
3. commit, branch, and deterministic build timestamp from the established build-context sources.

`tools/build.mjs` uses the resolved deployment `version` for generated asset cache-busting. `tools/write-source.mjs` writes the same build context to `dist/data/version.json`.

Public version consumers therefore read the active deployment version from `/data/version.json`:

- `src/assets/js/library-footer-version.js`
- `src/assets/js/admin/version.js`

No public surface should hard-code the current product version.

## Formal release contract

`.github/workflows/release-v2.yml` continues to use `package.json#version` as the formal release source of truth. A formal release still requires:

- matching `package-lock.json` root/workspace version;
- matching `docs/releases/v${VERSION}.md` release notes;
- successful Verify for the exact `main` commit;
- successful Real Browser E2E for the same commit;
- matching Cloudflare production deployment metadata;
- successful production smoke checks.

Normal `npm run check` includes `check:release`, which deterministically verifies the formal package/lockfile version, newest changelog release, matching release-note heading, v2 publisher ownership, and build-context version ownership before a change reaches those network-backed release gates. Build-context unit coverage derives its expectations from `package.json` rather than hard-coding an old milestone version.

The active `deploymentVersion` does **not** by itself make a milestone release-eligible.

## v2.9.0 release state

The v2.9.0 release commit aligns `package.json#version`, `package-lock.json`, and `deploymentVersion` at `2.9.0`, includes `docs/releases/v2.9.0.md` plus the matching changelog entry, and records the completed Keeper Productivity & Recovery acceptance criteria. The permanent Verify and Real Browser E2E gates remain authoritative. The publisher matched the exact production deployment version/commit and passed public production smoke before creating GitHub release `v2.9.0`.

## v2.10.0 development state

v2.10 development advances only `deploymentVersion` to `2.10.0`; `package.json#version` and the root/workspace version in `package-lock.json` remain `2.9.0` until the next formal release cut. Maintenance automation must never hand-edit dependency integrity or transitive dependency fields merely to synchronize a version label.
