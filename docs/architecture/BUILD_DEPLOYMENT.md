# Shadow Garden Build & Deployment Layer

**Status:** Active contract after v2.11G  
**Active deployment/product version:** v2.11.0 — Engineering Audit, Refactor & Optimization  
**Latest formal release:** v2.10.0 — Maintenance & Supply Chain  
**Runtime/package manager:** Node 22.x · npm 10.9.8

Audit G revalidated the existing native build/deployment model and found obsolete executable policy plus duplicate CI cost—not a need for a new build system.

See [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) for deployment/formal release semantics and [`../audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md`](../audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md) for measurements.

## Build model

```text
committed src/ + tools/ + locked dependencies + build context
                              |
                              v
                    tools/build.mjs
                              |
                              v
                            dist/
                              |
                              v
                  tools/write-source.mjs
```

`dist/` is generated/ignored. EPUB.js and JSZip are copied from the locked dependency tree into browser vendor assets. No application module depends on hand-edited output.

## Deliberate no-bundler decision

Public UI and Reader already use explicit native modules/runtime composition; Pages Functions deploy as modules; centralized build-time asset stamping solves local cache versioning; and Audit G found no measured build/runtime bottleneck that justifies another transformation layer. A bundler/framework remains evidence-gated, not roadmap debt.

## Dependency and lockfile ownership

Root production/tooling dependencies have explicit owners: local B2 tools, Functions storage signing, Reader EPUB.js, EPUB XML parsing, and ZIP parsing/vendor runtime. The isolated E2E workspace owns pinned Playwright separately.

Root and E2E lockfiles remain committed. `tools/check-runtime-lockfiles.mjs` validates the runtime/package-manager/lockfile policy. Dependency updates are reviewed, lockfile-synchronized changes; scheduled production audit reporting is non-mutating.

## Deterministic build context

`tools/lib/build-context.mjs` is the single owner for:

- active deployed `version` from `deploymentVersion` with formal-version fallback;
- formal `releaseVersion`;
- commit and branch from Cloudflare/GitHub metadata with Git fallback;
- deterministic build timestamp from `SOURCE_DATE_EPOCH` or commit metadata before wall-clock fallback.

`tools/build.mjs` and `tools/write-source.mjs` consume the same context. `dist/data/version.json` therefore exposes active version, formal release version, commit/short commit, branch, and build time from one owner.

## Build commands and single-check ownership

`npm run build` remains self-validating through `prebuild -> npm run check`. This is intentional for local use, Cloudflare, E2E setup, and other callers that have not already proved repository contracts.

`npm run build:dist` is the **post-check production-build primitive**. Workflows that already ran the authoritative repository check use `npm run build:dist` so they do not pay for an identical second check.

Audit G measured the green candidate at roughly 4.43 s for the single repository check and 0.34 s for the post-check build, removing roughly four seconds of duplicate deterministic work from normal Verify without dropping a gate.

## Current CI ownership

### Verify Shadow Garden

`.github/workflows/verify.yml` owns per-change deterministic acceptance:

- one `npm run check` repository/policy/performance gate;
- CSS ownership measurement;
- dedicated Functions security contracts;
- complete service regressions (47 tests at Audit G closeout);
- targeted Reader lifecycle and Library audit regressions;
- `npm run build:dist` after the check has already passed.

### Real Browser E2E

`.github/workflows/e2e.yml` builds production output and runs Chromium desktop/mobile, Firefox desktop, and WebKit desktop/mobile. Failure artifacts remain retained. The real-browser workflow also serves as the scheduled browser/accessibility baseline.

### Baseline Health

`.github/workflows/baseline-health.yml` is monthly/manual and intentionally reuses current owners:

- `npm run check` (which already includes realistic-scale performance sanity);
- `npm run check:security`;
- full `npm test` deterministic layers;
- `npm run build:dist` after the repository check.

There is no second standalone performance invocation and no repeated prebuild repository check.

### Dependency Audit

`.github/workflows/dependency-audit.yml` verifies runtime/lockfiles, installs production dependencies read-only, collects `npm audit --omit=dev --json`, and classifies findings with the retained report tool. It never runs an automatic audit fix.

## Local preview

`tools/preview.mjs` is the dependency-free production preview owner. It serves generated `dist/`, supports GET/HEAD, applies explicit MIME/no-store behavior, rejects paths outside `dist/`, and is used directly by Playwright's web server.

## EPUB.js lifecycle vendor guard

Audit B accepted a narrow compatibility patch around EPUB.js 0.3.93 manager/rendition lifecycle behavior. `tools/check-epub-lifecycle-vendor.mjs` remains a build-time safety guard unless a reviewed dependency update proves the patch obsolete and replaces its regression coverage.

## Cloudflare Pages and formal release publisher

Cloudflare builds the native `dist/` output and deployment metadata. The private B2/media/security architecture is unchanged by the build system.

`.github/workflows/release-v2.yml` is the one formal v2 publisher. For the exact `main` commit it requires:

1. successful Verify;
2. successful matching Real Browser E2E;
3. matching Cloudflare production version + commit;
4. successful Main/Adult/Series/Reader/robots smoke;
5. matching formal release notes before GitHub tag/release creation.

`package.json#version` remains the formal release source. `deploymentVersion` identifies the active deployed line but never independently creates a release.

## Audit G decision

Retain Node 22/npm 10.9.8, two committed lockfiles, the native no-bundler build, deterministic build metadata, static preview, review-driven dependency policy, current deterministic tests, EPUB.js lifecycle guard, Cloudflare deployment, and the existing publisher. The accepted optimization is removal of duplicate verification execution—not a replacement build architecture.
