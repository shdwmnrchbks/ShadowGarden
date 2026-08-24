/* Shadow Garden R6 — canonical abuse policy/response service. */
import {
  abuseCooldown,
  loadAbuseOverview,
  registerAbuseSignal,
  releaseAbuseClient
} from "../_lib/abuse-telemetry.js";
import { requireAdmin } from "./auth.js";
import { defer, json, methodNotAllowed, parseJson, PRIVATE_NO_STORE_HEADERS } from "./http.js";

export async function safeAbuseCooldown(env, request, label = "Abuse cooldown lookup skipped") {
  try { return await abuseCooldown(env, request); }
  catch (error) { console.warn(label, error); return null; }
}

export function abuseCooldownResponse(cooldown) {
  const retryAfter = Math.max(1, Number(cooldown?.retryAfterSeconds) || 1);
  return json({
    code: "abuse_cooldown",
    error: "Too many suspicious access attempts were detected from this network. Please try again later.",
    retryAfterSeconds: retryAfter
  }, 429, {
    ...PRIVATE_NO_STORE_HEADERS,
    "Retry-After": String(retryAfter),
    "X-SG-Abuse-Cooldown": "active"
  });
}

export function recordAbuseSignal(context, env, request, signal, label) {
  return defer(context, registerAbuseSignal(env, request, signal), label || `Abuse telemetry failed for ${signal}`);
}

export async function handleAbuseAdmin({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: "Unauthorized." }, 401, PRIVATE_NO_STORE_HEADERS);

  if (request.method === "GET") {
    try { return json({ ok: true, ...(await loadAbuseOverview(env)) }, 200, PRIVATE_NO_STORE_HEADERS); }
    catch (error) { console.error("Abuse Watch load failed", error); return json({ error: "Could not load abuse telemetry." }, 502, PRIVATE_NO_STORE_HEADERS); }
  }
  if (request.method !== "POST") return methodNotAllowed("GET, POST", PRIVATE_NO_STORE_HEADERS);

  const body = await parseJson(request);
  if (!body.ok) return json({ error: "Invalid request body." }, 400, PRIVATE_NO_STORE_HEADERS);
  if (body.value?.action !== "release") return json({ error: "Unknown abuse-response action." }, 400, PRIVATE_NO_STORE_HEADERS);

  try {
    const released = await releaseAbuseClient(env, body.value?.clientId);
    return json({ ok: true, released, ...(await loadAbuseOverview(env)) }, 200, PRIVATE_NO_STORE_HEADERS);
  } catch (error) {
    console.error("Abuse Watch release failed", error);
    return json({ error: "Could not release this cooldown." }, 502, PRIVATE_NO_STORE_HEADERS);
  }
}
