# Shadow Garden Planning Archive

> **Status:** 🗄️ Archived history  
> **Current roadmap:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)

This directory preserves completed or superseded Shadow Garden roadmaps, audits, and milestone records. Archived files are historical/audit records only; they do not define current work.

## Completed roadmaps

- [`SECURITY_ROADMAP.md`](./SECURITY_ROADMAP.md) — completed Security & Anti-Abuse Milestones 1–9.
- [`REFACTOR_ROADMAP.md`](./REFACTOR_ROADMAP.md) — completed R0–R10 full-codebase refactor ending at the v2.0.0 architecture baseline.
- [`ROADMAP_V2_6_TO_V2_10.md`](./ROADMAP_V2_6_TO_V2_10.md) — completed Reliability, Reader Experience, Keeper Recovery, and Maintenance roadmap covering v2.6 through v2.10.

## Completed audit/planning records

- [`READER_OWNERSHIP_AUDIT_V2_8.md`](./READER_OWNERSHIP_AUDIT_V2_8.md) — completed v2.8 Reader ownership audit; localized ownership drift was corrected while a broader Reader rewrite was explicitly rejected as unnecessary.
- [`V2_8_FOOTNOTE_AUDIT.md`](./V2_8_FOOTNOTE_AUDIT.md) — completed Reader footnote/endnote compatibility audit that shipped in v2.8.0.

## Security milestone records

- [`security/MILESTONE_5_CLOUDFLARE.md`](./security/MILESTONE_5_CLOUDFLARE.md)
- [`security/MILESTONE_6_CRAWLER_POLICY.md`](./security/MILESTONE_6_CRAWLER_POLICY.md)
- [`security/MILESTONE_7_GARDEN_KEEPER.md`](./security/MILESTONE_7_GARDEN_KEEPER.md)
- [`security/MILESTONE_8_ABUSE_RESPONSE.md`](./security/MILESTONE_8_ABUSE_RESPONSE.md)
- [`security/MILESTONE_9_FINAL_AUDIT.md`](./security/MILESTONE_9_FINAL_AUDIT.md)

Milestones 1–4 are represented by the completed security roadmap/baseline history; no standalone Milestone 1–4 Markdown records existed in the repository at archival time.

## v2.5 Motion & Continuity milestone records

- [`v2.5-motion/v2.5-motion.md`](./v2.5-motion/v2.5-motion.md) — completed four-slice milestone plan.
- [`v2.5-motion/v2.5-motion-slice-1.md`](./v2.5-motion/v2.5-motion-slice-1.md) — shared motion foundation.
- [`v2.5-motion/v2.5-motion-slice-2.md`](./v2.5-motion/v2.5-motion-slice-2.md) — Library continuity and reflow.
- [`v2.5-motion/v2.5-motion-slice-3.md`](./v2.5-motion/v2.5-motion-slice-3.md) — Series and Reader continuity.
- [`v2.5-motion/v2.5-motion-slice-4.md`](./v2.5-motion/v2.5-motion-slice-4.md) — Keeper and navigation continuity plus v2.5.0 release reconciliation.

Actual release notes remain under [`../releases/`](../releases/) and active architecture contracts remain under [`../architecture/`](../architecture/).

## Archive policy

- `docs/roadmaps/CURRENT_ROADMAP.md` is the only active planning document.
- Completed roadmap/audit planning moves here rather than remaining as duplicated current-path content.
- Completed focused architecture audits move here after their findings are reconciled into active architecture contracts; historical audit snapshots do not remain in `docs/architecture/` as if they were current owners.
- `docs/roadmaps/REFACTOR_ROADMAP.md` and `docs/roadmaps/SECURITY_ROADMAP.md` are Git symlinks to the canonical archived files solely so permanent historical guards and old links continue to resolve without duplicate content.
- Historical release notes are not rewritten to describe later work.
- The current audit/refactor/optimization phase is governed by [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md) and [`../architecture/ENGINEERING_AUDIT.md`](../architecture/ENGINEERING_AUDIT.md).
