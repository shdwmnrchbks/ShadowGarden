import { loadAbuseOverview, releaseAbuseClient } from "../_lib/abuse-telemetry.js";
import { adminAuthorized, json } from "../_lib/b2.js";

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

async function authorized(request, env) {
  try { return await adminAuthorized(request, env); }
  catch (error) {
    console.error("Abuse Watch authorization failed", error);
    return false;
  }
}

export async function onRequest({ request, env }) {
  if (!(await authorized(request, env))) {
    return json({ error: "Unauthorized." }, 401, SECURITY_HEADERS);
  }

  if (request.method === "GET") {
    try {
      return json({ ok: true, ...(await loadAbuseOverview(env)) }, 200, SECURITY_HEADERS);
    } catch (error) {
      console.error("Abuse Watch load failed", error);
      return json({ error: "Could not load abuse telemetry." }, 502, SECURITY_HEADERS);
    }
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...SECURITY_HEADERS, Allow: "GET, POST" });
  }

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400, SECURITY_HEADERS); }

  if (payload?.action !== "release") {
    return json({ error: "Unknown abuse-response action." }, 400, SECURITY_HEADERS);
  }

  try {
    const released = await releaseAbuseClient(env, payload?.clientId);
    return json({ ok: true, released, ...(await loadAbuseOverview(env)) }, 200, SECURITY_HEADERS);
  } catch (error) {
    console.error("Abuse Watch release failed", error);
    return json({ error: "Could not release this cooldown." }, 502, SECURITY_HEADERS);
  }
}
