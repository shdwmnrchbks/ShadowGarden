# Shadow Garden Versioning Contract

**Status:** Active contract  
**Active deployment/product version:** v2.10.0 — Maintenance & Supply Chain  
**Formal release source version:** v2.10.0

Shadow Garden intentionally separates the version shown by a live development deployment from the version eligible for a formal GitHub release, while requiring those version owners to converge at a formal release cut.

## Two version owners

`package.json` contains two distinct fields:

- `version` — the latest **formal release** version. This remains synchronized with `package-lock.json` and is the version consumed by `.github/workflows/release-v2.yml`.
- `deploymentVersion` — the **active deployed product line**. This is the version exposed by generated deployment metadata and shown by the public Library and Garden Keeper.

During milestone development the deployment version may intentionally advance ahead of the formal release version. Immediately before the v2.10.0 release cut, development used:

```json
{
  "version": "2.9.0",
  "deploymentVersion": "2.10.0"
}
```

At a formal release cut the values converge. v2.10.0 uses:

```json
{
  "version": "2.10.0",
  "deploymentVersion": "2.10.0"
}
```

A later development milestone may intentionally diverge them again only through an explicit product-version change; dependency maintenance must not alter version ownership implicitly.

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

The v2.9.0 release aligned `package.json#version`, `package-lock.json`, and `deploymentVersion` at `2.9.0`, included `docs/releases/v2.9.0.md` plus the matching changelog entry, and recorded the completed Keeper Productivity & Recovery acceptance criteria. The permanent Verify and Real Browser E2E gates remained authoritative, and the publisher required matching production deployment metadata plus public production smoke before creating GitHub release `v2.9.0`.

## v2.10.0 release state

The v2.10.0 release cut converges `package.json#version`, `package.json#deploymentVersion`, and the root/workspace package-lock version metadata at `2.10.0`, with `CHANGELOG.md` and `docs/releases/v2.10.0.md` as the matching formal release record. The cut does not rewrite dependency resolutions, integrity data, or transitive dependency metadata merely to synchronize a version label.

The release remains publication-eligible only when the exact final `main` commit passes Verify and the complete Real Browser E2E matrix, Cloudflare production reports the same v2.10.0 version and commit, and the established public production smoke checks succeed. Scheduled v2.10 maintenance automation does not bypass or publish through this contract.
