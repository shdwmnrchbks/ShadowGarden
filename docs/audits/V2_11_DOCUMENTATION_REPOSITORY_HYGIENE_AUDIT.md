# v2.11H — Documentation & Repository Hygiene Audit

**Status:** In progress  
**Stack base:** Audit G exact-green head `974fb1d8212ed4afc713da0ed340e22a58f1adff`  
**Scope:** current documentation source-of-truth, roadmap/audit indexing, architecture-contract freshness, retired-tool references, and repository documentation ownership

Audit H is a documentation/repository ownership audit, not a product rewrite. Historical release notes, archived roadmaps, milestone records, and Git history remain historical evidence and are not rewritten merely because their old versions or tool names are no longer current.

## H-001 — Current architecture docs lag landed audit decisions

The existing documentation freshness check correctly protected the deployment/formal version split in the roadmap, docs index, and versioning contract, but it did not cover the broader current architecture set. That allowed authoritative current documents to drift after later audits landed.

Observed examples on the exact Audit G head:

- `BUILD_DEPLOYMENT.md` still described v2.8.0 as active and v2.6.7 as the latest formal release;
- `BUILD_DEPLOYMENT.md`, `TEST_ARCHITECTURE.md`, and `DESIGN_SYSTEM.md` still described retired release-era executables as permanent current guards;
- `MAINTENANCE_BASELINE.md` still documented the pre-Audit-G duplicate `performance:sanity` and self-checking build workflow shape;
- `architecture/README.md` still described already-completed A–G work as future audit questions;
- `POST_V2_10_AUDIT.md` still stopped at the A/B working state even though dedicated C–G records and green closeouts now exist.

**Decision:** 🧹 Reconcile only authoritative current docs to accepted A–G ownership, while preserving immutable/historical records. Expand the active freshness check so the same retired-executable/current-version drift cannot silently return.

## H-002 — One current roadmap, one current findings register

The repository already defines `docs/roadmaps/CURRENT_ROADMAP.md` as the single active roadmap and `docs/audits/POST_V2_10_AUDIT.md` as the current v2.11 findings register. Their content accumulated stale phase text as specialized audits progressed.

**Decision:** 🧹 Keep those paths canonical but simplify them into current summaries that link to detailed subsystem audit evidence. Git history and the dedicated audit files preserve the detailed execution trail; the current roadmap/register should answer “where are we now?” rather than reproduce every intermediate step.

## H-003 — Historical material stays historical

Completed release notes, archived v2.6–v2.10 planning, Security milestone records, and R0–R10 history legitimately contain old versions and historical tool names.

**Decision:** ⏭ Do not run freshness enforcement across archival/history surfaces. Freshness checks target only documents that claim to describe current architecture, current verification, current audit status, or current deployment/release ownership.

## Planned acceptance

Audit H closes when:

- current roadmap/index/audit records reflect completed A–G outcomes and Audit H status;
- current build/test/CSS/maintenance architecture docs match Audit G/F ownership and do not advertise deleted executables as live guards;
- the documentation freshness checker mechanically verifies active/formal versions plus the current architecture/retired-tool boundary;
- deterministic documentation-freshness tests cover the expanded guard;
- exact final head passes Verify, Cloudflare preview, and Chromium desktop/mobile, Firefox desktop, WebKit desktop/mobile;
- no product runtime, dependency, lockfile, security, persistence, or release-version behavior changes as part of H.
