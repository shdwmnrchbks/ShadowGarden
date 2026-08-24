/* Shadow Garden R6 — small authenticated admin operations over storage/validation services. */
import { requireAdmin } from "./auth.js";
import { json } from "./http.js";
import { encodeKey, putObject, storageConfiguration, writeClient } from "./storage.js";
import { validateUploadBody, validateUploadTarget } from "./validation.js";

export async function handleAdminStatus({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const configuration = storageConfiguration(env);
  if (!configuration.configured) return json({ ok: false, error: "Cloudflare secrets are incomplete", missing: configuration.missing }, 503);
  return json({ ok: true, storage: "private-backblaze-b2", bucket: configuration.bucket });
}

export async function handleAdminUpload(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const url = new URL(request.url), key = url.searchParams.get("key") || "", type = request.headers.get("content-type") || "application/octet-stream";
  const target = validateUploadTarget(key, type, Number(request.headers.get("content-length") || 0));
  if (!target.ok) return json({ ok: false, error: target.error }, target.status);

  const body = await request.arrayBuffer(), bodyCheck = validateUploadBody(body.byteLength);
  if (!bodyCheck.ok) return json({ ok: false, error: bodyCheck.error }, bodyCheck.status);
  try {
    const headers = {
      "content-type": key.endsWith(".epub") ? "application/epub+zip" : type,
      "cache-control": key.includes("/covers/") ? "public, max-age=31536000, immutable" : "private, max-age=0"
    };
    await putObject(writeClient(env), key, body, headers);
    try {
      const mediaUrl = `${url.origin}/media/${encodeKey(key)}`;
      const eviction = caches.default.delete(new Request(mediaUrl));
      if (context.waitUntil) context.waitUntil(eviction); else await eviction;
    } catch (error) { console.warn("Uploaded media cache invalidation skipped", error); }
    return json({ ok: true, key, size: body.byteLength, url: `/media/${key}` });
  } catch (error) {
    console.error("Admin B2 upload failed", error);
    return json({ ok: false, error: "Backblaze upload failed", detail: String(error?.message || error) }, 502);
  }
}
