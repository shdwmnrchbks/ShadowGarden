import { AwsClient } from "aws4fetch";

const B2_BUCKET = "shadow-garden-books-01";
const B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
const B2_REGION = "us-east-005";
const ALLOWED_PREFIX = "shadow-garden/";

function getObjectKey(value) {
  const parts = Array.isArray(value) ? value : [value];
  const clean = parts.filter(Boolean).map(String);
  if (!clean.length || clean.some(part => part === "." || part === ".." || part.includes("\\"))) return "";
  const key = clean.join("/");
  return key.startsWith(ALLOWED_PREFIX) ? key : "";
}

function encodeKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function cachePolicy(key) {
  if (key.endsWith(".json")) return "public, max-age=30, stale-while-revalidate=120";
  if (/\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(key)) return "public, max-age=31536000, immutable";
  if (key.endsWith(".epub")) return "public, max-age=600";
  return "private, no-store";
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
  const canCache = method === "GET" && !incomingRange;
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

  const aws = new AwsClient({
    accessKeyId: env.B2_READ_KEY_ID,
    secretAccessKey: env.B2_READ_APPLICATION_KEY,
    service: "s3",
    region: B2_REGION,
    retries: 2
  });

  const target = `${B2_ENDPOINT}/${B2_BUCKET}/${encodeKey(key)}`;
  let upstream;
  try {
    upstream = await aws.fetch(target, { method, headers: forwarded });
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
