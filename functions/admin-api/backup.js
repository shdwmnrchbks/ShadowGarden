import { adminAuthorized, deleteObject, json, putObject, writeClient } from "../_lib/b2.js";
import { BACKUP_INDEX_KEY, BACKUP_PREFIX, listBackups } from "../_lib/garden-maintenance.js";

const clean = (value, max = 180) => String(value ?? "").trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  let input;
  try { input = await request.json(); }
  catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }
  if (clean(input.action, 40) !== "delete") return json({ ok: false, error: "Unknown backup action" }, 400);

  const id = clean(input.id, 160);
  if (!id) return json({ ok: false, error: "Backup id is required" }, 400);

  try {
    const aws = writeClient(env);
    const backups = await listBackups(aws);
    const index = backups.findIndex(item => item?.id === id);
    if (index < 0) return json({ ok: false, error: "Backup not found" }, 404);
    const removed = backups[index];
    const next = backups.filter(item => item?.id !== id);
    const now = new Date().toISOString();

    await putObject(aws, BACKUP_INDEX_KEY, JSON.stringify({ version: 1, updatedAt: now, backups: next }, null, 2), {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store"
    });

    try {
      if (removed?.key?.startsWith(BACKUP_PREFIX)) await deleteObject(aws, removed.key);
    } catch (error) {
      await putObject(aws, BACKUP_INDEX_KEY, JSON.stringify({ version: 1, updatedAt: now, backups }, null, 2), {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store"
      });
      throw error;
    }

    return json({ ok: true, deletedBackup: id, remaining: next.length });
  } catch (error) {
    console.error("Catalog backup deletion failed", error);
    return json({ ok: false, error: "Could not delete catalog backup", detail: String(error?.message || error) }, 502);
  }
}
