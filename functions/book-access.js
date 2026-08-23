import { json } from "./_lib/b2.js";
import { resolveBookReference } from "./_lib/book-resolver.js";
import {
  ACQUISITION_UNIQUE_LIMIT,
  ACQUISITION_WINDOW_SECONDS,
  evaluateAcquisition
} from "./_lib/acquisition-limit.js";
import { abuseCooldown, registerAbuseSignal } from "./_lib/abuse-telemetry.js";
import { classifyAutomatedClient, crawlerPolicyResponseHeaders } from "./_lib/crawler-policy.js";
import {
  humanAccessConfig,
  humanChallenge,
  verifyHumanSession
} from "./_lib/human-session.js";
import { issueMediaTicket, ticketCookie, ticketingEnabled } from "./_lib/media-ticket.js";

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function sameOriginBrowserRequest(request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
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

function acquisitionHeaders(result) {
  return {
    "X-SG-Acquisition-Limit": String(ACQUISITION_UNIQUE_LIMIT),
    "X-SG-Acquisition-Window": String(ACQUISITION_WINDOW_SECONDS),
    "X-SG-Acquisition-Remaining": String(Math.max(0, Number(result?.remaining) || 0))
  };
}

function deferTelemetry(context, promise, label) {
  const guarded = Promise.resolve(promise).catch(error => console.warn(label, error));
  try { context.waitUntil(guarded); }
  catch { void guarded; }
}

async function currentAbuseCooldown(env, request) {
  try { return await abuseCooldown(env, request); }
  catch (error) {
    console.warn("Abuse cooldown lookup skipped", error);
    return null;
  }
}

function abuseCooldownResponse(cooldown) {
  const retryAfter = Math.max(1, Number(cooldown?.retryAfterSeconds) || 1);
  return json({
    code: "abuse_cooldown",
    error: "Too many suspicious access attempts were detected from this network. Please try again later.",
    retryAfterSeconds: retryAfter
  }, 429, {
    ...SECURITY_HEADERS,
    "Retry-After": String(retryAfter),
    "X-SG-Abuse-Cooldown": "active"
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, Allow: "POST, OPTIONS" } });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...SECURITY_HEADERS, Allow: "POST, OPTIONS" });
  }
  if (!sameOriginBrowserRequest(request)) {
    return json({ error: "Cross-site book access is not allowed." }, 403, SECURITY_HEADERS);
  }

  const networkCooldown = await currentAbuseCooldown(env, request);
  if (networkCooldown?.blocked) return abuseCooldownResponse(networkCooldown);

  /* Known AI crawlers and obvious script/headless clients do not need a Turnstile
     challenge or catalog lookup. This remains only a cheap first filter because UAs
     are spoofable; the signed authorization layers still enforce actual access. */
  const automation = classifyAutomatedClient(request);
  if (automation.blocked) {
    console.warn("Automated book acquisition denied", automation.category, automation.signature || automation.reason);
    deferTelemetry(context, registerAbuseSignal(env, request, "automation_denied"), "Automation abuse telemetry failed");
    return json({
      code: "automated_access_denied",
      error: "Automated access is not permitted at this endpoint."
    }, 403, { ...SECURITY_HEADERS, ...crawlerPolicyResponseHeaders(automation) });
  }

  if (!ticketingEnabled(env)) {
    return json({ code: "ticketing_not_configured", error: "Signed book access is not configured yet." }, 503, {
      ...SECURITY_HEADERS,
      "X-SG-Media-Ticketing": "unavailable"
    });
  }

  const human = humanAccessConfig(env);
  if (human.mode === "misconfigured") {
    return json({ code: "human_verification_unavailable", error: "Human verification is not configured correctly." }, 503, {
      ...SECURITY_HEADERS,
      "X-SG-Human-Access": "unavailable",
      "X-SG-Media-Ticketing": "active"
    });
  }
  if (human.mode === "active") {
    const session = await verifyHumanSession(env, request.headers.get("cookie"));
    if (!session.valid) {
      return json({
        code: "human_verification_required",
        error: "Human verification is required before opening this book.",
        ...humanChallenge(env)
      }, 428, {
        ...SECURITY_HEADERS,
        "X-SG-Human-Access": "required",
        "X-SG-Media-Ticketing": "active"
      });
    }
  }

  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Invalid request body." }, 400, SECURITY_HEADERS); }
  try {
    const reference = payload?.bookId || payload?.book;
    const resolved = await resolveBookReference(env, reference);
    if (!resolved) {
      return json({ error: "Book not found." }, 404, SECURITY_HEADERS);
    }

    const acquisition = await evaluateAcquisition(env, request.headers.get("cookie"), resolved.bookId);
    if (!acquisition.allowed) {
      const retryAfter = Math.max(1, Number(acquisition.retryAfterSeconds) || ACQUISITION_WINDOW_SECONDS);
      const minutes = Math.max(1, Math.ceil(retryAfter / 60));
      deferTelemetry(context, registerAbuseSignal(env, request, "acquisition_limited"), "Acquisition-limit telemetry failed");
      return json({
        code: "acquisition_rate_limited",
        error: `Too many different books were opened recently. Please try another new book in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        retryAfterSeconds: retryAfter,
        limit: ACQUISITION_UNIQUE_LIMIT,
        windowSeconds: ACQUISITION_WINDOW_SECONDS
      }, 429, {
        ...SECURITY_HEADERS,
        ...acquisitionHeaders(acquisition),
        "Retry-After": String(retryAfter),
        "X-SG-Human-Access": human.mode === "active" ? "active" : "inactive",
        "X-SG-Media-Ticketing": "active"
      });
    }

    const ticket = await issueMediaTicket(env, resolved.file, request.url);
    return jsonWithCookies({
      url: ticket.url,
      bookId: resolved.bookId,
      expiresAt: ticket.expiresAt,
      ttlSeconds: ticket.ttlSeconds,
      protected: true
    }, 200, {
      ...SECURITY_HEADERS,
      ...acquisitionHeaders(acquisition),
      "X-SG-Automation-Policy": "pass",
      "X-SG-Human-Access": human.mode === "active" ? "active" : "inactive",
      "X-SG-Media-Ticketing": "active"
    }, [ticketCookie(ticket), acquisition.cookie]);
  } catch (error) {
    console.error("Book authorization failed", error);
    return json({ error: "Could not authorize this EPUB." }, 502, SECURITY_HEADERS);
  }
}
