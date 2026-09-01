# Shadow Garden Versioning Contract

**Status:** Active contract  
**Active deployment/product version:** v2.8.0 — Reader Experience (in progress)  
**Latest formal release:** v2.6.7

Shadow Garden intentionally separates the version shown by a live development deployment from the version eligible for a formal GitHub release.

## Two version owners

`package.json` contains two distinct fields:

- `version` — the latest **formal release** version. This remains synchronized with `package-lock.json` and is the version consumed by `.github/workflows/release-v2.yml`.
- `deploymentVersion` — the **active deployed product line**. This is the version exposed by generated deployment metadata and shown by the public Library and Garden Keeper.

During an in-progress milestone, these values may intentionally differ. For the current v2.8 work:

```json
{
  "version": "2.6.7",
  "deploymentVersion": "2.8.0"
}
```

This means the live application identifies itself as v2.8.0 while v2.6.7 remains the latest completed release record until the v2.8 milestone is formally cut.

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

The active `deploymentVersion` does **not** by itself make a milestone release-eligible.

## Cutting the final v2.8.0 release

When v2.8.0 Reader Experience is actually complete:

1. add/finalize `docs/releases/v2.8.0.md` and the v2.8 changelog entry;
2. set `package.json#version` to `2.8.0`;
3. regenerate `package-lock.json` with npm so its root/workspace version becomes `2.8.0` without hand-editing generated dependency metadata;
4. keep `deploymentVersion` at `2.8.0` or remove it once the fallback produces the same value;
5. run the permanent Verify and Real Browser E2E gates;
6. let the existing release publisher verify production and create the GitHub release.

Never hand-edit dependency integrity or transitive dependency fields in `package-lock.json` merely to synchronize a version label.
