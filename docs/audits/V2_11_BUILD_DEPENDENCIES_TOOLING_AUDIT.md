# v2.11G — Build, Dependencies, Tests & Tooling Audit

**Status:** ✅ Complete  
**Exact-green head:** `974fb1d8212ed4afc713da0ed340e22a58f1adff`  
**Stack base:** Audit F exact-green head `ce78ca875255ee282e5b5384ebfd78d09ce9a4bd`  
**Scope:** Runtime/lockfiles, native build/deployment stamping, preview/publisher ownership, dependency maintenance, deterministic tests, CI cost, and release-era tooling

Audit G found **obsolete executable policy, one normal-CI coverage orphan, and measurable duplicate verification cost**. It did not find evidence for a new build system, package-manager migration, broad test deletion, dependency auto-update policy, or second publisher.

## G-001 — Retire stale release-era executable policy

M5–M9, `check-v2-6.mjs`, and `check-reading-status.mjs` mixed historical source/wiring assertions with current behavior. Several had become self-invalid: they required deleted compatibility files, old package versions, old roadmap state, or their own presence in a verification chain that had intentionally moved on.

**Decision:** retire the seven stale standalone executables and their package entrypoints; keep historical documentation intact; enforce their absence with `tools/check-retired-release-tools.mjs` in normal `npm run check`.

## G-002 — Preserve useful security behavior

M5–M8 contained behavior worth retaining independently from the stale wrappers. Their live contracts moved into `tests/service/security-policy-regressions.test.mjs`:

- signed 20-book / 10-minute acquisition throttling, repeat-book behavior, expiry recovery, tamper rejection;
- crawler/script-client classification for protected acquisition endpoints;
- one-hour Keeper signed sessions plus server-side network-scoped cooldown behavior;
- abuse scoring/cooldown, raw-IP non-retention, manual release, and significant admin-cooldown telemetry.

The normal service gate increased from 43 to **47 tests**. M9 signed-media/opaque-ID/human-session behavior remains owned by `check:security` plus current service/E2E coverage.

## G-003 — Remove duplicate CI cost without removing a gate

Before Audit G, Verify ran `npm run check` explicitly and then `npm run build`; the `prebuild` hook repeated the same repository check. Baseline Health had the same repeated-check shape and separately invoked `performance:sanity` even though `npm run check` already owns it.

**Decision:** workflows that already passed the repository check use `npm run build:dist`; Baseline Health no longer invokes the duplicate performance command. `npm run build` intentionally keeps `prebuild -> npm run check` for local, E2E, Cloudflare, and other callers that have not already proved repository contracts.

**Measured result:** the green G candidate measured roughly **4.43 s** for the one repository check and **0.34 s** for post-check build work, eliminating roughly four seconds of duplicate deterministic Verify work without weakening coverage.

## G-004 — Retain runtime/dependency/build ownership

Retained:

- Node 22.x with reviewed CI patch and `npm@10.9.8`;
- root and isolated E2E lockfiles;
- five direct root dependencies with explicit current consumers;
- review-only Dependabot and non-mutating production dependency audit reporting;
- no-bundler copy/index/stamp build;
- deterministic build-context/source/version metadata owners;
- dependency-free static `dist/` preview;
- `tools/check-epub-lifecycle-vendor.mjs` for the reviewed EPUB.js 0.3.93 lifecycle compatibility boundary;
- local B2 setup/upload tools;
- existing exact-main release publisher.

No dependency auto-fix/auto-merge, package-manager change, lockfile consolidation, bundler/framework migration, or second publishing path is justified.

## G-005 — Retain current deterministic tests and activate the current orphan guard

`tools/run-tests.mjs` actively discovers every `*.test.mjs` under unit/service/DOM/browser layers, so historical filenames are not deletion evidence. The current site-voice/destructive-warning checker was valid but only manually reachable; Audit G added `tools/check-flavor.mjs` to normal repository checks.

## Exact-head verification

Exact head `974fb1d8212ed4afc713da0ed340e22a58f1adff` passed:

- ✅ Verify, including retired-tool guard, current flavor guard, 47/47 service tests, targeted Reader/Library regressions, and production build;
- ✅ Cloudflare Pages preview deployment;
- ✅ Chromium desktop;
- ✅ Chromium mobile;
- ✅ Firefox desktop;
- ✅ WebKit desktop;
- ✅ WebKit mobile.

## Disposition

Audit G keeps the mature build/test/dependency architecture and removes only demonstrated stale policy and duplicate cost. Documentation drift exposed during this audit is reconciled by Audit H; this file now records the final G state rather than the pre-closeout candidate state.
