import { json } from "./_lib/b2.js";
import { resolveBookReference } from "./_lib/book-resolver.js";
import { issueMediaTicket, ticketCookie, ticketingEnabled } from "./_lib/media-ticket.js";

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
      "X-SG-Media-Ticketing": "unavailable",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    });
  }

  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  try {
    const reference = payload?.bookId || payload?.book;
    const resolved = await resolveBookReference(env, reference);
    if (!resolved) {
      return json({ error: "Book not found." }, 404, { "X-Robots-Tag": "noindex, nofollow, noarchive" });
    }
    const ticket = await issueMediaTicket(env, resolved.file, request.url);
    return json({
      url: ticket.url,
      bookId: resolved.bookId,
      expiresAt: ticket.expiresAt,
      ttlSeconds: ticket.ttlSeconds,
      protected: true
    }, 200, {
      "Set-Cookie": ticketCookie(ticket),
      "X-SG-Media-Ticketing": "active",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    });
  } catch (error) {
    console.error("Book authorization failed", error);
    return json({ error: "Could not authorize this EPUB." }, 502, {
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    });
  }
}
