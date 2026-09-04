# Shadow Garden Operations

> **Status:** Active operational contracts  
> **Current product baseline:** v2.10.0  
> **Current audit:** [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md)

This directory contains live operational policies. Unlike archived roadmaps, these documents remain active because they describe how the deployed system is maintained and recovered.

- [`DEPENDENCY_MAINTENANCE.md`](./DEPENDENCY_MAINTENANCE.md) — controlled dependency updates, runtime/lockfile policy, audit reporting, and review gates.
- [`CATALOG_RECOVERY.md`](./CATALOG_RECOVERY.md) — catalog snapshot retention, integrity, recovery audits, recovery-anchor protection, and destructive-operation safety.

The post-v2.10 audit may recommend simplifying operational tooling or reducing duplicated work, but any accepted change must preserve the safety and reproducibility guarantees documented here.
