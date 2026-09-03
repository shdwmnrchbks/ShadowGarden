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

This drill proves the recovery algorithm and storage contracts. It does not claim B2-region disaster recovery, credential recovery, or an atomic two-object transaction; those remain infrastructure/operational concerns outside the catalog recovery contract.

## CI boundary

Recovery tests use deterministic in-memory B2/S3 fixtures and run through the repository service-test gate. Normal CI must never perform destructive production recovery or use production B2 credentials for a recovery drill. Production emergency recovery is an explicit authenticated operator action, not a scheduled or automatic CI behavior.
