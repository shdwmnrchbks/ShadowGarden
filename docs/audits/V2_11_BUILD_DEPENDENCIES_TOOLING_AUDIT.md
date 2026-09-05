# v2.11G — Build, Dependencies, Tests & Tooling Audit

**Status:** In progress — first implementation slice under verification  
**Stack base:** Audit F exact-green head `ce78ca875255ee282e5b5384ebfd78d09ce9a4bd`  
**Scope:** Runtime/lockfiles, build/deployment stamping, preview/publisher ownership, dependency maintenance, deterministic tests, CI cost, and release-era tooling

## Audit question

Does the mature build/test/tooling layer contain obsolete executable policy, duplicated verification cost, unsafe dependency maintenance, or build/publisher ownership drift that justifies targeted cleanup?

Audit G does not assume a bundler, framework migration, dependency upgrade, or test deletion. Historical names are not sufficient deletion evidence; executable behavior and current consumers are traced first.

## Current ownership baseline

- Root runtime policy is Node 22.x with `npm@10.9.8`; root and E2E lockfiles are checked by `tools/check-runtime-lockfiles.mjs`.
- Production build remains a no-bundler copy/index/stamp pipeline: `build.mjs` copies `src/`, stamps local asset versions, vendors pinned EPUB.js/JSZip browser artifacts, optionally indexes local EPUBs, and writes generated catalog data. `write-source.mjs` owns source/deployment metadata; `lib/build-context.mjs` owns version/commit/branch/build-time resolution.
- `npm run build` intentionally retains `prebuild -> npm run check` for local, E2E, and release callers that have not already proved repository contracts. `build:dist` is the post-check build primitive.
- `preview.mjs` is a bounded static `dist/` server used by real-browser testing; no development bundler/runtime is required.
- `release-v2.yml` is the reusable publisher owner. It only acts after successful Verify on `main`, requires matching exact-main Real Browser E2E, waits for matching Cloudflare production version/commit metadata, smoke-tests public production surfaces, then creates the GitHub release.
- Dependency maintenance is review-driven: five direct production dependencies are allow-listed, Dependabot is scheduled, workflow actions are SHA-pinned, production `npm audit` runs separately, and no `npm audit fix`/dependency auto-merge path is allowed.
- `run-tests.mjs` discovers every `*.test.mjs` in the unit/service/dom/browser layers and runs each layer deterministically with concurrency 1. Historical test filenames remain active inputs and are not cleanup candidates by age alone.

## G-001 — Release-era standalone executables

**Evidence:** M5–M9 and v2.6 standalone checkers encode frozen milestone/release policy rather than current verification ownership.

Concrete self-invalid examples:

- `check-m8.mjs` requires `package.json#scripts.check` to contain `check-m8.mjs`; current modern Verify intentionally does not.
- `check-m9.mjs` reads the already-retired `src/assets/js/reading-status.js` compatibility facade and freezes older Reader implementation details.
- `check-v2-6.mjs` requires the root package version to equal `2.6.7`, requires docs to describe v2.8 as the active release, and pins old implementation text/shape across many product surfaces.
- `check-reading-status.mjs` also requires the retired `reading-status.js` facade.

**Decision:** 🧹 Retire `check-m5.mjs` through `check-m9.mjs`, `check-v2-6.mjs`, and `check-reading-status.mjs`; remove their package-script entrypoints; guard their absence with `check-retired-release-tools.mjs` in normal `npm run check`.

The historical security/release documentation remains. Only obsolete executable policy is removed.

## G-002 — Preserve live security behavior in the active test owner

M5–M8 contained useful pure behavioral checks mixed together with stale wiring/docs assertions. Deleting the wrappers must not discard those contracts.

**Decision:** 🧹 Move the live behavior into `tests/service/security-policy-regressions.test.mjs`, covering:

- 20-book / 10-minute signed acquisition throttling, repeat-book behavior, expiry recovery, and tamper rejection;
- crawler/script-client classification on protected acquisition endpoints;
- one-hour Keeper signed sessions and server-side network-scoped cooldown behavior;
- abuse tripwire scoring, persistent cooldown, raw-IP non-retention, manual release, and significant admin-cooldown telemetry.

These tests are now owned by `test:service`, which Audit E already placed in normal pull-request Verify and which `npm test` also discovers for Baseline Health.

M9 signed-media/opaque-ID/human-session behavior remains owned by `check:security` plus current service/E2E coverage rather than a frozen final-audit script.

## G-003 — Duplicate CI verification cost

The pre-change Verify workflow explicitly ran `npm run check`, then later ran `npm run build`; the `prebuild` hook ran the same `npm run check` a second time. On the Audit F closeout Verify run, the first repository check consumed roughly 3.9 seconds and the repeated prebuild check roughly 4.1 seconds, while the actual post-check build/stamp work completed in well under one second.

Baseline Health had the same repeated-check shape and also ran `npm run performance:sanity` explicitly even though that exact command is already the final owner inside `npm run check`.

**Decision:** ⚡ In workflows that already ran the authoritative repository check, invoke `npm run build:dist` instead of `npm run build`. Remove the duplicate Baseline Health performance step. Keep `npm run build` and its `prebuild` safety contract unchanged for local, E2E, and other callers that rely on build to self-validate.

Final before/after CI timing will be recorded from the exact Audit G head.

## G-004 — Dependency and runtime ownership

The current dependency policy is intentionally conservative: direct dependencies are allow-listed, automated PRs are review-only, audit reporting is non-mutating, workflow actions are commit-SHA pinned, and runtime/lockfile checks cover both root and E2E workspaces.

`tools/check-epub-lifecycle-vendor.mjs` remains required: Audit B carries a narrowly scoped lifecycle compatibility patch against EPUB.js 0.3.93, so the build must fail if the installed package revision no longer matches the reviewed compatibility contract.

**Decision:** ⏭ No dependency auto-upgrade, package-manager change, lockfile consolidation, or EPUB.js guard removal from current evidence. Review dependency updates individually through the existing maintenance path.

## G-005 — Build / preview / publisher architecture

Current build ownership is small and explicit. There is no demonstrated module-resolution, asset-graph, build-duration, or deployment problem that a bundler would solve. Preview is a static server over the production `dist/` output, and the publisher already gates exact-main Verify, real-browser E2E, Cloudflare production metadata, smoke, and release creation.

**Decision:** ⏭ Keep the no-bundler architecture, build-context/stamping split, preview owner, and release publisher. Do not add a framework/bundler or a second publishing path without new evidence.

## Remaining gate

Before Audit G closes:

- exact branch head must pass Verify, including the new service regressions and retired-tool guard;
- exact branch head must pass the complete Chromium desktop/mobile, Firefox desktop, and WebKit desktop/mobile matrix;
- Cloudflare preview must deploy the exact head;
- Verify timing must demonstrate that the duplicate prebuild check was actually removed;
- remaining current standalone operational tools (`b2:setup`, `b2:upload`, preview, dependency reporter, CSS audit, and site-voice check) must have explicit retain/retire dispositions.
