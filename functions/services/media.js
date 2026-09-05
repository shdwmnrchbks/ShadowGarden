/* Shadow Garden R6 — canonical book authorization and private media delivery service. */
import { resolveBookReference } from "../_lib/book-resolver.js";
import { ACQUISITION_UNIQUE_LIMIT, ACQUISITION_WINDOW_SECONDS, evaluateAcquisition } from "../_lib/acquisition-limit.js";
import { classifyAutomatedClient, crawlerPolicyResponseHeaders } from "../_lib/crawler-policy.js";
import { humanAccessConfig, humanChallenge, verifyHumanSession } from "../_lib/human-session.js";
import { canonicalMediaCacheUrl, issueMediaTicket, ticketCookie, ticketingEnabled, verifyMediaTicket, verifyMediaTicketCookie } from "../_lib/media-ticket.js";
import { publicCatalogShape } from "../_lib/book-id.js";
import { abuseCooldownResponse, recordAbuseSignal, safeAbuseCooldown } from "./abuse.js";
import { json, jsonWithCookies, methodNotAllowed, parseJson, PRIVATE_NO_STORE_HEADERS, sameOriginBrowserRequest } from "./http.js";
import { objectUrl, readClient, ROOT_PREFIX } from "./storage.js";

const PUBLIC_CATALOG_KEYS = new Set(["shadow-garden/data/catalog.json", "shadow-garden/data/adult-catalog.json"]);
const PUBLIC_CATALOG_CACHE_VERSION = "opaque-v1";
const PUBLIC_COVER_KEY = /^shadow-garden\/covers\/.+\.(?:jpe?g|png|webp|avif|gif|svg)$/i;
const PUBLIC_EPUB_KEY = /^shadow-garden\/books\/.+\.epub$/i;
const PROTECTED_CORS_HEADERS = ["access-control-allow-credentials", "access-control-allow-headers", "access-control-allow-methods", "access-control-allow-origin", "access-control-expose-headers", "timing-allow-origin"];

function acquisitionHeaders(result) {
  return {
    "X-SG-Acquisition-Limit": String(ACQUISITION_UNIQUE_LIMIT),
    "X-SG-Acquisition-Window": String(ACQUISITION_WINDOW_SECONDS),
    "X-SG-Acquisition-Remaining": String(Math.max(0, Number(result?.remaining) || 0))
  };
}

export async function handleBookAccess(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...PRIVATE_NO_STORE_HEADERS, Allow: "POST, OPTIONS" } });
  if (request.method !== "POST") return methodNotAllowed("POST, OPTIONS", PRIVATE_NO_STORE_HEADERS);
  if (!sameOriginBrowserRequest(request)) return json({ error: "Cross-site book access is not allowed." }, 403, PRIVATE_NO_STORE_HEADERS);

  const networkCooldown = await safeAbuseCooldown(env, request, "Abuse cooldown lookup skipped");
  if (networkCooldown?.blocked) return abuseCooldownResponse(networkCooldown);

  const automation = classifyAutomatedClient(request);
  if (automation.blocked) {
    console.warn("Automated book acquisition denied", automation.category, automation.signature || automation.reason);
    recordAbuseSignal(context, env, request, "automation_denied", "Automation abuse telemetry failed");
    return json({ code: "automated_access_denied", error: "Automated access is not permitted at this endpoint." }, 403, { ...PRIVATE_NO_STORE_HEADERS, ...crawlerPolicyResponseHeaders(automation) });
  }

  if (!ticketingEnabled(env)) return json({ code: "ticketing_not_configured", error: "Signed book access is not configured yet." }, 503, { ...PRIVATE_NO_STORE_HEADERS, "X-SG-Media-Ticketing": "unavailable" });

  const human = humanAccessConfig(env);
  if (human.mode === "misconfigured") return json({ code: "human_verification_unavailable", error: "Human verification is not configured correctly." }, 503, { ...PRIVATE_NO_STORE_HEADERS, "X-SG-Human-Access": "unavailable", "X-SG-Media-Ticketing": "active" });
  if (human.mode === "active") {
    const session = await verifyHumanSession(env, request.headers.get("cookie"));
    if (!session.valid) return json({ code: "human_verification_required", error: "Human verification is required before opening this book.", ...humanChallenge(env) }, 428, { ...PRIVATE_NO_STORE_HEADERS, "X-SG-Human-Access": "required", "X-SG-Media-Ticketing": "active" });
  }

  const body = await parseJson(request);
  if (!body.ok) return json({ error: "Invalid request body." }, 400, PRIVATE_NO_STORE_HEADERS);
  try {
    const reference = body.value?.bookId || body.value?.book;
    const resolved = await resolveBookReference(env, reference);
    if (!resolved) return json({ error: "Book not found." }, 404, PRIVATE_NO_STORE_HEADERS);

    const acquisition = await evaluateAcquisition(env, request.headers.get("cookie"), resolved.bookId);
    if (!acquisition.allowed) {
      const retryAfter = Math.max(1, Number(acquisition.retryAfterSeconds) || ACQUISITION_WINDOW_SECONDS);
      const minutes = Math.max(1, Math.ceil(retryAfter / 60));
      recordAbuseSignal(context, env, request, "acquisition_limited", "Acquisition-limit telemetry failed");
      return json({
        code: "acquisition_rate_limited",
        error: `Too many different books were opened recently. Please try another new book in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        retryAfterSeconds: retryAfter,
        limit: ACQUISITION_UNIQUE_LIMIT,
        windowSeconds: ACQUISITION_WINDOW_SECONDS
      }, 429, {
        ...PRIVATE_NO_STORE_HEADERS,
        ...acquisitionHeaders(acquisition),
        "Retry-After": String(retryAfter),
        "X-SG-Human-Access": human.mode === "active" ? "active" : "inactive",
        "X-SG-Media-Ticketing": "active"
      });
    }

    const ticket = await issueMediaTicket(env, resolved.file, request.url);
    return jsonWithCookies({ url: ticket.url, bookId: resolved.bookId, expiresAt: ticket.expiresAt, ttlSeconds: ticket.ttlSeconds, protected: true }, 200, {
      ...PRIVATE_NO_STORE_HEADERS,
      ...acquisitionHeaders(acquisition),
      "X-SG-Automation-Policy": "pass",
      "X-SG-Human-Access": human.mode === "active" ? "active" : "inactive",
      "X-SG-Media-Ticketing": "active"
    }, [ticketCookie(ticket), acquisition.cookie]);
  } catch (error) {
    console.error("Book authorization failed", error);
    return json({ error: "Could not authorize this EPUB." }, 502, PRIVATE_NO_STORE_HEADERS);
  }
}

function getObjectKey(value) {
  const parts = Array.isArray(value) ? value : [value];
  const clean = parts.filter(Boolean).map(String);
  if (!clean.length || clean.some(part => part === "." || part === ".." || part.includes("\\"))) return "";
  const key = clean.join("/");
  return key.startsWith(ROOT_PREFIX) ? key : "";
}

const publicCatalogKey = key => PUBLIC_CATALOG_KEYS.has(key);
const publicMediaKey = key => publicCatalogKey(key) || PUBLIC_COVER_KEY.test(key) || PUBLIC_EPUB_KEY.test(key);
const cacheableKey = key => key.endsWith(".json") || key.endsWith(".epub") || /\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(key);
const protectedMedia = key => key.endsWith(".epub") || key.endsWith(".json");
const crossSiteEpubRequest = (request, key) => key.endsWith(".epub") && request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site";

function privateObjectResponse() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet" } });
}

function cachePolicy(key) {
  if (key.endsWith(".json")) return "public, max-age=30, stale-while-revalidate=120";
  if (/\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(key)) return "public, max-age=31536000, immutable";
  if (key.endsWith(".epub")) return "public, max-age=600";
  return "private, no-store";
}

function applyMediaSecurityHeaders(headers, key) {
  headers.set("X-Content-Type-Options", "nosniff");
  if (!protectedMedia(key)) return headers;
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  for (const name of PROTECTED_CORS_HEADERS) headers.delete(name);
  if (key.endsWith(".epub")) {
    const vary = new Set(String(headers.get("Vary") || "").split(",").map(value => value.trim()).filter(Boolean));
    vary.add("Sec-Fetch-Site");
    headers.set("Vary", [...vary].join(", "));
  }
  return headers;
}

function securedResponse(response, key, method = "GET") {
  const headers = applyMediaSecurityHeaders(new Headers(response.headers), key);
  return new Response(method === "HEAD" ? null : response.body, { status: response.status, statusText: response.statusText, headers });
}

function deniedEpub(key, message = "A valid Shadow Garden book ticket is required.") {
  const headers = applyMediaSecurityHeaders(new Headers({ "Cache-Control": "private, no-store" }), key);
  headers.set("X-SG-Media-Ticketing", "active");
  return new Response(message, { status: 403, headers });
}

function unavailableEpub(key) {
  const headers = applyMediaSecurityHeaders(new Headers({ "Cache-Control": "private, no-store" }), key);
  headers.set("X-SG-Media-Ticketing", "unavailable");
  return new Response("Signed EPUB access is not configured.", { status: 503, headers });
}

async function authorizedEpub(request, env) {
  const queryTicket = await verifyMediaTicket(env, request.url);
  if (queryTicket.valid) return true;
  const cookieTicket = await verifyMediaTicketCookie(env, request.url, request.headers.get("cookie"));
  return cookieTicket.valid;
}

export async function handleMediaRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "GET, HEAD, OPTIONS" } });
  if (method !== "GET" && method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD, OPTIONS" } });
  if (!env.B2_READ_KEY_ID || !env.B2_READ_APPLICATION_KEY) return new Response("Shadow Garden storage is not configured yet.", { status: 503 });

  const key = getObjectKey(params.path);
  if (!key || !publicMediaKey(key)) return privateObjectResponse();
  const incomingRange = request.headers.get("range");
  if (crossSiteEpubRequest(request, key)) {
    console.warn("Cross-site EPUB request denied");
    recordAbuseSignal(context, env, request, "media_cross_site", "Cross-site media telemetry failed");
    return deniedEpub(key, "Cross-site EPUB access is not allowed.");
  }
  if (key.endsWith(".epub")) {
    if (!ticketingEnabled(env)) return unavailableEpub(key);
    if (!(await authorizedEpub(request, env))) {
      console.warn("EPUB request denied for missing or invalid ticket", incomingRange ? "range" : "full");
      if (!incomingRange) recordAbuseSignal(context, env, request, "media_ticket_invalid", "Invalid-ticket telemetry failed");
      return deniedEpub(key);
    }
  }

  const canCache = method === "GET" && !incomingRange && cacheableKey(key);
  const cache = caches.default;
  const cacheUrl = key.endsWith(".epub") ? canonicalMediaCacheUrl(request.url) : request.url;
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  if (canCache) {
    const cached = await cache.match(cacheKey);
    const catalogCacheValid = !publicCatalogKey(key) || cached?.headers.get("X-SG-Catalog-View") === PUBLIC_CATALOG_CACHE_VERSION;
    if (cached && catalogCacheValid) return securedResponse(cached, key, method);
  }

  const forwarded = new Headers();
  for (const name of ["range", "if-none-match", "if-modified-since", "if-range"]) {
    const value = request.headers.get(name); if (value) forwarded.set(name, value);
  }

  let upstream;
  try { upstream = await readClient(env).fetch(objectUrl(key), { method, headers: forwarded }); }
  catch (error) { console.error("B2 proxy request failed", error); return new Response("Storage request failed.", { status: 502 }); }

  const headers = applyMediaSecurityHeaders(new Headers(upstream.headers), key);
  headers.set("Cache-Control", cachePolicy(key));
  headers.set("X-SG-Media-Ticketing", key.endsWith(".epub") ? "active" : "disabled");
  headers.delete("server"); headers.delete("x-amz-id-2"); headers.delete("x-amz-request-id");

  let body = method === "HEAD" ? null : upstream.body;
  if (method === "GET" && upstream.ok && publicCatalogKey(key)) {
    try {
      body = JSON.stringify(await publicCatalogShape(await upstream.json()));
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("X-SG-Catalog-View", PUBLIC_CATALOG_CACHE_VERSION);
      headers.delete("content-length"); headers.delete("etag"); headers.delete("content-md5");
    } catch (error) {
      console.error("Public catalog redaction failed", error);
      return new Response("Catalog transformation failed.", { status: 502, headers: { "Cache-Control": "no-store" } });
    }
  }

  const response = new Response(body, { status: upstream.status, statusText: upstream.statusText, headers });
  if (canCache && upstream.status === 200) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
