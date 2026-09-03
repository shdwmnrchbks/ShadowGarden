# Shadow Garden Maintenance Baseline

**Status:** Active v2.10 maintenance contract  
**Scope:** scheduled health checks for the current production baseline without introducing automatic product changes or destructive production recovery.

Shadow Garden v2.10 treats recurring verification as operational evidence, not as an authority to mutate dependencies, catalogs, storage, authentication, or release state. The scheduled baseline reuses the same deterministic owners and real-browser suites already used by normal development and release gates.

## Monthly deterministic baseline

`.github/workflows/baseline-health.yml` runs on manual dispatch and on the first day of each month at **09:00 Asia/Manila** (`01:00 UTC`). It uses the reviewed Node 22.23.2 runtime and the committed root lockfile through `npm ci`, then runs:

- `npm run check` for repository, dependency-maintenance, runtime/lockfile, documentation, release-metadata, baseline-maintenance, and realistic-scale contracts;
- `npm run check:security` for deterministic security invariants;
- `npm test` for every unit, service, DOM, and browser-contract layer, including the catalog recovery drill/readiness/anchor/purge coverage;
- `npm run performance:sanity` for the expected-scale Library tripwire;
- `npm run build` to prove the verified baseline still produces the deployment artifact.

The workflow is deliberately schedule/manual-only. Pull-request and `main` push verification remain owned by the normal Verify and Real Browser E2E workflows.

## Monthly real-browser and accessibility baseline

`.github/workflows/e2e.yml` remains the permanent pull-request and exact-`main` browser gate and also supports manual dispatch plus a monthly rerun on the first day of each month at **10:00 Asia/Manila** (`02:00 UTC`). The monthly run uses the same complete five-project matrix:

- Chromium desktop;
- Firefox desktop;
- WebKit desktop;
- Chromium Mobile;
- WebKit Mobile.

Because the workflow runs the complete Playwright suite rather than a filtered maintenance subset, the scheduled baseline also reruns the existing accessibility, Reader, Library, Garden Keeper, recovery-readiness, mobile, and EPUB regression coverage. Failure artifacts remain retained by the established E2E workflow.

## Realistic-scale performance sanity

`tools/performance-sanity.mjs` creates a deterministic **300-series synthetic catalog**, matching the upper end of the roadmap's expected 250–300-series range without committing real library metadata. It exercises the real `library-model` filtering, sorting, search, and contextual-filter computations.

The check uses a deliberately broad **5-second severe-regression ceiling**. This is a CI tripwire for obvious pathological regressions, not a microbenchmark, latency SLO, or justification for virtualization/framework work. Normal CI also executes the sanity check so the fixture and runner cannot silently rot between monthly baselines.

## Safety boundaries

Scheduled maintenance checks must remain read-only with respect to production state. They may use deterministic/local fixtures, mocked B2 behavior, generated EPUB fixtures, and the existing browser test harness, but they must not perform destructive production recovery, purge live storage, auto-fix dependencies, or auto-merge maintenance changes.

A failed scheduled run is visible maintenance evidence that requires review. It does not grant automation permission to change dependencies, security policy, catalogs, release metadata, or production infrastructure.
