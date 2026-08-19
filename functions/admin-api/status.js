import { adminAuthorized, json } from "../_lib/b2.js";

export async function onRequestPost({ request, env }) {
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);
  const missing = ["B2_WRITE_KEY_ID", "B2_WRITE_APPLICATION_KEY", "B2_READ_KEY_ID", "B2_READ_APPLICATION_KEY"]
    .filter(name => !env[name]);
  if (missing.length) return json({ ok: false, error: "Cloudflare secrets are incomplete", missing }, 503);
  return json({ ok: true, storage: "private-backblaze-b2", bucket: "shadow-garden-books-01" });
}
