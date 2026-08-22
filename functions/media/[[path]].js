import { ROOT_PREFIX, objectUrl, readClient } from "../_lib/b2.js";
import { publicCatalogShape } from "../_lib/book-id.js";
import { canonicalMediaCacheUrl, ticketingEnabled, verifyMediaTicket, verifyMediaTicketCookie } from "../_lib/media-ticket.js";

const PUBLIC_CATALOG_KEYS = new Set([
  "shadow-garden/data/catalog.json",
  "shadow-garden/data/adult-catalog.json"
]);
const PUBLIC_CATALOG_CACHE_VERSION = "opaque-v1";
const PROTECTED_CORS_HEADERS = [
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-origin",
  "access-control-expose-headers",
  "timing-allow-origin"
];

function getObjectKey(value) {
  const parts = Array.isArray(value) ? value : [value];
  const clean = parts.filter(Boolean).map(String);
  if (!clean.length || clean.some(part => part === "." || part === ".." || part.includes("\\"))) return "";
  const key = clean.join("/");
  return key.startsWith(ROOT_PREFIX) ? key : "";
}

function cachePolicy(key) {
  if (key.endsWith(".json")) return "public, max-age=30, stale-while-revalidate=120";
  if (/\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(key)) return "public, max-age=31536000, immutable";
  if (key.endsWith(".epub")) return "public, max-age=600";
  return "private, no-store";
}

function cacheableKey(key) {
  return key.endsWith(".json") || key.endsWith(".epub") || /\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(key);
}
function protectedMedia(key) { return key.endsWith(".epub") || key.endsWith(".json"); }
function publicCatalogKey(key) { return PUBLIC_CATALOG_KEYS.has(key); }
function crossSiteEpubRequest(request, key) { return key.endsWith(".epub") && request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site"; }

function applySecurityHeaders(headers, key) {
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
  const headers = applySecurityHeaders(new Headers(response.headers), key);
  return new Response(method === "HEAD" ? null : response.body, { status: response.status, statusText: response.statusText, headers });
}

function deniedEpub(key, message = "A valid Shadow Garden book ticket is required.") {
  const headers = applySecurityHeaders(new Headers({ "Cache-Control": "private, no-store" }), key);
  headers.set("X-SG-Media-Ticketing", "active");
  return new Response(message, { status: 403, headers });
}

function unavailableEpub(key) {
  const headers = applySecurityHeaders(new Headers({ "Cache-Control": "private, no-store" }), key);
  headers.set("X-SG-Media-Ticketing", "unavailable");
  return new Response("Signed EPUB access is not configured.", { status: 503, headers });
}

async function authorizedEpub(request, env) {
  const queryTicket = await verifyMediaTicket(env, request.url);
  if (queryTicket.valid) return true;
  const cookieTicket = await verifyMediaTicketCookie(env, request.url, request.headers.get("cookie"));
  return cookieTicket.valid;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: { "Allow": "GET, HEAD, OPTIONS" } });
  if (method !== "GET" && method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { "Allow": "GET, HEAD, OPTIONS" } });
  if (!env.B2_READ_KEY_ID || !env.B2_READ_APPLICATION_KEY) return new Response("Shadow Garden storage is not configured yet.", { status: 503 });

  const key = getObjectKey(params.path);
  if (!key) return new Response("Not found", { status: 404 });
  if (crossSiteEpubRequest(request, key)) return deniedEpub(key, "Cross-site EPUB access is not allowed.");
  if (key.endsWith(".epub")) {
    if (!ticketingEnabled(env)) return unavailableEpub(key);
    if (!(await authorizedEpub(request, env))) return deniedEpub(key);
  }

  const incomingRange = request.headers.get("range");
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
    const value = request.headers.get(name);
    if (value) forwarded.set(name, value);
  }

  let upstream;
  try { upstream = await readClient(env).fetch(objectUrl(key), { method, headers: forwarded }); }
  catch (error) { console.error("B2 proxy request failed", error); return new Response("Storage request failed.", { status: 502 }); }

  const headers = applySecurityHeaders(new Headers(upstream.headers), key);
  headers.set("Cache-Control", cachePolicy(key));
  headers.set("X-SG-Media-Ticketing", key.endsWith(".epub") ? "active" : "disabled");
  headers.delete("server"); headers.delete("x-amz-id-2"); headers.delete("x-amz-request-id");

  let body = method === "HEAD" ? null : upstream.body;
  if (method === "GET" && upstream.ok && publicCatalogKey(key)) {
    try {
      const raw = await upstream.json();
      body = JSON.stringify(await publicCatalogShape(raw));
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("X-SG-Catalog-View", PUBLIC_CATALOG_CACHE_VERSION);
      headers.delete("content-length");
      headers.delete("etag");
      headers.delete("content-md5");
    } catch (error) {
      console.error("Public catalog redaction failed", error);
      return new Response("Catalog transformation failed.", { status: 502, headers: { "Cache-Control": "no-store" } });
    }
  }

  const response = new Response(body, { status: upstream.status, statusText: upstream.statusText, headers });
  if (canCache && upstream.status === 200) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
