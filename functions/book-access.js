import { json } from "./_lib/b2.js";
import { issueMediaTicket, ticketingEnabled } from "./_lib/media-ticket.js";

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
    return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" } });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { Allow: "POST, OPTIONS" });
  }
  if (!sameOriginBrowserRequest(request)) {
    return json({ error: "Cross-site book access is not allowed." }, 403, { "X-Robots-Tag": "noindex, nofollow, noarchive" });
  }
  if (!ticketingEnabled(env)) {
    return json({ code: "ticketing_not_configured", error: "Signed book access is not configured yet." }, 503, {
      "X-SG-Media-Ticketing": "disabled",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    });
  }

  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  try {
    const ticket = await issueMediaTicket(env, payload?.book, request.url);
    return json({
      url: ticket.url,
      expiresAt: ticket.expiresAt,
      ttlSeconds: ticket.ttlSeconds,
      protected: true
    }, 200, {
      "X-SG-Media-Ticketing": "active",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    });
  } catch (error) {
    return json({ error: error?.message || "Could not authorize this EPUB." }, 400, {
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    });
  }
}
