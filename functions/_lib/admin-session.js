const encoder = new TextEncoder();
const SESSION_DOMAIN = "sg-admin-session-v1";
const CLOCK_SKEW_SECONDS = 60;

export const ADMIN_SESSION_COOKIE = "sg_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 3600;

function cleanEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

function signingSecret(env) {
  const value = cleanEnv(env?.SG_MEDIA_SIGNING_SECRET);
  return value.length >= 32 ? value : "";
}

function base64Url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  try {
    const raw = String(value || "");
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function cookieValue(cookieHeader, name) {
  const wanted = `${name}=`;
  for (const part of String(cookieHeader || "").split(";")) {
    const item = part.trim();
    if (item.startsWith(wanted)) return item.slice(wanted.length);
  }
  return "";
}

async function hmacKey(env, usages) {
  const secret = signingSecret(env);
  if (!secret) throw new Error("Garden Keeper session signing is unavailable");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

function payload(issuedAt, expiresAt, nonce) {
  return `${SESSION_DOMAIN}\n${issuedAt}\n${expiresAt}\n${nonce}`;
}

async function sign(env, text) {
  const key = await hmacKey(env, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return base64Url(new Uint8Array(signature));
}

async function verifySignature(env, text, signature) {
  const bytes = fromBase64Url(signature);
  if (!bytes) return false;
  try {
    const key = await hmacKey(env, ["verify"]);
    return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(text));
  } catch {
    return false;
  }
}

export async function issueAdminSession(env, now = Math.floor(Date.now() / 1000)) {
  const issuedAt = Math.floor(Number(now) || 0);
  const expiresAt = issuedAt + ADMIN_SESSION_TTL_SECONDS;
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = base64Url(nonceBytes);
  const signature = await sign(env, payload(issuedAt, expiresAt, nonce));
  return {
    token: `v1.${issuedAt}.${expiresAt}.${nonce}.${signature}`,
    issuedAt,
    expiresAt,
    ttlSeconds: ADMIN_SESSION_TTL_SECONDS
  };
}

export function adminSessionCookie(session) {
  return `${ADMIN_SESSION_COOKIE}=${session.token}; Max-Age=${session.ttlSeconds}; Path=/admin-api; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminSessionCookie() {
  return `${ADMIN_SESSION_COOKIE}=; Max-Age=0; Path=/admin-api; HttpOnly; Secure; SameSite=Strict`;
}

export async function verifyAdminSession(env, cookieHeader, now = Math.floor(Date.now() / 1000)) {
  const token = cookieValue(cookieHeader, ADMIN_SESSION_COOKIE);
  if (!token) return { valid: false, reason: "missing" };
  const match = token.match(/^v1\.(\d{1,12})\.(\d{1,12})\.([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]{32,128})$/);
  if (!match) return { valid: false, reason: "format" };
  const issuedAt = Number(match[1]);
  const expiresAt = Number(match[2]);
  const nonce = match[3];
  const signature = match[4];
  const clock = Math.floor(Number(now) || 0);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) return { valid: false, reason: "time" };
  if (issuedAt > clock + CLOCK_SKEW_SECONDS) return { valid: false, reason: "future" };
  if (expiresAt <= clock) return { valid: false, reason: "expired" };
  if (expiresAt <= issuedAt || expiresAt - issuedAt > ADMIN_SESSION_TTL_SECONDS + CLOCK_SKEW_SECONDS) return { valid: false, reason: "lifetime" };
  const valid = await verifySignature(env, payload(issuedAt, expiresAt, nonce), signature);
  return valid ? { valid: true, issuedAt, expiresAt } : { valid: false, reason: "signature" };
}
