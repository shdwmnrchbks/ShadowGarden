/* Shadow Garden v2.9 — read-only catalog recovery readiness service. */
import { BACKUP_LIMIT, BACKUP_PREFIX, listBackups } from "./catalog.js";
import { requireAdmin } from "./auth.js";
import { json } from "./http.js";
import { getTextObjectWithIntegrity, validObjectKey, writeClient } from "./storage.js";

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

export async function handleRecoveryGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  try { return json(await auditCatalogBackups(writeClient(env))); }
  catch (error) { console.error("Recovery readiness audit failed", error); return json({ ok: false, error: "Could not verify catalog backups", detail: String(error?.message || error) }, 502); }
}
