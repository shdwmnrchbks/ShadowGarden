# Shadow Garden Versioning Contract

**Status:** Active contract  
**Active deployment/product version:** v2.11.0 — Engineering Audit, Refactor & Optimization  
**Formal release source version:** v2.10.0  
**Current engineering phase:** v2.11 audit-first cleanup; refactor and optimization remain evidence-gated

Shadow Garden intentionally separates the version shown by an active development deployment from the version eligible for a formal GitHub release, while requiring those version owners to converge at a formal release cut.

## Two version owners

`package.json` contains two distinct fields:

- `version` — the latest **formal release** version. It remains synchronized with `package-lock.json`, the newest formal changelog section, and `docs/releases/v${VERSION}.md`. `.github/workflows/release-v2.yml` uses this value for GitHub release publication.
- `deploymentVersion` — the **active deployed product line**. Build context, generated asset cache stamping, `/data/version.json`, the public Library footer, and Garden Keeper version presentation use this value.

The v2.11 audit cycle deliberately uses:

```json
{
  "version": "2.10.0",
  "deploymentVersion": "2.11.0"
}
```

This does **not** make v2.11.0 a formal release. It means current development/deployment work belongs to the v2.11 engineering cycle while the last verified GitHub release remains v2.10.0.

## v2.11 audit rule

v2.11 is an audit-first engineering-health cycle, not a quota for refactoring. Every implementation must come from recorded evidence such as duplicate ownership, dead/compatibility code, correctness risk, maintainability cost, a verification gap, or a reproducible realistic-scale bottleneck.

Valid outcomes include:

- no change needed / skipped;
- cleanup or deletion;
- targeted refactor;
- measured optimization;
- deferred because benefit does not justify risk or cost.

The first v2.11 shipped cleanup restores the existing R10 build contract: authored Reader imports must not carry hand-maintained local `?v=` cache history. Build-time deployment stamping remains the sole local asset cache-version owner.

## Deployment metadata

`tools/lib/build-context.mjs` owns deployment identity. It resolves:

1. `releaseVersion` from `package.json#version`;
2. deployed `version` from `package.json#deploymentVersion`, falling back to `version` only when no deployment override exists;
3. commit, branch, and deterministic build timestamp from established build-context sources.

`tools/build.mjs` uses the deployed version for generated local asset cache-busting. `tools/write-source.mjs` writes the same build context to `dist/data/version.json`.

Public version consumers read `/data/version.json`; authored public/Reader/Keeper source must not hard-code the active product version.

## Formal release contract

A formal v2 release still requires deliberate convergence of the release-owned metadata plus the established network-backed gates:

- `package.json#version` and root/workspace `package-lock.json` version metadata;
- matching newest changelog release section;
- matching `docs/releases/v${VERSION}.md`;
- successful Verify for the exact final `main` commit;
- successful complete Real Browser E2E for the same commit;
- matching Cloudflare production version and commit;
- successful production smoke checks.

`deploymentVersion` alone never creates or retargets a GitHub release. The publisher remains idempotent when the formal release tag already exists.

## v2.10 release baseline

v2.10.0 remains the latest formal release. Its release tag stays pinned to the verified v2.10 release commit even when post-release maintenance and v2.11 development advance `main`.

## v2.11 release decision

Do not cut v2.11.0 merely because the audit exists. A formal v2.11.0 release is appropriate only after the accepted audit/refactor/optimization scope is complete, exact-main gates are green, documentation describes the final state, and formal release metadata deliberately converges from 2.10.0 to 2.11.0.

If the audit ultimately finds no further refactor or optimization is needed, that is a successful engineering outcome; only already-shipped accepted v2.11 changes need to be represented in the eventual release decision.
