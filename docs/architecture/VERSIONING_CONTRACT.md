# Shadow Garden Versioning Contract

**Status:** Active contract  
**Active deployment/product version:** v2.11.0 — Engineering Audit, Refactor & Optimization  
**Formal release source version:** v2.11.0  
**Current engineering phase:** v2.11 audits A–H assembled and exact-main verified; formal v2.11.0 release candidate converged

Shadow Garden intentionally separates the version shown by an active development deployment from the version eligible for a formal GitHub release, while requiring those version owners to converge at a formal release cut.

## Two version owners

`package.json` contains two distinct fields:

- `version` — the **formal release source** version. It remains synchronized with `package-lock.json`, the newest formal changelog section, and `docs/releases/v${VERSION}.md`. `.github/workflows/release-v2.yml` uses this value for GitHub release publication.
- `deploymentVersion` — the **active deployed product line**. Build context, generated asset cache stamping, `/data/version.json`, the public Library footer, and Garden Keeper version presentation use this value.

At the v2.11.0 formal release cut the owners converge:

```json
{
  "version": "2.11.0",
  "deploymentVersion": "2.11.0"
}
```

Metadata convergence makes the exact `main` commit eligible for the verified v2 publisher; it does not by itself prove that the GitHub release has been published. Publication remains gated by exact-main Verify, the matching five-project Real Browser E2E run, matching Cloudflare production version/commit metadata, and production smoke.

## Evidence-gated v2.11 result

v2.11 was an audit-first engineering-health cycle, not a quota for refactoring. Audits A–H found a bounded set of dead/compatibility ownership, Reader lifecycle defects, repeated Library state work, duplicate Keeper requests, one Functions least-privilege defect, stale CSS, obsolete tooling/duplicate CI work, and current-document drift. Stable architecture was retained where measurements did not justify change.

Accepted outcomes include cleanup, targeted refactor, measured optimization, and explicit no-change decisions. The consolidated record is [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md), and formal release notes are [`../releases/v2.11.0.md`](../releases/v2.11.0.md).

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

v2.10.0 is the immediately preceding formal release. Its release tag remains pinned to the verified v2.10 release commit and its release record stays historical evidence.

## v2.11 release convergence

Audits A–H were assembled onto `main` through PR #231 and the resulting mainline commit `cdbc57384a01e8c83dc13ff5fc1df6753fe93f97` independently passed Verify, Cloudflare Pages, Chromium desktop/mobile, Firefox desktop, and WebKit desktop/mobile before the release cut.

The release candidate now deliberately converges `package.json#version`, root lockfile version metadata, the changelog, and `docs/releases/v2.11.0.md`. After this candidate lands on `main`, the existing publisher must re-prove the exact release commit through Verify, matching main-push Real Browser E2E, matching Cloudflare v2.11.0 version/commit metadata, and production smoke before it creates the GitHub `v2.11.0` release.
