import { adminTokenMatches, json } from "./_lib/b2.js";
import {
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  clearAdminSessionCookie,
  issueAdminSession
} from "./_lib/admin-session.js";
import {
  adminCooldown,
  clearAdminFailureCookie,
  clearAdminFailureState,
  registerAdminFailure
} from "./_lib/admin-throttle.js";
import { classifyAutomatedClient, crawlerPolicyResponseHeaders } from "./_lib/crawler-policy.js";
import { humanAccessConfig, verifyTurnstileToken } from "./_lib/human-session.js";

export const ADMIN_ACCESS_ACTION = "admin_access";

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function sameOriginBrowserRequest(request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

function jsonWithCookies(data, status = 200, headers = {}, cookies = []) {
  const responseHeaders = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  for (const cookie of cookies) if (cookie) responseHeaders.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

function genericDenied(status = 403, headers = {}, cookies = []) {
  return jsonWithCookies({ code: "admin_access_denied", error: "Access denied. Please try again." }, status, {
    ...SECURITY_HEADERS,
    ...headers
  }, cookies);
}

function unavailable() {
  return json({ code: "admin_access_unavailable", error: "Garden Keeper verification is temporarily unavailable." }, 503, SECURITY_HEADERS);
}

function automationResponse(request) {
  const automation = classifyAutomatedClient(request);
  if (!automation.blocked) return null;
  return json({ code: "admin_access_denied", error: "Access denied. Please try again." }, 403, {
    ...SECURITY_HEADERS,
    ...crawlerPolicyResponseHeaders(automation)
  });
}

function activeTurnstile(env) {
  const config = humanAccessConfig(env);
  if (config.mode !== "active") return null;
  return config;
}

export async function onRequest({ request, env }) {
  if (!sameOriginBrowserRequest(request)) return genericDenied();
  const automated = automationResponse(request);
  if (automated) return automated;

  if (request.method === "DELETE") {
    return jsonWithCookies({ ok: true }, 200, SECURITY_HEADERS, [clearAdminSessionCookie()]);
  }

  if (request.method === "GET") {
    const config = activeTurnstile(env);
    if (!config) {
      return json({ code: "admin_access_unavailable", error: "Garden Keeper verification is unavailable." }, 503, SECURITY_HEADERS);
    }
    return json({
      ok: true,
      siteKey: config.siteKey,
      action: ADMIN_ACCESS_ACTION,
      sessionTtlSeconds: ADMIN_SESSION_TTL_SECONDS
    }, 200, SECURITY_HEADERS);
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...SECURITY_HEADERS, Allow: "GET, POST, DELETE" });
  }

  const config = activeTurnstile(env);
  if (!config || !env.SG_ADMIN_TOKEN || !env.SG_MEDIA_SIGNING_SECRET) {
    return json({ code: "admin_access_unavailable", error: "Garden Keeper verification is unavailable." }, 503, SECURITY_HEADERS);
  }

  let cooldown;
  try {
    cooldown = await adminCooldown(env, request);
  } catch (error) {
    console.error("Garden Keeper throttle lookup failed", error);
    return unavailable();
  }
  if (cooldown.blocked) {
    const retryAfter = Math.max(1, cooldown.retryAfterSeconds);
    return genericDenied(429, { "Retry-After": String(retryAfter), "X-SG-Admin-Throttle": "server" });
  }

  let payload;
  try { payload = await request.json(); }
  catch { return genericDenied(); }

  const verification = await verifyTurnstileToken(env, request, payload?.turnstileToken, ADMIN_ACCESS_ACTION);
  if (!verification.valid) {
    const isUnavailable = ["timeout", "network", "invalid_response"].includes(verification.reason);
    if (isUnavailable) return unavailable();
    return genericDenied();
  }

  const tokenOk = await adminTokenMatches(String(payload?.adminToken || "").trim(), env);
  if (!tokenOk) {
    let failure;
    try {
      failure = await registerAdminFailure(env, request);
    } catch (error) {
      console.error("Garden Keeper throttle update failed", error);
      return unavailable();
    }
    const headers = {
      "X-SG-Admin-Throttle": "server",
      ...(failure.retryAfterSeconds > 0 ? { "Retry-After": String(failure.retryAfterSeconds) } : {})
    };
    return genericDenied(403, headers, [failure.cookie]);
  }

  try {
    await clearAdminFailureState(env, request);
  } catch (error) {
    console.error("Garden Keeper throttle reset failed", error);
    return unavailable();
  }

  const session = await issueAdminSession(env);
  return jsonWithCookies({
    ok: true,
    expiresAt: session.expiresAt,
    ttlSeconds: session.ttlSeconds
  }, 200, { ...SECURITY_HEADERS, "X-SG-Admin-Throttle": "server" }, [adminSessionCookie(session), clearAdminFailureCookie()]);
}
