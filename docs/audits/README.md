# Shadow Garden Audits

> **Status:** ✅ v2.11A–H complete · release convergence next  
> **Current consolidated register:** [`POST_V2_10_AUDIT.md`](./POST_V2_10_AUDIT.md)  
> **Current roadmap:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)

Audit evidence precedes architecture change. Each material finding ends in one explicit disposition: **No change needed**, **Cleanup**, **Targeted refactor**, **Measured optimization**, **Deferred**, or **Skipped**.

## Records

- [`POST_V2_10_AUDIT.md`](./POST_V2_10_AUDIT.md) — consolidated A–H findings/decisions plus detailed A/B measurements.
- [`POST_V2_10_ENTRYPOINT_INVENTORY.md`](./POST_V2_10_ENTRYPOINT_INVENTORY.md) — Audit A production browser/Functions ownership inventory.
- [`V2_11_LIBRARY_SERIES_AUDIT.md`](./V2_11_LIBRARY_SERIES_AUDIT.md) — Audit C, realistic-scale Library/Series/domain behavior.
- [`V2_11_KEEPER_AUDIT.md`](./V2_11_KEEPER_AUDIT.md) — Audit D, Keeper runtime/request ownership.
- [`V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md`](./V2_11_FUNCTIONS_SECURITY_STORAGE_AUDIT.md) — Audit E, Functions/security/storage ownership.
- [`V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md`](./V2_11_CSS_MOTION_ACCESSIBILITY_AUDIT.md) — Audit F, CSS ownership/motion/accessibility.
- [`V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md`](./V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md) — Audit G, build/dependency/test/tooling closeout.
- [`V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md`](./V2_11_DOCUMENTATION_REPOSITORY_HYGIENE_AUDIT.md) — Audit H, current documentation/repository hygiene closeout.

Audit B remains recorded in the consolidated findings file because its Reader runtime evidence was developed there before later audits adopted dedicated per-subsystem records.

## Evidence standard

Useful evidence includes duplicated ownership, dead/unreachable/compatibility code, repeated structural defects, measurable latency/memory/DOM/network/build/test cost, brittle verification/tooling, security/recovery reasoning risk, and documentation/implementation divergence. Preference or aesthetic consistency alone is not refactor evidence.

Completed audits remain evidence; accepted architecture documents are the current ownership source of truth after reconciliation.
