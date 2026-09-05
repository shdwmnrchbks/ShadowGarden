# Shadow Garden Versioning Contract

**Status:** Active contract  
**Active deployment/product version:** v2.11.0 — Engineering Audit, Refactor & Optimization  
**Formal release source version:** v2.10.0  
**Current engineering phase:** v2.11 audits A–H complete; stacked-branch assembly and final-main release convergence next

Shadow Garden intentionally separates the version shown by an active development deployment from the version eligible for a formal GitHub release, while requiring those version owners to converge at a formal release cut.

## Two version owners

`package.json` contains two distinct fields:

- `version` — the latest **formal release** version. It remains synchronized with `package-lock.json`, the newest formal changelog section, and `docs/releases/v${VERSION}.md`. `.github/workflows/release-v2.yml` uses this value for GitHub release publication.
- `deploymentVersion` — the **active deployed product line**. Build context, generated asset cache stamping, `/data/version.json`, the public Library footer, and Garden Keeper version presentation use this value.

Current audit-complete development state:

```json
{
  "version": "2.10.0",
  "deploymentVersion": "2.11.0"
}
```

This does **not** make v2.11.0 a formal release. It means the accepted audit work belongs to the v2.11 development/deployment line while the last verified GitHub release remains v2.10.0.

## Evidence-gated v2.11 result

v2.11 was an audit-first engineering-health cycle, not a quota for refactoring. Audits A–H found a bounded set of dead/compatibility ownership, Reader lifecycle defects, repeated Library state work, duplicate Keeper requests, one Functions least-privilege defect, stale CSS, obsolete tooling/duplicate CI work, and current-document drift. Stable architecture was retained where measurements did not justify change.

Accepted outcomes include cleanup, targeted refactor, measured optimization, and explicit no-change decisions. The consolidated record is [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md).

## Deployment metadata

`tools/lib/build-context.mjs` owns deployment identity:

1. `releaseVersion` from `package.json#version`;
2. deployed `version` from `package.json#deploymentVersion`, falling back to `version` only when no deployment override exists;
3. commit, branch, and deterministic build timestamp from established build-context sources.

`tools/build.mjs` uses the deployed version for generated local asset cache-busting. `tools/write-source.mjs` writes the same build context to `dist/data/version.json`. Public version consumers read that generated file; authored product source must not become another current-version owner.

## Formal release contract

A formal v2 release requires deliberate convergence of release-owned metadata plus established network-backed gates:

- `package.json#version` and root/workspace `package-lock.json` version metadata;
- matching newest changelog release section;
- matching `docs/releases/v${VERSION}.md`;
- successful Verify for the exact final `main` commit;
- successful complete Real Browser E2E for the same commit;
- matching Cloudflare production version and commit;
- successful production smoke checks.

`deploymentVersion` alone never creates or retargets a GitHub release. The publisher remains idempotent when the formal release tag already exists.

## v2.10 release baseline

v2.10.0 remains the latest formal release. Its release tag stays pinned to the verified v2.10 release commit even while post-release maintenance and v2.11 development advance `main`.

## v2.11 release convergence

Audit completion does not authorize an immediate release. First assemble the accepted A–H stack onto the intended final `main` state and re-run the exact-main gates. Then deliberately converge `package.json#version`, lockfile version metadata, changelog, and `docs/releases/v2.11.0.md`; confirm Cloudflare reports the matching v2.11.0 version/commit and production smoke passes. Only then may the existing publisher create the formal v2.11.0 release.
