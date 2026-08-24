/* Shadow Garden R6 — canonical public/admin authentication service. */
import { recordSecurityEvent } from "../_lib/abuse-telemetry.js";
import {
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  clearAdminSessionCookie,
  issueAdminSession,
  verifyAdminSession
} from "../_lib/admin-session.js";
import {
  adminCooldown,
  clearAdminFailureCookie,
  clearAdminFailureState,
  registerAdminFailure
} from "../_lib/admin-throttle.js";
import { classifyAutomatedClient, crawlerPolicyResponseHeaders } from "../_lib/crawler-policy.js";
import {
  humanAccessConfig,
  humanSessionCookie,
  issueHumanSession,
  verifyTurnstileToken
} from "../_lib/human-session.js";
import { abuseCooldown, registerAbuseSignal } from "../_lib/abuse-telemetry.js";
import { defer, json, jsonWithCookies, methodNotAllowed, parseJson, PRIVATE_NO_STORE_HEADERS, sameOriginBrowserRequest } from "./http.js";

export const ADMIN_ACCESS_ACTION = "admin_access";
const encoder = new TextEncoder();

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value || ""))));
}

export async function adminTokenMatches(supplied, env) {
  if (!env.SG_ADMIN_TOKEN || !supplied) return false;
  const [a, b] = await Promise.all([digest(supplied), digest(env.SG_ADMIN_TOKEN)]);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a[index] ^ b[index];
  return diff === 0;
}

export async function adminAuthorized(request, env) {
  const auth = request.headers.get("authorization") || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!(await adminTokenMatches(supplied, env))) return false;
  const session = await verifyAdminSession(env, request.headers.get("cookie"));
  return session.valid;
}

export async function requireAdmin(request, env) {
  try { return await adminAuthorized(request, env); }
  catch (error) {
    console.error("Garden Keeper authorization failed", error);
    return false;
  }
}

function genericAdminDenied(status = 403, headers = {}, cookies = []) {
  return jsonWithCookies({ code: "admin_access_denied", error: "Access denied. Please try again." }, status, {
    ...PRIVATE_NO_STORE_HEADERS,
    ...headers
  }, cookies);
}

function adminUnavailable() {
  return json({ code: "admin_access_unavailable", error: "Garden Keeper verification is temporarily unavailable." }, 503, PRIVATE_NO_STORE_HEADERS);
}

function adminAutomationResponse(request) {
  const automation = classifyAutomatedClient(request);
  if (!automation.blocked) return null;
  return json({ code: "admin_access_denied", error: "Access denied. Please try again." }, 403, {
    ...PRIVATE_NO_STORE_HEADERS,
    ...crawlerPolicyResponseHeaders(automation)
  });
}

function activeTurnstile(env) {
  const config = humanAccessConfig(env);
  return config.mode === "active" ? config : null;
}

export async function handleAdminAccess(context) {
  const { request, env } = context;
  if (!sameOriginBrowserRequest(request)) return genericAdminDenied();
  const automated = adminAutomationResponse(request);
  if (automated) return automated;

  if (request.method === "DELETE") {
    return jsonWithCookies({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS, [clearAdminSessionCookie()]);
  }

  if (request.method === "GET") {
    const config = activeTurnstile(env);
    if (!config) return json({ code: "admin_access_unavailable", error: "Garden Keeper verification is unavailable." }, 503, PRIVATE_NO_STORE_HEADERS);
    return json({ ok: true, siteKey: config.siteKey, action: ADMIN_ACCESS_ACTION, sessionTtlSeconds: ADMIN_SESSION_TTL_SECONDS }, 200, PRIVATE_NO_STORE_HEADERS);
  }

  if (request.method !== "POST") return methodNotAllowed("GET, POST, DELETE", PRIVATE_NO_STORE_HEADERS);
  const config = activeTurnstile(env);
  if (!config || !env.SG_ADMIN_TOKEN || !env.SG_MEDIA_SIGNING_SECRET) {
    return json({ code: "admin_access_unavailable", error: "Garden Keeper verification is unavailable." }, 503, PRIVATE_NO_STORE_HEADERS);
  }

  let cooldown;
  try { cooldown = await adminCooldown(env, request); }
  catch (error) { console.error("Garden Keeper throttle lookup failed", error); return adminUnavailable(); }
  if (cooldown.blocked) {
    const retryAfter = Math.max(1, cooldown.retryAfterSeconds);
    return genericAdminDenied(429, { "Retry-After": String(retryAfter), "X-SG-Admin-Throttle": "server" });
  }

  const body = await parseJson(request);
  if (!body.ok) return genericAdminDenied();
  const payload = body.value;
  const verification = await verifyTurnstileToken(env, request, payload?.turnstileToken, ADMIN_ACCESS_ACTION);
  if (!verification.valid) {
    if (["timeout", "network", "invalid_response"].includes(verification.reason)) return adminUnavailable();
    return genericAdminDenied();
  }

  if (!(await adminTokenMatches(String(payload?.adminToken || "").trim(), env))) {
    let failure;
    try { failure = await registerAdminFailure(env, request); }
    catch (error) { console.error("Garden Keeper throttle update failed", error); return adminUnavailable(); }
    if (failure.retryAfterSeconds >= 60) {
      defer(context, recordSecurityEvent(env, request, "admin_cooldown", {
        failures: failure.failures,
        retryAfterSeconds: failure.retryAfterSeconds
      }), "Garden Keeper abuse telemetry failed");
    }
    return genericAdminDenied(403, {
      "X-SG-Admin-Throttle": "server",
      ...(failure.retryAfterSeconds > 0 ? { "Retry-After": String(failure.retryAfterSeconds) } : {})
    }, [failure.cookie]);
  }

  try { await clearAdminFailureState(env, request); }
  catch (error) { console.error("Garden Keeper throttle reset failed", error); return adminUnavailable(); }

  const session = await issueAdminSession(env);
  return jsonWithCookies({ ok: true, expiresAt: session.expiresAt, ttlSeconds: session.ttlSeconds }, 200, {
    ...PRIVATE_NO_STORE_HEADERS,
    "X-SG-Admin-Throttle": "server"
  }, [adminSessionCookie(session), clearAdminFailureCookie()]);
}

async function currentAbuseCooldown(env, request) {
  try { return await abuseCooldown(env, request); }
  catch (error) { console.warn("Human-access abuse cooldown lookup skipped", error); return null; }
}

export async function handleHumanAccess(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...PRIVATE_NO_STORE_HEADERS, Allow: "POST, OPTIONS" } });
  if (request.method !== "POST") return methodNotAllowed("POST, OPTIONS", PRIVATE_NO_STORE_HEADERS);
  if (!sameOriginBrowserRequest(request)) return json({ error: "Cross-site human verification is not allowed." }, 403, PRIVATE_NO_STORE_HEADERS);

  const networkCooldown = await currentAbuseCooldown(env, request);
  if (networkCooldown?.blocked) {
    const retryAfter = Math.max(1, Number(networkCooldown.retryAfterSeconds) || 1);
    return json({ code: "abuse_cooldown", error: "Too many suspicious access attempts were detected from this network. Please try again later.", retryAfterSeconds: retryAfter }, 429, {
      ...PRIVATE_NO_STORE_HEADERS,
      "Retry-After": String(retryAfter),
      "X-SG-Abuse-Cooldown": "active"
    });
  }

  const automation = classifyAutomatedClient(request);
  if (automation.blocked) {
    console.warn("Automated human verification denied", automation.category, automation.signature || automation.reason);
    defer(context, registerAbuseSignal(env, request, "automation_denied"), "Human automation telemetry failed");
    return json({ code: "automated_access_denied", error: "Automated access is not permitted at this endpoint." }, 403, {
      ...PRIVATE_NO_STORE_HEADERS,
      ...crawlerPolicyResponseHeaders(automation)
    });
  }

  const config = humanAccessConfig(env);
  if (config.mode === "inactive") return json({ code: "human_verification_inactive", error: "Human verification is not enabled." }, 409, { ...PRIVATE_NO_STORE_HEADERS, "X-SG-Human-Access": "inactive" });
  if (config.mode !== "active") return json({ code: "human_verification_unavailable", error: "Human verification is not configured correctly." }, 503, { ...PRIVATE_NO_STORE_HEADERS, "X-SG-Human-Access": "unavailable" });

  const body = await parseJson(request);
  if (!body.ok) return json({ error: "Invalid request body." }, 400, PRIVATE_NO_STORE_HEADERS);
  try {
    const verification = await verifyTurnstileToken(env, request, body.value?.token);
    if (!verification.valid) {
      console.warn("Turnstile verification rejected", verification.reason, verification.errorCodes || []);
      const unavailable = ["timeout", "network", "invalid_response"].includes(verification.reason);
      if (!unavailable) defer(context, registerAbuseSignal(env, request, "turnstile_rejected"), "Turnstile rejection telemetry failed");
      return json({
        code: unavailable ? "human_verification_unavailable" : "human_verification_failed",
        error: unavailable ? "Human verification is temporarily unavailable." : "Human verification was not accepted. Please try again."
      }, unavailable ? 503 : 403, { ...PRIVATE_NO_STORE_HEADERS, "X-SG-Human-Access": unavailable ? "unavailable" : "rejected" });
    }

    const session = await issueHumanSession(env);
    return json({ ok: true, expiresAt: session.expiresAt, ttlSeconds: session.ttlSeconds }, 200, {
      ...PRIVATE_NO_STORE_HEADERS,
      "Set-Cookie": humanSessionCookie(session),
      "X-SG-Automation-Policy": "pass",
      "X-SG-Human-Access": "active"
    });
  } catch (error) {
    console.error("Human session creation failed", error);
    return json({ code: "human_verification_unavailable", error: "Human verification is temporarily unavailable." }, 503, { ...PRIVATE_NO_STORE_HEADERS, "X-SG-Human-Access": "unavailable" });
  }
}
