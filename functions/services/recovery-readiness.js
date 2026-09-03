/* Shadow Garden v2.9 — read-only recovery-readiness report composition. */
import { requireAdmin } from "./auth.js";
import { json } from "./http.js";
import {
  auditCatalogBackups,
  inspectLiveCatalogState,
  inspectRecoveryAnchorObjects
} from "./recovery.js";
import { readClient } from "./storage.js";

function readinessAnchor(item, availability) {
  return {
    id: item.id,
    createdAt: item.createdAt,
    reason: item.reason,
    status: item.status,
    verified: Boolean(item.verified),
    objectCount: availability.objectCount
  };
}

export async function buildRecoveryReadinessReport(aws) {
  const [backups, live] = await Promise.all([
    auditCatalogBackups(aws),
    inspectLiveCatalogState(aws)
  ]);

  let anchor = null, legacyAnchor = null, checked = 0, stale = 0, uncertain = 0;
  for (const item of backups.items || []) {
    if (item?.status === "check-failed") { uncertain += 1; continue; }
    if (!item?.recoverable) continue;
    const availability = await inspectRecoveryAnchorObjects(aws, item); checked += 1;
    if (availability.complete) {
      const candidate = readinessAnchor(item, availability);
      if (candidate.verified) { anchor = candidate; break; }
      if (!legacyAnchor) legacyAnchor = candidate;
      continue;
    }
    if (availability.uncertain) uncertain += 1;
    else stale += 1;
  }
  if (!anchor) anchor = legacyAnchor;

  const status = !live.readable
    ? "recovery-required"
    : anchor?.verified
      ? "ready"
      : anchor
        ? "not-ready"
        : uncertain
          ? "check-required"
          : "not-ready";

  const detail = status === "ready"
    ? "Live catalogs are readable and a checksum-verified, object-complete recovery anchor is available."
    : status === "recovery-required"
      ? "At least one live catalog requires recovery before destructive maintenance can be considered safe."
      : status === "check-required"
        ? "No object-complete recovery anchor could be proven because snapshot or media verification was uncertain."
        : anchor
          ? "An object-complete legacy snapshot is available, but it is not checksum-verified. Create and verify a fresh catalog snapshot before treating recovery as ready."
          : "No object-complete recovery anchor is available. Create and verify a fresh catalog snapshot.";

  return {
    ...backups,
    live,
    readiness: {
      status,
      ready: status === "ready",
      detail,
      anchor,
      checkedSnapshots: checked,
      staleSnapshots: stale,
      uncertainSnapshots: uncertain
    }
  };
}

export async function handleRecoveryReadinessGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  try { return json(await buildRecoveryReadinessReport(readClient(env))); }
  catch (error) {
    console.error("Recovery readiness report failed", error);
    return json({ ok: false, error: "Could not compute recovery readiness", detail: String(error?.message || error) }, 502);
  }
}
