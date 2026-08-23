import { json } from "./_lib/b2.js";
import { classifyAutomatedClient, crawlerPolicyResponseHeaders } from "./_lib/crawler-policy.js";
import {
  humanAccessConfig,
  humanSessionCookie,
  issueHumanSession,
  verifyTurnstileToken
} from "./_lib/human-session.js";

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

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, Allow: "POST, OPTIONS" } });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...SECURITY_HEADERS, Allow: "POST, OPTIONS" });
  }
  if (!sameOriginBrowserRequest(request)) {
    return json({ error: "Cross-site human verification is not allowed." }, 403, SECURITY_HEADERS);
  }

  const automation = classifyAutomatedClient(request);
  if (automation.blocked) {
    console.warn("Automated human verification denied", automation.category, automation.signature || automation.reason);
    return json({
      code: "automated_access_denied",
      error: "Automated access is not permitted at this endpoint."
    }, 403, { ...SECURITY_HEADERS, ...crawlerPolicyResponseHeaders(automation) });
  }

  const config = humanAccessConfig(env);
  if (config.mode === "inactive") {
    return json({ code: "human_verification_inactive", error: "Human verification is not enabled." }, 409, {
      ...SECURITY_HEADERS,
      "X-SG-Human-Access": "inactive"
    });
  }
  if (config.mode !== "active") {
    return json({ code: "human_verification_unavailable", error: "Human verification is not configured correctly." }, 503, {
      ...SECURITY_HEADERS,
      "X-SG-Human-Access": "unavailable"
    });
  }

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400, SECURITY_HEADERS); }

  try {
    const verification = await verifyTurnstileToken(env, request, payload?.token);
    if (!verification.valid) {
      console.warn("Turnstile verification rejected", verification.reason, verification.errorCodes || []);
      const unavailable = ["timeout", "network", "invalid_response"].includes(verification.reason);
      return json({
        code: unavailable ? "human_verification_unavailable" : "human_verification_failed",
        error: unavailable ? "Human verification is temporarily unavailable." : "Human verification was not accepted. Please try again."
      }, unavailable ? 503 : 403, {
        ...SECURITY_HEADERS,
        "X-SG-Human-Access": unavailable ? "unavailable" : "rejected"
      });
    }

    const session = await issueHumanSession(env);
    return json({ ok: true, expiresAt: session.expiresAt, ttlSeconds: session.ttlSeconds }, 200, {
      ...SECURITY_HEADERS,
      "Set-Cookie": humanSessionCookie(session),
      "X-SG-Automation-Policy": "pass",
      "X-SG-Human-Access": "active"
    });
  } catch (error) {
    console.error("Human session creation failed", error);
    return json({ code: "human_verification_unavailable", error: "Human verification is temporarily unavailable." }, 503, {
      ...SECURITY_HEADERS,
      "X-SG-Human-Access": "unavailable"
    });
  }
}
