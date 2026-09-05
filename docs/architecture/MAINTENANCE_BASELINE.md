# Shadow Garden Maintenance Baseline

**Status:** Active maintenance contract after v2.11G  
**Scope:** recurring health evidence without automatic product/dependency/catalog/security/release mutation

Scheduled maintenance reuses the same owners as normal development. It does not gain special authority to fix dependencies, mutate production storage, perform destructive recovery, or publish releases.

## Monthly deterministic baseline

`.github/workflows/baseline-health.yml` runs manually or on the first day of each month at **09:00 Asia/Manila** (`01:00 UTC`). It uses the reviewed Node 22 toolchain and root lockfile, then runs:

- `npm run check` — repository/dependency/runtime/docs/release/baseline/cache/retired-owner/reachability plus realistic-scale performance sanity;
- `npm run check:security` — deterministic signed-media/auth/security invariants;
- `npm test` — every unit, service, DOM, and browser-contract test, including recovery and the 47-test service layer;
- `npm run build:dist` — production artifact generation after the repository check has already passed.

Audit G intentionally removed the old duplicate standalone performance invocation and the repeated prebuild repository check. `npm run check` remains the single performance-tripwire owner, and the post-check build primitive preserves artifact verification without paying for the same check twice.

## Monthly real-browser/accessibility baseline

`.github/workflows/e2e.yml` remains the pull-request and exact-main browser gate and also supports manual/monthly reruns. It executes the complete matrix:

- Chromium desktop;
- Firefox desktop;
- WebKit desktop;
- Chromium Mobile;
- WebKit Mobile.

The same complete suite reruns Library/Series, Reader, Garden Keeper, recovery-readiness, accessibility, motion, mobile, and EPUB regressions; failure artifacts follow the normal E2E retention policy.

## Realistic-scale performance sanity

`tools/performance-sanity.mjs` creates a deterministic 300-series synthetic catalog matching the upper end of the intended personal-library audit range. It exercises real Library model filtering/sorting/search/contextual-filter computations with a deliberately broad severe-regression ceiling.

This is a tripwire, not a latency SLO and not evidence by itself for virtualization/framework work. It runs through normal `npm run check`, so Baseline Health does not invoke it a second time.

## Safety boundaries

Scheduled runs may use deterministic/local fixtures, generated EPUBs, mocked storage/network behavior, and the existing browser harness. They must not perform destructive production recovery, purge live objects, auto-fix dependencies, auto-merge maintenance changes, rotate credentials, or alter release metadata.

A failed scheduled run is evidence requiring review; it grants no mutation authority.
