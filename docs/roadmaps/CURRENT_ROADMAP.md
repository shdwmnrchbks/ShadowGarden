# Shadow Garden Current Roadmap — v2.11 Engineering Audit, Refactor & Optimization

> **Status:** ✅ **v2.11A–G COMPLETE · v2.11H IN PROGRESS**  
> **Active release:** v2.11.0 — Engineering Audit, Refactor & Optimization  
> **Latest formal release:** v2.10.0 — Maintenance & Supply Chain  
> **Execution baseline:** `c9403732983cb5fe96fb0914288dfc7e9ee2e83b`  
> **Audit G exact-green head:** `974fb1d8212ed4afc713da0ed340e22a58f1adff`  
> **Updated:** 2026-09-05

Shadow Garden has enough product features for the current operating horizon. v2.11 is an **audit-first engineering-health cycle**, not a feature expansion roadmap and not a pre-approved rewrite. Refactor or optimization is accepted only when evidence demonstrates a correctness, ownership, maintainability, verification, or realistic-scale performance problem.

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

**Status:** 🟨 Active development line  
**Formal release:** not cut; `package.json#version` remains 2.10.0 until release convergence

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
- carried the narrow EPUB.js 0.3.93 lifecycle compatibility cleanup and release of trimmed section caches;
- final repeated-flow drain: ~**+2.31 MiB heap / +702 Nodes / +4 Documents / +14 listeners**;
- sustained Continuous traversal: **0 retained Documents / +44 Nodes / 0 listeners / ~+0.68 MiB**, transient 18 views trimmed back to 5;
- first readable ~1.09–1.13 s; isolated 360-page map ~2.49 s; no long-task evidence justified architectural replacement.

Evidence: [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md).

## v2.11C — Library, Series & browser-local domain

**Status:** ✅ Complete

- retained the catalog/domain/controller ownership split and skipped virtualization/new persistence architecture;
- reduced hydration localStorage reads **121,905 → 14,211 (−88.3%)** and measured interaction reads **314,387 → 11,645 (−96.3%)**;
- removed duplicate render/request ownership while keeping later ordinary catalog loads fresh.

Evidence: [`../audits/V2_11_LIBRARY_SERIES_AUDIT.md`](../audits/V2_11_LIBRARY_SERIES_AUDIT.md).

## v2.11D — Garden Keeper & operational workflows

**Status:** ✅ Complete

- retained the existing workflow split and single AdminClient;
- reduced Maintenance/History/Trash startup from three identical Maintenance GETs to one canonical snapshot owner;
- reused already-materialized Library state for normal Upload duplicate preflight, removing the extra startup GET while preserving one safe fallback request.

Evidence: [`../audits/V2_11_KEEPER_AUDIT.md`](../audits/V2_11_KEEPER_AUDIT.md).

## v2.11E — Pages Functions, security & storage

**Status:** ✅ Complete

- restored least-privilege B2 credential routing: GET/HEAD use read credentials; mutations require write credentials and never fall back;
- made nine unconsumed implementation-only service symbols private;
- retained three deliberate validation-policy seams with direct security regression coverage;
- normal Verify now owns complete security + service regressions; final retained service-export graph has **91 consumed exports**.

Evidence: [`../audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md`](../audits/V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md).

## v2.11F — CSS, motion & accessibility

**Status:** ✅ Complete

- final static ownership result: **36 authored stylesheets / 2,254 selectors / 0 literal unreferenced class candidates / 0 unused custom properties**;
- remaining specificity and `!important` pressure is concentrated in intentional late-loaded workflow/theme/layout layers rather than evidence for a broad cascade rewrite;
- retained keyboard/focus, reduced-motion, forced-colors, increased-contrast, zoom/reflow, and labelled mobile-target behavioral gates;
- no broad stylesheet consolidation was justified.

Evidence: [`../audits/V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md`](../audits/V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md).

## v2.11G — Build, dependencies, tests & tooling

**Status:** ✅ Complete on exact-green head `974fb1d8212ed4afc713da0ed340e22a58f1adff`

- retired seven stale release-era standalone policy executables behind `check-retired-release-tools.mjs`;
- migrated useful M5–M8 behavior into active service regressions; normal service gate is **47/47**;
- activated the current site-voice/destructive-warning guard in normal repository checks;
- removed duplicate Verify/Baseline check execution by using `build:dist` only after the authoritative check already passed;
- removed the duplicate Baseline performance invocation because `npm run check` already owns that tripwire;
- retained Node 22/npm 10.9.8, the two committed lockfiles, no-bundler build, dependency review policy, static preview, EPUB.js lifecycle guard, B2 local tools, and the existing publisher.

Measured Verify result: ~4.43 s repository check + ~0.34 s post-check build, removing roughly four seconds of duplicate deterministic work without dropping a gate.

Evidence: [`../audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md`](../audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md).

## v2.11H — Documentation & repository hygiene

**Status:** 🟨 In progress

Goals:

- reconcile authoritative current architecture/docs with accepted A–G outcomes;
- keep one current roadmap and one current findings register, with detailed subsystem evidence linked rather than duplicated indefinitely;
- remove stale current claims about retired tools, superseded version state, or pre-G CI ownership while preserving historical release/archive records;
- expand documentation freshness enforcement to the current architecture source-of-truth set;
- finish with exact-head Verify, Cloudflare preview, and all five real-browser projects green.

Evidence: [`../audits/V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md`](../audits/V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md).

---

## Release convergence after Audit H

Audit completion does not itself publish v2.11.0. After H closes, the stacked audit branches must be assembled/reverified on the intended final `main` state. A formal v2.11.0 release is cut only after:

- accepted A–H implementation is present together on the final commit;
- final exact-main Verify and complete five-browser E2E are green;
- formal `package.json#version`, lockfile root/workspace version, changelog, and `docs/releases/v2.11.0.md` deliberately converge;
- Cloudflare production reports the matching version + commit;
- production smoke succeeds;
- documentation reflects the final code state.
