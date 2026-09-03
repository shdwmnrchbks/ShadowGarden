# Catalog Backup & Recovery Policy

Shadow Garden treats catalog snapshots as operational recovery material, not as a second live catalog owner. The canonical live catalogs remain `shadow-garden/data/catalog.json` and `shadow-garden/data/adult-catalog.json`; snapshots are private B2 objects used only by Garden Keeper recovery flows.

## Retention policy

- Retain the **30 newest catalog snapshots**, newest first. `functions/services/catalog.js` owns this limit through `BACKUP_LIMIT`.
- Automatic snapshots are created before high-impact catalog mutations. Garden Keeper can also create a manual snapshot.
- Snapshot creation is ordered defensively: write the new snapshot payload first, then write the backup index containing it, then delete payloads that fell beyond the 30-snapshot limit.
- Failure to delete an old pruned payload is non-fatal because the index has already stopped treating it as retained recovery material. The orphan can be cleaned later; deleting recovery material is never required to complete the live catalog mutation.
- Retention pruning is different from a Keeper-requested manual deletion. Protection against manually deleting the last recoverable state is a separate v2.9 recovery-readiness requirement and must not be inferred from the 30-snapshot pruning rule.

## Snapshot integrity

New catalog snapshot payloads are protected at the canonical B2 storage boundary:

- `x-amz-meta-shadow-garden-sha256` stores the SHA-256 of the exact UTF-8 JSON payload.
- `x-amz-meta-shadow-garden-bytes` stores the exact UTF-8 byte length.
- Backup reads verify checksum and byte metadata before the catalog service parses or restores the snapshot.
- A checksum or byte-length mismatch is a hard recovery failure. A damaged checksummed snapshot must never be normalized into apparently valid live catalogs.

Snapshots created before this integrity metadata existed remain supported. They are classified as **legacy-unverified** when their JSON and catalog structure are readable. They may still be recovery candidates, but Shadow Garden must not describe them as checksum-verified.

## Recovery audit

Authenticated Garden Keeper tooling can issue `GET /admin-api/recovery` for an on-demand, read-only audit of the retained snapshot set. The audit checks each indexed snapshot and classifies it as one of:

- `verified` — checksum, byte length, JSON, id, and both catalog structures are valid.
- `legacy-unverified` — structurally readable, but created before checksum metadata existed.
- `missing` — the indexed B2 object does not exist.
- `checksum-mismatch` / `size-mismatch` — stored integrity metadata does not match the payload.
- `unreadable` — the object is not valid JSON.
- `incomplete` / `incomplete-index` — required snapshot or catalog material is absent or inconsistent.
- `check-failed` — storage verification itself could not be completed reliably.

The audit intentionally runs on demand rather than on every Maintenance view load because it reads up to 30 private snapshot objects. A later Keeper recovery-readiness surface may present this report without changing its service ownership.

## Restore rule

`loadBackup()` continues to own snapshot loading for catalog restore. Because backup payload reads now verify storage integrity automatically, a checksummed snapshot with altered content cannot reach the restore write path. Legacy snapshots remain structurally validated by the catalog loader and are separately identified by the recovery audit as unverified.

## CI boundary

Recovery tests use deterministic in-memory B2/S3 fixtures. Normal CI must never perform destructive production recovery. Production recovery remains an explicit Keeper action protected by the existing admin session and confirmation contracts.
