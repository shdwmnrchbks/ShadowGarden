import { json } from "./_lib/b2.js";
import { resolveBookReference } from "./_lib/book-resolver.js";
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
    const ticket = await issueMediaTicket(env, resolved.file, request.url);
    return json({
      url: ticket.url,
      bookId: resolved.bookId,
      expiresAt: ticket.expiresAt,
      ttlSeconds: ticket.ttlSeconds,
      protected: true
    }, 200, {
      ...SECURITY_HEADERS,
      "Set-Cookie": ticketCookie(ticket),
      "X-SG-Human-Access": human.mode === "active" ? "active" : "inactive",
      "X-SG-Media-Ticketing": "active"
    });
  } catch (error) {
    console.error("Book authorization failed", error);
    return json({ error: "Could not authorize this EPUB." }, 502, SECURITY_HEADERS);
  }
}
