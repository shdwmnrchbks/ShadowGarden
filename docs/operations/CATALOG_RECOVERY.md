# Catalog Backup & Recovery Policy

Shadow Garden treats catalog snapshots as operational recovery material, not as a second live catalog owner. The canonical live catalogs remain `shadow-garden/data/catalog.json` and `shadow-garden/data/adult-catalog.json`; snapshots are private B2 objects used only by Garden Keeper recovery flows.

## Retention policy

- Retain the **15 newest catalog snapshots**, newest first. `functions/services/catalog.js` owns this limit through `BACKUP_LIMIT`.
- Automatic snapshots are created before high-impact catalog mutations. Garden Keeper can also create a manual snapshot.
- Snapshot creation is ordered defensively: write the new snapshot payload first, then write the backup index containing it, then delete payloads that fell beyond the 15-snapshot limit.
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

The normal audit verifies snapshot material itself. It intentionally does not HEAD every EPUB/cover referenced by every retained snapshot because that could multiply a 15-snapshot audit into hundreds or thousands of private-object reads. Destructive-operation preflight performs the stronger media check only when deciding whether recovery material may be deleted.

## Recovery-anchor protection

Destructive cleanup is preflighted by the recovery service, while the existing catalog service remains the owner of the actual backup deletion and Trash purge mutations.

For destructive safety, a snapshot is an **object-complete recovery anchor** only when:

1. its indexed snapshot object is structurally recoverable under the normal checksum/JSON audit; and
2. every canonical EPUB/cover object referenced by that snapshot is still present in private storage.

The recovery service checks referenced media with the canonical storage `HEAD` path. A snapshot whose JSON remains readable after its referenced media has already been deleted is therefore treated as stale, not as evidence that another usable recovery state remains.

### Manual backup deletion

Before `/admin-api/backup` delegates a delete request to the catalog handler:

- If the target is the **last object-complete recoverable snapshot**, deletion is blocked with `last-recoverable-backup`.
- If the target or its media cannot be verified and there is no other object-complete recovery anchor, deletion is blocked with `recovery-audit-uncertain`.
- A known-bad or stale snapshot may be removed because it is not counted as a usable recovery anchor.
- Deletion is allowed when at least one other object-complete recovery anchor will remain.

The safety wrapper does not delete the object itself. When deletion is safe, it delegates to the canonical `handleBackupPost()` implementation, preserving the existing index-update/delete/rollback behavior.

### Trash purge

Trash purge can permanently remove EPUB/cover objects. Its preflight therefore mirrors the canonical purge calculation and checks those candidate deletions against an object-complete recovery anchor.

- Purge is blocked immediately if either live canonical catalog is missing, invalid JSON, structurally incomplete, or unreadable. A damaged live catalog must be recovered before any Trash material is permanently discarded.
- The guard calculates which selected Trash object keys would actually be deleted after accounting for the current live catalogs and unselected Trash entries.
- If no storage object would be deleted, the purge is allowed without requiring a snapshot.
- For object-deleting purge, retained snapshots are considered newest-first until the first object-complete recovery anchor is found. Stale snapshots with missing referenced media are skipped.
- If no object-complete recovery anchor exists, purge is blocked with `no-recoverable-backup`. If media verification itself is uncertain and no complete anchor can be proven, purge fails closed with `recovery-anchor-check-uncertain`.
- If any candidate object deletion is still referenced by the selected anchor, purge is blocked with `purge-would-break-recovery-anchor`.
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

The recovery-anchor tests additionally prove that the final object-complete snapshot cannot be manually deleted, a structurally valid snapshot with missing media does not count as the remaining anchor, uncertain recovery material fails closed when it is the only possible anchor, and Trash purge cannot delete media required by the selected object-complete recovery anchor.

This drill proves the recovery algorithm and storage contracts. It does not claim B2-region disaster recovery, credential recovery, or an atomic two-object transaction; those remain infrastructure/operational concerns outside the catalog recovery contract.

## CI boundary

Recovery tests use deterministic in-memory B2/S3 fixtures and run through the repository service-test gate. Normal CI must never perform destructive production recovery or use production B2 credentials for a recovery drill. Production emergency recovery is an explicit authenticated operator action, not a scheduled or automatic CI behavior.
