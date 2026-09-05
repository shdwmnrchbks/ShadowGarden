# Shadow Garden Current Roadmap — v2.11 Engineering Audit, Refactor & Optimization

> **Status:** ✅ **v2.11A–H COMPLETE · FORMAL RELEASE CANDIDATE CONVERGED**  
> **Active release:** v2.11.0 — Engineering Audit, Refactor & Optimization  
> **Latest formal release:** v2.11.0 — Engineering Audit, Refactor & Optimization  
> **Assembled exact-main baseline:** `cdbc57384a01e8c83dc13ff5fc1df6753fe93f97`  
> **Audit G exact-green head:** `974fb1d8212ed4afc713da0ed340e22a58f1adff`  
> **Updated:** 2026-09-05

Shadow Garden has enough product features for the current operating horizon. v2.11 was an **audit-first engineering-health cycle**, not a feature expansion roadmap and not a pre-approved rewrite. Refactor or optimization was accepted only where evidence demonstrated a correctness, ownership, maintainability, verification, or realistic-scale performance problem.

A clean audit is a successful result.

## Governing constraints

- preserve private Backblaze B2, signed media, opaque identities, Garden Pass/Turnstile, signed Keeper sessions, abuse controls, Range delivery, and recovery invariants;
- keep Reader progress, bookmarks, Finished state, preferences, and history browser-local;
- preserve one owner per responsibility;
- use realistic personal-library fixtures around 250–300 series and representative large EPUBs before optimizing;
- do not add a framework/bundler, speculative virtualization, server-side Reader history, or broad architecture change without measured evidence;
- prefer deletion/simplification over new abstraction when both solve the demonstrated problem;
- keep `npm run check`, deterministic tests, production build, complete five-project real-browser E2E, deployment metadata, and production smoke authoritative.

---

# v2.11.0 — Engineering Audit, Refactor & Optimization

**Status:** ✅ Audit phase complete · stack assembled/reverified on `main` · formal release metadata converged  
**Formal release source:** `package.json#version` and `deploymentVersion` are both 2.11.0; publication remains gated by the exact release commit

## v2.11A — Repository & ownership inventory

**Status:** ✅ Complete

- production browser graph: **25 HTML script roots → all 85 authored browser scripts** after retiring the disconnected reading-state compatibility facade;
- Functions graph: **15 route roots → all 38 Functions sources**;
- retired obsolete R-series executable policy snapshots and forwarding-only R6 compatibility facades behind permanent absence guards;
- restored build-time local asset stamping as the only authored cache-version owner;
- retained deterministic tests because the active runner discovers them.

Evidence: [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md) and [`../audits/POST_V2_10_ENTRYPOINT_INVENTORY.md`](../audits/POST_V2_10_ENTRYPOINT_INVENTORY.md).

## v2.11B — Reader architecture & long-session reliability

**Status:** ✅ Complete

- fixed protected Page Map source ownership and superseded hidden-map cancellation/teardown;
- carried narrow EPUB.js 0.3.93 lifecycle cleanup and release of trimmed section caches;
- final repeated-flow drain: ~**+2.31 MiB heap / +702 Nodes / +4 Documents / +14 listeners**;
- sustained Continuous traversal: **0 retained Documents / +44 Nodes / 0 listeners / ~+0.68 MiB**, transient 18 views trimmed back to 5;
- first readable ~1.09–1.13 s; isolated 360-page map ~2.49 s; no long-task evidence justified architectural replacement.

Evidence: [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md).

## v2.11C — Library, Series & browser-local domain

**Status:** ✅ Complete

- retained catalog/domain/controller ownership; no virtualization/new persistence architecture;
- hydration localStorage reads **121,905 → 14,211 (−88.3%)** and measured interaction reads **314,387 → 11,645 (−96.3%)**;
- removed duplicate render/request ownership while keeping later ordinary catalog loads fresh.

Evidence: [`../audits/V2_11_LIBRARY_SERIES_AUDIT.md`](../audits/V2_11_LIBRARY_SERIES_AUDIT.md).

## v2.11D — Garden Keeper & operational workflows

**Status:** ✅ Complete

- retained existing workflow split and single AdminClient;
- reduced Maintenance/History/Trash startup from three identical Maintenance GETs to one canonical snapshot owner;
- reused already-materialized Library state for normal Upload duplicate preflight, removing the extra startup GET while preserving one safe fallback request.

Evidence: [`../audits/V2_11_KEEPER_AUDIT.md`](../audits/V2_11_KEEPER_AUDIT.md).

## v2.11E — Pages Functions, security & storage

**Status:** ✅ Complete

- GET/HEAD use read credentials; mutations require write credentials and never fall back;
- made nine unconsumed implementation-only service symbols private;
- retained three deliberate validation-policy seams with direct regression coverage;
- normal Verify owns complete security + service regressions; final retained service-export graph has **91 consumed exports**.

Evidence: [`../audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md`](../audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md).

## v2.11F — CSS, motion & accessibility

**Status:** ✅ Complete

- **36 authored stylesheets / 2,254 selectors / 0 literal unreferenced class candidates / 0 unused custom properties**;
- remaining specificity/`!important` pressure is concentrated in intentional late-loaded workflow/theme/layout layers;
- retained keyboard/focus, reduced-motion, forced-colors, increased-contrast, zoom/reflow, and labelled mobile-target behavioral gates;
- no broad stylesheet consolidation was justified.

Evidence: [`../audits/V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md`](../audits/V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md).

## v2.11G — Build, dependencies, tests & tooling

**Status:** ✅ Complete on exact-green head `974fb1d8212ed4afc713da0ed340e22a58f1adff`

- retired seven stale release-era standalone policy executables behind `check-retired-release-tools.mjs`;
- migrated useful M5–M8 behavior into active service regressions; service gate **47/47**;
- activated current site-voice/destructive-warning guard;
- removed duplicate Verify/Baseline execution by using `build:dist` only after the authoritative check passed;
- retained Node 22/npm 10.9.8, two lockfiles, no-bundler build, review-driven dependencies, static preview, EPUB lifecycle guard, B2 local tools, and existing publisher.

Measured Verify result: ~4.43 s repository check + ~0.34 s post-check build, removing roughly four seconds of duplicate deterministic work without dropping a gate.

Evidence: [`../audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md`](../audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md).

## v2.11H — Documentation & repository hygiene

**Status:** ✅ Complete

- reconciled authoritative current roadmap/findings/index/build/test/CSS/maintenance/dependency documents to accepted A–G ownership;
- kept release/archive/security milestone history historical rather than rewriting it as current state;
- expanded documentation freshness ownership to root/current architecture/current operations plus final Audit G closeout evidence;
- made package-manager freshness follow `package.json#packageManager` dynamically;
- fixed the stale Audit G “gate pending” evidence label after its exact head had already gone green;
- made no product/runtime/dependency/lockfile/security/storage/formal-version change.

Evidence: [`../audits/V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md`](../audits/V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md).

---

## Release convergence

Audits C–H were assembled onto the already-merged A/B history through PR #231. The resulting `main` commit `cdbc57384a01e8c83dc13ff5fc1df6753fe93f97` independently passed:

- Verify / repository + security + service + targeted Reader/Library regressions + production build;
- Cloudflare Pages deployment;
- Chromium desktop;
- Chromium mobile;
- Firefox desktop;
- WebKit desktop;
- WebKit mobile.

The formal v2.11.0 release candidate now converges `package.json#version`, root lockfile version metadata, the changelog, current release-status documentation, and [`../releases/v2.11.0.md`](../releases/v2.11.0.md). After the candidate lands on `main`, the existing publisher must re-run the exact release commit through Verify and complete Real Browser E2E, observe matching Cloudflare production version + commit, and pass production smoke before creating the GitHub `v2.11.0` release.
