/* Shadow Garden v2.9 — catalog recovery readiness and emergency restore service. */
import {
  ADULT_KEY,
  BACKUP_LIMIT,
  BACKUP_PREFIX,
  MAIN_KEY,
  handleBackupPost,
  handleMaintenancePost,
  invalidateCatalogCache,
  listBackups,
  loadBackup,
  loadCatalogPair,
  loadTrash,
  saveCatalogPair,
  seriesObjectKeys,
  trashItemKeys
} from "./catalog.js";
import { requireAdmin } from "./auth.js";
import { json, parseJson } from "./http.js";
import { getTextObject, getTextObjectWithIntegrity, headObject, validObjectKey, writeClient } from "./storage.js";

function structuralProblem(payload, meta) {
  if (!payload || typeof payload !== "object") return "Backup payload is not an object.";
  if (payload.version !== 1) return "Backup payload version is unsupported.";
  if (String(payload.id || "") !== String(meta?.id || "")) return "Backup payload id does not match its index entry.";
  if (!payload.main || typeof payload.main !== "object" || !Array.isArray(payload.main.series)) return "Main catalog material is missing or incomplete.";
  if (!payload.adult || typeof payload.adult !== "object" || !Array.isArray(payload.adult.series)) return "Adult catalog material is missing or incomplete.";
  return "";
}

export async function inspectCatalogBackup(aws, meta) {
  const base = {
    id: String(meta?.id || ""), key: String(meta?.key || ""), createdAt: String(meta?.createdAt || ""),
    reason: String(meta?.reason || ""), counts: meta?.counts && typeof meta.counts === "object" ? meta.counts : {}
  };
  if (!base.id || !validObjectKey(base.key, [BACKUP_PREFIX])) return { ...base, status: "incomplete-index", recoverable: false, verified: false, detail: "Backup index entry is missing a valid id or object key." };
  try {
    const result = await getTextObjectWithIntegrity(aws, base.key);
    if (result.text === null) return { ...base, status: "missing", recoverable: false, verified: false, detail: "Backup object is missing from private storage." };
    const integrity = result.integrity || {};
    if (integrity.hasChecksum && !integrity.checksumMatches) return { ...base, status: "checksum-mismatch", recoverable: false, verified: false, detail: "Stored SHA-256 metadata does not match the backup payload." };
    if (integrity.expectedBytes !== null && integrity.expectedBytes !== undefined && integrity.sizeMatches === false) return { ...base, status: "size-mismatch", recoverable: false, verified: false, detail: "Stored byte-length metadata does not match the backup payload." };
    let payload;
    try { payload = JSON.parse(result.text); }
    catch { return { ...base, status: "unreadable", recoverable: false, verified: false, detail: "Backup object is not valid JSON." }; }
    const structural = structuralProblem(payload, meta);
    if (structural) return { ...base, status: "incomplete", recoverable: false, verified: false, detail: structural };
    const verified = Boolean(integrity.hasChecksum && integrity.checksumMatches && integrity.sizeMatches !== false);
    return {
      ...base, status: verified ? "verified" : "legacy-unverified", recoverable: true, verified,
      detail: verified ? "Checksum, byte length, and catalog structure verified." : "Catalog structure is readable, but this legacy snapshot predates checksum metadata.",
      integrity: {
        sha256: integrity.actualSha256 || "", bytes: Number(integrity.actualBytes) || 0,
        expectedBytes: integrity.expectedBytes ?? null, checksumPresent: Boolean(integrity.hasChecksum)
      }
    };
  } catch (error) {
    return { ...base, status: "check-failed", recoverable: false, verified: false, detail: String(error?.message || error) };
  }
}

export async function auditCatalogBackups(aws) {
  const backups = (await listBackups(aws)).slice(0, BACKUP_LIMIT), items = [];
  for (const backup of backups) items.push(await inspectCatalogBackup(aws, backup));
  const count = status => items.filter(item => item.status === status).length;
  const recoverable = items.filter(item => item.recoverable).length, verified = count("verified"), legacyUnverified = count("legacy-unverified");
  return {
    ok: true,
    policy: {
      maxSnapshots: BACKUP_LIMIT,
      ordering: "newest-first",
      pruning: "after-new-snapshot-indexed",
      checksum: "sha256",
      legacySnapshots: "readable-but-unverified"
    },
    summary: {
      total: items.length, recoverable, verified, legacyUnverified,
      damaged: items.length - recoverable,
      missing: count("missing"), unreadable: count("unreadable"), incomplete: count("incomplete") + count("incomplete-index"),
      checksumMismatch: count("checksum-mismatch") + count("size-mismatch"), checkFailed: count("check-failed")
    },
    items
  };
}

function catalogObjectKeys(data) {
  const keys = new Set();
  for (const catalog of [data?.main, data?.adult]) for (const series of Array.isArray(catalog?.series) ? catalog.series : []) for (const key of seriesObjectKeys(series)) keys.add(key);
  return keys;
}

export async function inspectRecoveryAnchorObjects(aws, item) {
  const base = { id: String(item?.id || ""), snapshotStatus: String(item?.status || ""), complete: false, uncertain: false, objectCount: 0, missing: [] };
  if (!item?.recoverable) return { ...base, status: item?.status === "check-failed" ? "object-check-uncertain" : "snapshot-unrecoverable", uncertain: item?.status === "check-failed" };
  try {
    const backup = await loadBackup(aws, base.id);
    if (!backup) return { ...base, status: "snapshot-missing" };
    const keys = [...catalogObjectKeys(backup)], missing = [];
    for (const key of keys) if (!(await headObject(aws, key))) missing.push(key);
    return {
      ...base,
      status: missing.length ? "missing-media" : "complete",
      complete: missing.length === 0,
      objectCount: keys.length,
      missing,
      keys
    };
  } catch (error) {
    return { ...base, status: "object-check-uncertain", uncertain: true, detail: String(error?.message || error) };
  }
}

async function firstCompleteRecoveryAnchor(aws, items = []) {
  let uncertain = 0, stale = 0, checked = 0;
  for (const item of items) {
    if (!item?.recoverable) continue;
    const availability = await inspectRecoveryAnchorObjects(aws, item); checked += 1;
    if (availability.complete) return { anchor: item, availability, checked, uncertain, stale };
    if (availability.uncertain) uncertain += 1; else stale += 1;
  }
  return { anchor: null, availability: null, checked, uncertain, stale };
}

export async function catalogBackupDeletionGuard(aws, id) {
  const backupId = String(id || "").trim(), report = await auditCatalogBackups(aws);
  const target = report.items.find(item => item.id === backupId);
  if (!target) return { allowed: true, status: "backup-not-found", backupId, recoverableBefore: report.summary.recoverable, remainingRecoverable: report.summary.recoverable, remainingRecoveryAnchors: 0 };

  const alternatives = await firstCompleteRecoveryAnchor(aws, report.items.filter(item => item.id !== backupId));
  if (alternatives.anchor) return {
    allowed: true,
    status: "safe-to-delete",
    backupId,
    targetStatus: target.status,
    recoverableBefore: report.summary.recoverable,
    remainingRecoverable: report.items.filter(item => item.id !== backupId && item.recoverable).length,
    remainingRecoveryAnchors: 1,
    recoveryAnchor: { id: alternatives.anchor.id, status: alternatives.anchor.status, verified: alternatives.anchor.verified, objectCount: alternatives.availability.objectCount }
  };

  const targetAvailability = await inspectRecoveryAnchorObjects(aws, target);
  if (target.status === "check-failed" || targetAvailability.uncertain) return {
    allowed: false,
    status: "recovery-audit-uncertain",
    backupId,
    targetStatus: target.status,
    targetAvailability: targetAvailability.status,
    recoverableBefore: report.summary.recoverable,
    remainingRecoverable: report.items.filter(item => item.id !== backupId && item.recoverable).length,
    remainingRecoveryAnchors: 0,
    detail: "This snapshot could not be proven disposable and no other object-complete recovery anchor remains. Deletion is blocked until recovery readiness can be proven."
  };
  if (targetAvailability.complete) return {
    allowed: false,
    status: "last-recoverable-backup",
    backupId,
    targetStatus: target.status,
    targetAvailability: targetAvailability.status,
    recoverableBefore: report.summary.recoverable,
    remainingRecoverable: report.items.filter(item => item.id !== backupId && item.recoverable).length,
    remainingRecoveryAnchors: 0,
    detail: "Deletion would remove the last object-complete recoverable catalog snapshot. Create and verify another snapshot first."
  };
  return {
    allowed: true,
    status: "stale-backup-safe-to-delete",
    backupId,
    targetStatus: target.status,
    targetAvailability: targetAvailability.status,
    missingMedia: targetAvailability.missing.length,
    recoverableBefore: report.summary.recoverable,
    remainingRecoverable: report.items.filter(item => item.id !== backupId && item.recoverable).length,
    remainingRecoveryAnchors: 0
  };
}

export async function catalogTrashPurgeGuard(aws, ids = []) {
  const requested = Array.isArray(ids) ? ids.map(value => String(value || "").trim()).filter(Boolean) : [];
  const live = await inspectLiveCatalogState(aws);
  if (!live.readable) return {
    allowed: false,
    status: "live-catalog-recovery-required",
    selected: 0,
    candidateDeletes: 0,
    protectedDeletes: 0,
    current: live,
    detail: "Trash purge is blocked while a live catalog is missing, unreadable, or incomplete. Recover the canonical catalogs before permanently deleting Trash material."
  };
  const [data, trash] = await Promise.all([loadCatalogPair(aws), loadTrash(aws)]);
  const items = Array.isArray(trash?.items) ? trash.items : [], selected = requested.length ? items.filter(item => requested.includes(String(item?.id || ""))) : items;
  if (!selected.length) return { allowed: true, status: "nothing-to-purge", selected: 0, candidateDeletes: 0, protectedDeletes: 0 };

  const selectedIds = new Set(selected.map(item => item.id)), remaining = items.filter(item => !selectedIds.has(item.id)), keep = catalogObjectKeys(data);
  for (const item of remaining) for (const key of trashItemKeys(item)) keep.add(key);
  const candidates = new Set();
  for (const item of selected) for (const key of trashItemKeys(item)) if (!keep.has(key)) candidates.add(key);
  if (!candidates.size) return { allowed: true, status: "no-object-deletes", selected: selected.length, candidateDeletes: 0, protectedDeletes: 0 };

  const report = await auditCatalogBackups(aws), resolved = await firstCompleteRecoveryAnchor(aws, report.items), anchor = resolved.anchor;
  if (!anchor) return {
    allowed: false,
    status: resolved.uncertain ? "recovery-anchor-check-uncertain" : "no-recoverable-backup",
    selected: selected.length,
    candidateDeletes: candidates.size,
    protectedDeletes: 0,
    staleSnapshots: resolved.stale,
    uncertainSnapshots: resolved.uncertain,
    detail: resolved.uncertain
      ? "Trash purge would permanently delete storage objects, but no object-complete recovery anchor could be proven because snapshot media verification was uncertain."
      : "Trash purge would permanently delete storage objects, but no object-complete recoverable catalog snapshot is available. Create and verify a fresh snapshot first."
  };

  const protectedKeys = new Set(resolved.availability.keys), protectedDeletes = [...candidates].filter(key => protectedKeys.has(key));
  if (protectedDeletes.length) return {
    allowed: false,
    status: "purge-would-break-recovery-anchor",
    selected: selected.length,
    candidateDeletes: candidates.size,
    protectedDeletes: protectedDeletes.length,
    recoveryAnchor: { id: anchor.id, status: anchor.status, verified: anchor.verified, objectCount: resolved.availability.objectCount },
    detail: "Trash purge would delete media referenced by the current object-complete recovery anchor. Create and verify a fresh snapshot after the Trash change, then purge again."
  };
  return {
    allowed: true,
    status: "safe-to-purge",
    selected: selected.length,
    candidateDeletes: candidates.size,
    protectedDeletes: 0,
    recoveryAnchor: { id: anchor.id, status: anchor.status, verified: anchor.verified, objectCount: resolved.availability.objectCount }
  };
}

function inspectLiveCatalogText(text, key) {
  if (text === null) return { key, status: "missing", readable: false, detail: "Live catalog object is missing." };
  let payload;
  try { payload = JSON.parse(text); }
  catch { return { key, status: "invalid-json", readable: false, detail: "Live catalog object is not valid JSON." }; }
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.series)) return { key, status: "incomplete", readable: false, detail: "Live catalog object is missing its series array." };
  return { key, status: "readable", readable: true, detail: "Live catalog JSON and series structure are readable.", series: payload.series.length };
}

export async function inspectLiveCatalogState(aws) {
  const entries = [];
  for (const [scope, key] of [["main", MAIN_KEY], ["adult", ADULT_KEY]]) {
    try { entries.push({ scope, ...inspectLiveCatalogText(await getTextObject(aws, key), key) }); }
    catch (error) { entries.push({ scope, key, status: "read-failed", readable: false, detail: String(error?.message || error) }); }
  }
  const readable = entries.every(entry => entry.readable);
  return { status: readable ? "readable" : "recovery-required", readable, entries };
}

export async function emergencyRestoreCatalogBackup(aws, id) {
  const backupId = String(id || "").trim();
  const current = await inspectLiveCatalogState(aws);
  if (current.readable) return {
    ok: false,
    status: "current-readable",
    current,
    detail: "Both live catalogs are readable. Use the normal Maintenance restore so a pre-restore safety snapshot is preserved."
  };

  const meta = (await listBackups(aws)).find(item => String(item?.id || "") === backupId);
  if (!meta) return { ok: false, status: "backup-not-found", current, detail: "Requested recovery snapshot is not indexed." };
  const inspection = await inspectCatalogBackup(aws, meta);
  if (!inspection.recoverable) return {
    ok: false,
    status: "backup-unrecoverable",
    current,
    backup: inspection,
    detail: "Requested recovery snapshot failed integrity or structural verification."
  };

  const backup = await loadBackup(aws, backupId);
  if (!backup) return { ok: false, status: "backup-not-found", current, detail: "Requested recovery snapshot disappeared before restore." };
  await saveCatalogPair(aws, backup.main, backup.adult);

  const after = await inspectLiveCatalogState(aws);
  if (!after.readable) throw new Error("Emergency catalog restore wrote data but post-restore validation failed.");
  return {
    ok: true,
    status: "restored",
    restoredBackup: backupId,
    backup: { id: inspection.id, status: inspection.status, verified: inspection.verified },
    currentBefore: current,
    currentAfter: after,
    preRestoreSnapshot: "skipped-unrecoverable-current-state"
  };
}

export async function handleGuardedBackupPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const preview = await parseJson(request.clone());
  if (!preview.ok) return json({ ok: false, error: "Invalid JSON body" }, 400);
  const action = String(preview.value?.action || "").trim(), id = String(preview.value?.id || "").trim();
  if (action === "delete" && id) {
    try {
      const guard = await catalogBackupDeletionGuard(writeClient(env), id);
      if (!guard.allowed) return json({ ok: false, error: "Catalog backup deletion blocked", ...guard }, 409);
    } catch (error) {
      console.error("Catalog backup deletion safety check failed", error);
      return json({ ok: false, error: "Could not prove backup deletion is safe", detail: String(error?.message || error) }, 502);
    }
  }
  return handleBackupPost({ request, env });
}

export async function handleGuardedMaintenancePost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const preview = await parseJson(request.clone());
  if (!preview.ok) return json({ ok: false, error: "Invalid JSON body" }, 400);
  const action = String(preview.value?.action || "").trim();
  if (action === "purge-trash") {
    try {
      const guard = await catalogTrashPurgeGuard(writeClient(env), preview.value?.ids);
      if (!guard.allowed) return json({ ok: false, error: "Trash purge blocked by recovery safety", ...guard }, 409);
    } catch (error) {
      console.error("Trash purge recovery safety check failed", error);
      return json({ ok: false, error: "Could not prove Trash purge is recovery-safe", detail: String(error?.message || error) }, 502);
    }
  }
  return handleMaintenancePost({ request, env });
}

export async function handleRecoveryGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  try { return json(await auditCatalogBackups(writeClient(env))); }
  catch (error) { console.error("Recovery readiness audit failed", error); return json({ ok: false, error: "Could not verify catalog backups", detail: String(error?.message || error) }, 502); }
}

export async function handleRecoveryPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await parseJson(request); if (!body.ok) return json({ ok: false, error: "Invalid JSON body" }, 400);
  const action = String(body.value?.action || "").trim(), id = String(body.value?.id || "").trim();
  if (action !== "restore-known-good") return json({ ok: false, error: "Unknown recovery action" }, 400);
  if (!id) return json({ ok: false, error: "Backup id is required" }, 400);
  try {
    const result = await emergencyRestoreCatalogBackup(writeClient(env), id);
    if (result.status === "current-readable") return json(result, 409);
    if (result.status === "backup-not-found") return json(result, 404);
    if (result.status === "backup-unrecoverable") return json(result, 409);
    await invalidateCatalogCache(request);
    return json(result);
  } catch (error) {
    console.error("Emergency catalog recovery failed", error);
    return json({ ok: false, error: "Emergency catalog recovery failed", detail: String(error?.message || error) }, 502);
  }
}
