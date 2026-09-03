# Catalog Backup & Recovery Policy

Shadow Garden treats catalog snapshots as operational recovery material, not as a second live catalog owner. The canonical live catalogs remain `shadow-garden/data/catalog.json` and `shadow-garden/data/adult-catalog.json`; snapshots are private B2 objects used only by Garden Keeper recovery flows.

## Retention policy

- Retain the **30 newest catalog snapshots**, newest first. `functions/services/catalog.js` owns this limit through `BACKUP_LIMIT`.
- Automatic snapshots are created before high-impact catalog mutations. Garden Keeper can also create a manual snapshot.
- Snapshot creation is ordered defensively: write the new snapshot payload first, then write the backup index containing it, then delete payloads that fell beyond the 30-snapshot limit.
- Failure to delete an old pruned payload is non-fatal because the index has already stopped treating it as retained recovery material. The orphan can be cleaned later; deleting recovery material is never required to complete the live catalog mutation.
- Retention pruning is different from a Keeper-requested manual deletion. Manual deletion is preflighted against recovery readiness before the canonical catalog backup handler is allowed to remove the indexed snapshot.

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

## Recovery-anchor protection

Destructive cleanup is preflighted by the recovery service, while the existing catalog service remains the owner of the actual backup deletion and Trash purge mutations.

### Manual backup deletion

Before `/admin-api/backup` delegates a delete request to the catalog handler:

- If the target is the **last confirmed recoverable snapshot**, deletion is blocked with `last-recoverable-backup`.
- If the target could not be verified (`check-failed`) and there is no other confirmed recoverable snapshot, deletion is blocked with `recovery-audit-uncertain`.
- A known-bad snapshot such as a checksum-mismatched object may be removed because it is not counted as a recoverable anchor.
- Deletion is allowed when at least one other confirmed recoverable snapshot will remain.

The safety wrapper does not delete the object itself. When deletion is safe, it delegates to the canonical `handleBackupPost()` implementation, preserving the existing index-update/delete/rollback behavior.

### Trash purge

Trash purge can permanently remove EPUB/cover objects. Its preflight therefore mirrors the canonical purge calculation and checks those candidate deletions against a recovery anchor.

- Purge is blocked immediately if either live canonical catalog is missing, invalid JSON, structurally incomplete, or unreadable. A damaged live catalog must be recovered before any Trash material is permanently discarded.
- The guard calculates which selected Trash object keys would actually be deleted after accounting for the current live catalogs and unselected Trash entries.
- If no storage object would be deleted, the purge is allowed without requiring a snapshot.
- If physical object deletion would occur and no recoverable snapshot exists, purge is blocked with `no-recoverable-backup`.
- The preferred recovery anchor is the newest **verified** retained snapshot. If no verified snapshot exists, the newest structurally recoverable legacy snapshot is used.
- If any candidate object deletion is still referenced by that anchor, purge is blocked with `purge-would-break-recovery-anchor`.
- After a delete-to-Trash operation, create and verify a fresh snapshot of the post-delete catalogs. That advances the recovery anchor so media no longer referenced by the fresh snapshot can be purged safely.

As with backup deletion, the recovery service performs only the safety preflight. Safe purge requests are delegated to the canonical `handleMaintenancePost()` implementation.

## Restore rules

Normal restore remains owned by Garden Maintenance. When both live catalogs are readable, use the existing Maintenance restore action: it creates a pre-restore snapshot of the current state before writing the selected backup.

Emergency restore is deliberately narrower. `POST /admin-api/recovery` with `{"action":"restore-known-good","id":"<backup-id>"}` is accepted only when at least one canonical live catalog is missing, invalid JSON, structurally incomplete, or cannot be read reliably. If both live catalogs are readable, the emergency endpoint returns `409 current-readable` and directs the operator back to normal Maintenance restore so the pre-restore safety snapshot is not bypassed.

Before an emergency write:

1. The selected backup must still be indexed.
2. The recovery service verifies the backup object through the same checksum/byte/structure audit used by recovery readiness.
3. A missing, unreadable, incomplete, checksum-mismatched, or otherwise unrecoverable backup is refused.
4. `loadBackup()` performs the storage-integrity check again before catalog material is written, protecting against the snapshot changing between audit and restore.
5. Both canonical catalogs are written through `saveCatalogPair()` and then re-read structurally. A failed post-restore validation is treated as recovery failure.

Emergency restore cannot create a meaningful pre-restore catalog snapshot because its activation condition is that current catalog material is already unrecoverable. The response records `preRestoreSnapshot: "skipped-unrecoverable-current-state"` so that omission is explicit rather than silently presented as normal restore behavior.

## Deterministic recovery drill

The automated drill uses only an in-memory B2/S3 fixture. It never touches production storage.

Run it directly with:

```sh
node --test tests/service/catalog-recovery-drill.test.mjs
```

The drill performs these scenarios:

1. Create readable main/adult catalogs and a checksummed known-good snapshot.
2. Replace the live main catalog with invalid JSON while leaving the adult catalog readable.
3. Confirm recovery readiness classifies the live state as requiring recovery.
4. Restore the known-good snapshot through the emergency recovery service.
5. Re-read both live catalogs and assert the expected main/adult series identities are restored.
6. Repeat with both live catalog objects missing.
7. Confirm emergency recovery refuses to run when both live catalogs are healthy.
8. Tamper with a checksummed snapshot and confirm the recovery service refuses it without overwriting the already-damaged live catalog.

The recovery-anchor tests additionally prove that the final confirmed snapshot cannot be manually deleted, uncertain recovery material fails closed when it is the only possible anchor, and Trash purge cannot delete media required by the preferred recovery anchor.

This drill proves the recovery algorithm and storage contracts. It does not claim B2-region disaster recovery, credential recovery, or an atomic two-object transaction; those remain infrastructure/operational concerns outside the catalog recovery contract.

## CI boundary

Recovery tests use deterministic in-memory B2/S3 fixtures and run through the repository service-test gate. Normal CI must never perform destructive production recovery or use production B2 credentials for a recovery drill. Production emergency recovery is an explicit authenticated operator action, not a scheduled or automatic CI behavior.
