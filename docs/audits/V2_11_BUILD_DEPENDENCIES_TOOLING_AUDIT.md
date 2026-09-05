# v2.11G — Build, Dependencies, Tests & Tooling Audit

**Status:** Closeout candidate — exact-head browser/deployment gate pending  
**Stack base:** Audit F exact-green head `ce78ca875255ee282e5b5384ebfd78d09ce9a4bd`  
**Scope:** Runtime/lockfiles, build/deployment stamping, preview/publisher ownership, dependency maintenance, deterministic tests, CI cost, and release-era tooling

## Audit question

Does the mature build/test/tooling layer contain obsolete executable policy, duplicated verification cost, unsafe dependency maintenance, or build/publisher ownership drift that justifies targeted cleanup?

Audit G does not assume a bundler, framework migration, dependency upgrade, or test deletion. Historical names are not sufficient deletion evidence; executable behavior and current consumers are traced first.

## Current ownership baseline

- Root runtime policy is Node 22.x with `npm@10.9.8`; root and E2E lockfiles are checked by `tools/check-runtime-lockfiles.mjs`.
- Production build remains a no-bundler copy/index/stamp pipeline: `build.mjs` copies `src/`, stamps local asset versions, vendors pinned EPUB.js/JSZip browser artifacts, optionally indexes local EPUBs, and writes generated catalog data. `write-source.mjs` owns source/deployment metadata; `lib/build-context.mjs` owns version/commit/branch/build-time resolution.
- `npm run build` intentionally retains `prebuild -> npm run check` for local, E2E, Cloudflare, and other callers that have not already proved repository contracts. `build:dist` is the post-check build primitive.
- `preview.mjs` is a bounded static `dist/` server used directly by Playwright's `webServer`; no development bundler/runtime is required.
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

The first green Audit G Verify run executed **47/47 service tests**, up from the prior 43-test service gate, including all four migrated policy regressions. M9 signed-media/opaque-ID/human-session behavior remains owned by `check:security` plus current service/E2E coverage rather than a frozen final-audit script.

## G-003 — Duplicate CI verification cost

The pre-change Verify workflow explicitly ran `npm run check`, then later ran `npm run build`; the `prebuild` hook ran the same `npm run check` a second time. On the Audit F closeout Verify run, the first repository check consumed roughly 3.9 seconds and the repeated prebuild check roughly 4.1 seconds, while the actual post-check build/stamp work completed in well under one second.

Baseline Health had the same repeated-check shape and also ran `npm run performance:sanity` explicitly even though that exact command is already the final owner inside `npm run check`.

**Decision:** ⚡ In workflows that already ran the authoritative repository check, invoke `npm run build:dist` instead of `npm run build`. Remove the duplicate Baseline Health performance step. Keep `npm run build` and its `prebuild` safety contract unchanged for local, E2E, Cloudflare, and other callers that rely on build to self-validate.

**Measured result:** on green Audit G candidate `e7184ddd51ecd73b49e098c4c1e564eb0317b801`, the single repository check completed in about **4.43 s** and the post-check `build:dist` work completed in about **0.34 s**. The former second ~4.1 s prebuild repository check is gone, removing roughly four seconds of deterministic duplicate work from normal Verify without dropping a gate. Baseline Health similarly removes one exact duplicate performance invocation and one repeated prebuild check.

The baseline-maintenance policy guard was updated with the workflow so it now requires `npm run check` to own `performance-sanity` and requires Baseline Health to use the post-check `build:dist` primitive; it no longer requires duplicated execution.

## G-004 — Dependency and runtime ownership

The current dependency policy is intentionally conservative: direct dependencies are allow-listed, automated PRs are review-only, audit reporting is non-mutating, workflow actions are commit-SHA pinned, and runtime/lockfile checks cover both root and E2E workspaces.

`tools/check-epub-lifecycle-vendor.mjs` remains required: Audit B carries a narrowly scoped lifecycle compatibility patch against EPUB.js 0.3.93, so the build must fail if the installed package revision no longer matches the reviewed compatibility contract.

**Decision:** ⏭ No dependency auto-upgrade, package-manager change, lockfile consolidation, or EPUB.js guard removal from current evidence. Review dependency updates individually through the existing maintenance path.

## G-005 — Build / preview / publisher architecture

Current build ownership is small and explicit. There is no demonstrated module-resolution, asset-graph, build-duration, or deployment problem that a bundler would solve. Preview is a static server over the production `dist/` output, and the publisher already gates exact-main Verify, real-browser E2E, Cloudflare production metadata, smoke, and release creation.

**Decision:** ⏭ Keep the no-bundler architecture, build-context/stamping split, preview owner, and release publisher. Do not add a framework/bundler or a second publishing path without new evidence.

## G-006 — Remaining standalone operational/check tooling

Every surviving standalone tool reviewed in Audit G now has an explicit current owner:

- `tools/preview.mjs` — **retain**; Playwright directly launches it as the production `dist/` server for every real-browser project.
- `tools/dependency-audit-report.mjs` — **retain**; the scheduled/manual production dependency-audit workflow invokes it and its classification behavior has deterministic unit coverage.
- `tools/audit-css-ownership.mjs` — **retain**; Audit F made it a normal Verify measurement/ownership gate, with unused custom properties failing hard and heuristic selector findings remaining report-only.
- `tools/b2-setup.mjs` and `tools/b2-upload.mjs` — **retain as local operational tools**. The active build/deployment architecture explicitly assigns them ownership of local private-B2 connectivity/bootstrap upload work; they are the current `@aws-sdk/client-s3`/XML-parser tooling consumers and are not a second production browser or Pages Function storage path.
- `tools/check-flavor.mjs` — **retain and activate**. It reads current public/Reader/Keeper assets and verifies the live shared site-voice layer, including explicit destructive-warning consequences and current wiring. Because it was valid but previously reachable only through a manual package script, Audit G adds it to normal `npm run check` instead of leaving a current contract orphaned.
- `tools/check-epub-lifecycle-vendor.mjs` — **retain**; it is the build-time guard for the reviewed EPUB.js 0.3.93 compatibility patch accepted in Audit B.

No surviving tool in this reviewed set is retained merely because it existed historically.

## Documentation handoff to Audit H

Audit G also exposed documentation drift that is not executable-tooling ownership: for example, `docs/architecture/BUILD_DEPLOYMENT.md` still describes v2.8/v2.6-era version state and says retired R9/v2.6 checker executables are current guardrails. The executable policy has been corrected here; refreshing historical/current documentation claims belongs to **v2.11H — Documentation & repository hygiene** rather than widening Audit G into a documentation rewrite.

## Audit G disposition

The build/test/tooling audit found **obsolete executable policy, a normal-CI coverage orphan, and measurable duplicate verification cost**, not evidence for a new build system.

Accepted changes are bounded to:

- retire seven self-invalid/stale standalone release-era checkers behind a permanent absence guard;
- preserve useful M5–M8 behavior as four active service regressions;
- activate the still-current site-voice/destructive-warning checker in normal repository checks;
- remove duplicate Verify/Baseline check/performance execution while preserving authoritative owners;
- keep the current runtime, two-lockfile model, no-bundler build, deterministic test layers, dependency maintenance, static preview, B2 local tools, EPUB compatibility guard, Cloudflare deployment, and exact-main release publisher.

No framework/bundler migration, package-manager change, dependency auto-update, broad test deletion, or second publisher is justified.

## Remaining gate

Before Audit G is marked complete, the final branch head must pass:

- Verify, including the new service regressions, active flavor check, retired-tool guard, production build, and measured single-check workflow;
- Cloudflare Pages preview for that exact head;
- Chromium desktop/mobile, Firefox desktop, and WebKit desktop/mobile on that exact head.

Once those exact-head gates are green, PR #229 can be recorded as the Audit G closeout while remaining draft/stacked on Audit F; Audit H is next.
