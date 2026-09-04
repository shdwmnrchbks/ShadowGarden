# Shadow Garden Versioning Contract

**Status:** Active contract  
**Active deployment/product version:** v2.11.0 — Engineering Audit, Refactor & Optimization  
**Formal release source version:** v2.10.0

Shadow Garden separates the version shown by an active development deployment from the version eligible for a formal GitHub release, while requiring those version owners to converge at a formal release cut.

## Two version owners

`package.json` contains two distinct fields:

- `version` — the latest **formal release** version. It remains synchronized with `package-lock.json`, `CHANGELOG.md`, and `docs/releases/v${version}.md`, and is consumed by `.github/workflows/release-v2.yml`.
- `deploymentVersion` — the **active deployed product/development line**. It is exposed by generated deployment metadata and shown by the public Library and Garden Keeper.

The latest formal release is v2.10.0. The v2.11 engineering-audit phase intentionally diverges the development line again:

```json
{
  "version": "2.10.0",
  "deploymentVersion": "2.11.0"
}
```

This means v2.11 work can be deployed and verified without implying that a v2.11 formal release exists. Dependency maintenance must not alter version ownership implicitly.

## Deployment metadata

`tools/lib/build-context.mjs` owns deployment identity. It resolves:

1. `releaseVersion` from `package.json#version`;
2. `version` from `package.json#deploymentVersion`, falling back to the formal release version when no deployment override exists;
3. commit, branch, and deterministic build timestamp from the established build-context sources.

`tools/build.mjs` uses the resolved deployment `version` for generated asset cache-busting. `tools/write-source.mjs` writes the same build context to `dist/data/version.json`.

Public version consumers read the active deployment version from `/data/version.json`:

- `src/assets/js/library-footer-version.js`
- `src/assets/js/admin/version.js`

No public surface should hard-code the current product version.

## Formal release contract

`.github/workflows/release-v2.yml` uses `package.json#version` as the formal release source of truth. A formal release requires:

- matching `package-lock.json` root/workspace version;
- matching newest `CHANGELOG.md` formal release heading;
- matching `docs/releases/v${VERSION}.md` release notes;
- successful Verify for the exact `main` commit;
- successful Real Browser E2E for the same commit;
- matching Cloudflare production deployment metadata;
- successful production smoke checks.

Normal `npm run check` includes `check:release`, which verifies formal package/lockfile version ownership, changelog/release-note ownership, v2 publisher ownership, and build-context version ownership before a change reaches network-backed release gates.

The active `deploymentVersion` does **not** by itself make a milestone release-eligible.

## v2.10.0 release state

v2.10.0 is the latest formal release. Its release cut converged `package.json#version`, `package.json#deploymentVersion`, root package-lock version metadata, `CHANGELOG.md`, and `docs/releases/v2.10.0.md` at `2.10.0` and passed the permanent exact-main Verify, five-project Real Browser E2E, matching Cloudflare production metadata, and public smoke gates.

Post-release dependency-maintenance commits do not move the v2.10.0 tag or rewrite its release record.

## v2.11.0 development state

v2.11.0 is the active **Engineering Audit, Refactor & Optimization** development line. The formal version remains v2.10.0 until the audit is complete and any justified refactor/optimization slices are complete.

The v2.11 roadmap explicitly permits a successful outcome with no refactor and/or no optimization: those conditional phases are skipped/deferred when the audit does not demonstrate a material structural problem or realistic-scale bottleneck. A later formal v2.11.0 release cut, if performed, must explicitly converge the formal package/lockfile/changelog/release-note owners and pass the permanent release gates; the roadmap status alone cannot publish it.
