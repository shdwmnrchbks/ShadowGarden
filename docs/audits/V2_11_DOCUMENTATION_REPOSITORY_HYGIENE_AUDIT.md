# v2.11H — Documentation & Repository Hygiene Audit

**Status:** ✅ Complete  
**Stack base:** Audit G exact-green head `974fb1d8212ed4afc713da0ed340e22a58f1adff`  
**Scope:** current documentation source-of-truth, roadmap/audit indexing, architecture/operations freshness, retired-tool claims, and repository documentation ownership

Audit H is a documentation/repository ownership audit, not a product rewrite. Historical release notes, archived roadmaps, completed security milestone records, and Git history remain historical evidence and are not rewritten merely because their old versions or tool names are no longer current.

## H-001 — Current contracts lagged accepted A–G ownership

The prior freshness check protected only the roadmap/docs-index/versioning version split. It did not cover the broader current architecture/operations set, so authoritative documents could drift after later audits landed.

Concrete drift on the Audit G head included:

- `BUILD_DEPLOYMENT.md` still described v2.8.0 as active and v2.6.7 as the latest formal release;
- build/test/design docs still advertised deleted milestone/release-era executable checkers as live permanent guards;
- `MAINTENANCE_BASELINE.md` still documented the pre-G duplicate performance + self-checking build workflow;
- architecture/docs/audit indexes and the consolidated findings register lagged completed audits;
- the active dependency-maintenance policy still described the runtime pin as a v2.10-specific state and talked about duplicate-check reduction as future audit work;
- Audit G's own detailed evidence file still said its exact-head gate was pending after PR #229 had already closed the gate.

**Decision:** 🧹 Reconcile authoritative current docs to accepted A–G ownership and mechanically guard the current source-of-truth boundary.

## H-002 — One current roadmap and one current findings register

`docs/roadmaps/CURRENT_ROADMAP.md` remains the single current roadmap. `docs/audits/POST_V2_10_AUDIT.md` remains the consolidated v2.11 findings/decision register. Detailed subsystem records keep measurements and implementation evidence; the roadmap/register summarize current state and link to those records rather than preserving every intermediate phase forever.

## H-003 — Historical material stays historical

Release notes, archived roadmaps, security milestones, frozen v1/v2 baselines/manifests, and Git history legitimately contain superseded versions and old implementation/tool names.

**Decision:** ⏭ Do not apply current-doc freshness policy to historical evidence. A historical record may say what was true then; a current architecture/operations contract must say what owns the behavior now.

## H-004 — Expanded documentation freshness ownership

`tools/check-documentation-freshness.mjs` now validates current-source-of-truth surfaces including:

- root `README.md` active/formal versions;
- current roadmap and docs index version/status ownership;
- versioning/build/architecture current version boundaries;
- build/test/maintenance post-check `build:dist` ownership;
- package-manager text dynamically from `package.json#packageManager` rather than a hard-coded npm version in the checker;
- current dependency-maintenance package-manager ownership;
- Audit F CSS audit owner;
- consolidated G/H audit dispositions;
- final Audit G closeout status/head;
- absence of exact retired R-series, M5–M9, v2.6, and reading-status executable claims from current architecture/operations docs.

The guard intentionally excludes archival/release/history surfaces. Deterministic unit tests cover synchronized state, root README drift, roadmap/docs/build drift, package-manager drift, retired executable claims, duplicate Baseline performance text, and stale G closeout evidence.

## H-005 — No product/runtime scope

Audit H changes documentation and documentation-verification ownership only. It does not change product JavaScript/CSS behavior, Pages Functions, security/storage/persistence, dependencies, lockfiles, package/formal release version, or release-publisher behavior.

## Verification and closeout

The reconciled H candidate `b286b1e238ea3ed35ff8705d2e1435a5ff5954b5` passed Verify and Cloudflare preview and entered the complete five-browser matrix cleanly before the final closeout refinement.

The final PR head is required to pass the same exact-head gate: Verify, Cloudflare preview, Chromium desktop/mobile, Firefox desktop, WebKit desktop/mobile. PR #230 records the exact final SHA and check state so this document does not require a post-verification commit merely to copy a hash into itself.

## Disposition

Audit H found **current-document ownership drift**, not a product or architecture defect. The accepted fix is a smaller, guarded current source of truth plus preservation of historical evidence. With H complete, **v2.11A–H have explicit evidence-backed outcomes**. The next phase is stacked-branch assembly/final-main verification and deliberate v2.11.0 formal-release convergence; audit completion itself does not publish a release.
