# Shadow Garden Versioning Contract

**Status:** Active contract  
**Active deployment/product version:** v2.8.0 — Reader Experience  
**Formal release source version:** v2.8.0

Shadow Garden intentionally separates the version shown by a live development deployment from the version eligible for a formal GitHub release.

## Two version owners

`package.json` contains two distinct fields:

- `version` — the latest **formal release** version. This remains synchronized with `package-lock.json` and is the version consumed by `.github/workflows/release-v2.yml`.
- `deploymentVersion` — the **active deployed product line**. This is the version exposed by generated deployment metadata and shown by the public Library and Garden Keeper.

During an in-progress milestone, these values may intentionally differ. At the v2.8.0 release cut they converge:

```json
{
  "version": "2.8.0",
  "deploymentVersion": "2.8.0"
}
```

The release commit therefore identifies both the formal release and the deployed product line as v2.8.0. A later milestone may advance `deploymentVersion` again while `version` remains on the latest completed formal release.

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

## v2.8.0 release state

The v2.8.0 release commit aligns `package.json#version`, `package-lock.json`, and `deploymentVersion` at `2.8.0`, includes `docs/releases/v2.8.0.md` plus the matching changelog entry, and records the completed Reader Experience acceptance criteria. The permanent Verify and Real Browser E2E gates remain authoritative. After merge, the existing publisher must still match the exact production deployment version/commit and pass public production smoke checks before creating the GitHub release.

Future development may advance `deploymentVersion` for the next active milestone while `version` remains on the latest completed formal release. Never hand-edit dependency integrity or transitive dependency fields in `package-lock.json` merely to synchronize a version label.
