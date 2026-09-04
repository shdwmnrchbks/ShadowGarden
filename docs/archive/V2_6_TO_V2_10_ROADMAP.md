# Archived Roadmap — Reliability, Reader Experience & Operations (v2.6–v2.10)

> **Status:** 🗄️ Archived — completed 2026-09-04  
> **Covered releases:** v2.6.0, deferred/optional v2.7.0, v2.8.0, v2.9.0, v2.10.0  
> **Superseded by:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)

This archive preserves the completed roadmap that carried Shadow Garden from the v2.6 real-browser reliability milestone through v2.10 Maintenance & Supply Chain.

The roadmap is no longer active planning. Release records under [`../releases/`](../releases/) and architecture contracts under [`../architecture/`](../architecture/) remain the authoritative records for shipped behavior and ownership.

## Working principles carried by the completed roadmap

- Reliability before new surface area.
- Reader stability as the highest-risk product contract.
- Realistic personal-library measurements before optimization.
- No speculative framework, virtualization, or architecture rewrites.
- Preserve one owner per responsibility and the accepted v2 architecture.
- Preserve private B2, signed media, Keeper authentication, abuse controls, Range delivery, and browser-local reading data.
- Treat accessibility and real-browser behavior as functional requirements.
- Keep release slices small and `main` deployable.

## v2.6.0 — Reliability & Real-Browser Testing

**Status:** ✅ Done  
**Completed:** 2026-08-26  
**Release record:** [`../releases/v2.6.0.md`](../releases/v2.6.0.md)

Completed outcomes included:

- permanent Playwright coverage across Chromium, Firefox, WebKit, Chromium Mobile, and WebKit Mobile;
- generated isolated fixtures and failure artifacts;
- real-browser coverage for Main/Adult Library flows, Series, Reader lifecycle, mobile navigation, reduced motion, and Garden Keeper;
- Reader Pages/Continuous reliability, Page Map/progress preservation, image focus, resize/orientation, resume/ticket renewal, and malformed/common EPUB fixtures;
- keyboard/focus, zoom/reflow, forced colors, increased contrast, reduced motion, and mobile touch-target accessibility verification;
- exact-main Verify + Real Browser E2E as a permanent release gate.

The v2.6.x hotfix series later hardened Continuous Reader media containment and rail/layout behavior without changing the roadmap ownership model.

## v2.7.0 — Performance Sanity

**Status:** ⏸ Deferred / optional

The original v2.7 scope was intentionally not treated as required feature work. Its useful constraints were:

- test realistic personal-library scale around 250–300 series;
- use representative large EPUBs rather than hypothetical enterprise workloads;
- optimize only reproduced bottlenecks;
- avoid speculative virtualization, framework changes, or brittle microbenchmark infrastructure.

By v2.10, a deterministic 300-series Library sanity tripwire and recurring baseline health checks covered the most useful part of this intent. Deeper Reader/performance investigation now belongs to the post-v2.10 audit roadmap and is still evidence-gated.

## v2.8.0 — Reader Experience

**Status:** ✅ Done  
**Completed:** 2026-09-03  
**Release record:** [`../releases/v2.8.0.md`](../releases/v2.8.0.md)

Completed outcomes included:

- focused Reader typeface choices with publication-owned Default behavior;
- clearer canonical page/percentage/chapter progress presentation;
- long-book Contents filtering and Current-location recovery;
- bounded whole-book CFI-backed text search through the existing Reader navigation path;
- Reader-owned sanitized footnote/endnote popups;
- stronger resume behavior and malformed/common EPUB compatibility coverage.

Bookmark management expansion and richer browser-local reading history were explicitly not required for the release.

## v2.9.0 — Keeper Productivity & Recovery

**Status:** ✅ Done  
**Completed:** 2026-09-03  
**Release record:** [`../releases/v2.9.0.md`](../releases/v2.9.0.md)

Completed outcomes included:

- safe batch metadata editing with preview;
- duplicate/similar-volume warnings and concise upload/preflight reporting;
- bulk cover/banner workflows and deterministic reversible fixes;
- recovery snapshot/retention policy, integrity classification, and deterministic recovery drills;
- last-recoverable-state protection and recovery readiness reporting;
- preservation of canonical validation, catalog, storage, and admin service ownership.

## v2.10.0 — Maintenance & Supply Chain

**Status:** ✅ Done  
**Completed:** 2026-09-04  
**Release record:** [`../releases/v2.10.0.md`](../releases/v2.10.0.md)

Completed outcomes included:

- controlled Dependabot coverage for direct dependencies and reviewed GitHub Actions pins;
- heightened review rules for EPUB.js, AWS/B2, authentication, security-sensitive dependencies, runtime pins, and workflow changes;
- dependency/audit reporting with actionable versus non-actionable policy;
- reviewed Node/npm and lockfile-integrity ownership;
- documentation freshness and release-metadata synchronization guards;
- recurring Baseline Health plus monthly/manual full real-browser verification;
- deterministic realistic-scale Library performance sanity;
- formal release/deployment/package/lockfile/changelog/release-note convergence at v2.10.0.

Post-release dependency maintenance also merged reviewed `fast-xml-parser` and AWS S3 client updates through the same Verify + five-browser gates without moving the immutable v2.10.0 release target.

## Deferred backlog at archival time

These ideas were deliberately not commitments and remain outside the completed roadmap:

- richer browser-local Recently Read/completion history;
- saved Library views or deeper multi-filter composition;
- more Keeper metadata cleanup tools;
- additional EPUB compatibility fixtures driven by real failures;
- optional customer-owned Cloudflare-zone hardening if Shadow Garden leaves `pages.dev`;
- deeper performance engineering only if measurements expose a real bottleneck.

The successor roadmap intentionally prioritizes auditing the mature codebase before deciding whether any refactor or optimization work is warranted.
