# Shadow Garden Audits

> **Status:** Active evidence workspace  
> **Current audit:** [`POST_V2_10_AUDIT.md`](./POST_V2_10_AUDIT.md)  
> **Library/Series Audit C:** [`V2_11_LIBRARY_SERIES_AUDIT.md`](./V2_11_LIBRARY_SERIES_AUDIT.md)  
> **Current entrypoint inventory:** [`POST_V2_10_ENTRYPOINT_INVENTORY.md`](./POST_V2_10_ENTRYPOINT_INVENTORY.md)  
> **Current roadmap:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)

This directory holds evidence-based architecture, maintainability, performance, security, test/tooling, and repository audits.

Audits are not permission to refactor by default. Each finding must end with one explicit decision:

- **No change needed** — current structure is healthy and should remain.
- **Refactor justified** — evidence shows duplicated/fragile ownership, maintainability risk, or correctness risk.
- **Optimization justified** — a realistic reproducible bottleneck exists.
- **Deferred** — benefit is real but does not justify current cost/risk.
- **Skipped** — the proposed change is unnecessary after inspection.

## Evidence standard

Useful evidence includes:

- repeated ownership or duplicated business rules;
- dead/unreachable code or obsolete compatibility paths;
- recurrent bug history tied to structural complexity;
- measurable latency, memory, DOM, network, build, or test cost;
- brittle tests or tooling that create maintenance risk;
- security/recovery boundaries that are difficult to reason about safely;
- documentation/implementation divergence.

Preference or aesthetic consistency alone is not enough to justify a rewrite.

## Active records

- [`POST_V2_10_AUDIT.md`](./POST_V2_10_AUDIT.md) — findings register, decisions, measurements, implementation candidates, and skip/defer outcomes for the v2.11 engineering audit.
- [`V2_11_LIBRARY_SERIES_AUDIT.md`](./V2_11_LIBRARY_SERIES_AUDIT.md) — Audit C realistic-scale Library/Series measurements, browser-local domain ownership revalidation, before/after state-read evidence, and accepted targeted optimizations.
- [`POST_V2_10_ENTRYPOINT_INVENTORY.md`](./POST_V2_10_ENTRYPOINT_INVENTORY.md) — Audit A comparison of the frozen v2.0 entrypoint baseline with current post-v2 Reader/Keeper/Functions/tooling ownership.

## Audit record format

Each active audit should record:

1. baseline commit/version;
2. subsystem or path inspected;
3. evidence/measurement;
4. impact and risk;
5. decision;
6. proposed smallest safe change when applicable;
7. regression test or measurement that will prove completion.

Completed audits remain here as historical evidence even when every implementation recommendation is skipped or deferred.
