import { ROOT_PREFIX, objectUrl, readClient } from "../_lib/b2.js";

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

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Allow": "GET, HEAD, OPTIONS" } });
  }
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { "Allow": "GET, HEAD, OPTIONS" } });
  }
  if (!env.B2_READ_KEY_ID || !env.B2_READ_APPLICATION_KEY) {
    return new Response("Shadow Garden storage is not configured yet.", { status: 503 });
  }

  const key = getObjectKey(params.path);
  if (!key) return new Response("Not found", { status: 404 });

  const incomingRange = request.headers.get("range");
  const canCache = method === "GET" && !incomingRange && cacheableKey(key);
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });

  if (canCache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const forwarded = new Headers();
  for (const name of ["range", "if-none-match", "if-modified-since", "if-range"]) {
    const value = request.headers.get(name);
    if (value) forwarded.set(name, value);
  }

  let upstream;
  try {
    upstream = await readClient(env).fetch(objectUrl(key), { method, headers: forwarded });
  } catch (error) {
    console.error("B2 proxy request failed", error);
    return new Response("Storage request failed.", { status: 502 });
  }

  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", cachePolicy(key));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.delete("server");
  headers.delete("x-amz-id-2");
  headers.delete("x-amz-request-id");

  const response = new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });

  if (canCache && upstream.status === 200) {
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}
