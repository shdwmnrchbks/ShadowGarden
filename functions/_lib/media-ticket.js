const encoder = new TextEncoder();
const DEFAULT_TTL_SECONDS = 600;
const MAX_TTL_SECONDS = 900;

function base64Url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

function secureEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function ticketingEnabled(env) {
  return typeof env?.SG_MEDIA_SIGNING_SECRET === "string" && env.SG_MEDIA_SIGNING_SECRET.length >= 32;
}

export function normalizeBookPath(value, requestUrl) {
  if (!value) return "";
  let url;
  try {
    url = new URL(String(value), requestUrl);
  } catch {
    return "";
  }
  const origin = new URL(requestUrl).origin;
  if (url.origin !== origin) return "";
  if (!url.pathname.startsWith("/media/shadow-garden/") || !url.pathname.toLowerCase().endsWith(".epub")) return "";
  if (url.pathname.includes("\\") || url.pathname.split("/").some(part => part === "." || part === "..")) return "";
  return url.pathname;
}

function payload(path, expiresAt) {
  return `sg-media-ticket-v1\n${path}\n${expiresAt}`;
}

export async function issueMediaTicket(env, book, requestUrl, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!ticketingEnabled(env)) return null;
  const path = normalizeBookPath(book, requestUrl);
  if (!path) throw new Error("Invalid EPUB media path.");
  const ttl = Math.max(60, Math.min(MAX_TTL_SECONDS, Number(ttlSeconds) || DEFAULT_TTL_SECONDS));
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const signature = await hmac(env.SG_MEDIA_SIGNING_SECRET, payload(path, expiresAt));
  const url = new URL(path, requestUrl);
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", signature);
  return { url: url.pathname + url.search, path, expiresAt, ttlSeconds: ttl };
}

export async function verifyMediaTicket(env, requestUrl) {
  if (!ticketingEnabled(env)) return { enabled: false, valid: true, reason: "disabled" };
  const url = new URL(requestUrl);
  const path = normalizeBookPath(url.pathname, requestUrl);
  if (!path) return { enabled: true, valid: false, reason: "path" };
  const expiresAt = Number(url.searchParams.get("exp"));
  const supplied = url.searchParams.get("sig") || "";
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(expiresAt) || expiresAt <= now) return { enabled: true, valid: false, reason: "expired" };
  if (expiresAt > now + MAX_TTL_SECONDS + 30) return { enabled: true, valid: false, reason: "expiry" };
  if (!supplied) return { enabled: true, valid: false, reason: "signature" };
  const expected = await hmac(env.SG_MEDIA_SIGNING_SECRET, payload(path, expiresAt));
  if (!secureEqual(supplied, expected)) return { enabled: true, valid: false, reason: "signature" };
  return { enabled: true, valid: true, path, expiresAt };
}

export function canonicalMediaCacheUrl(requestUrl) {
  const url = new URL(requestUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}
