const encoder = new TextEncoder();
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TIMEOUT_MS = 10000;
const SESSION_DOMAIN = "sg-human-session-v1";
const CLOCK_SKEW_SECONDS = 60;

export const HUMAN_SESSION_COOKIE = "sg_human_session";
export const HUMAN_SESSION_TTL_SECONDS = 43200;
export const HUMAN_ACCESS_ACTION = "book_access";

function cleanEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function humanAccessConfig(env) {
  const siteKey = cleanEnv(env?.SG_TURNSTILE_SITE_KEY);
  const secretKey = cleanEnv(env?.SG_TURNSTILE_SECRET_KEY);
  if (!siteKey && !secretKey) return { mode: "inactive", siteKey: "", secretKey: "" };
  if (!siteKey || !secretKey) return { mode: "misconfigured", siteKey, secretKey };
  return { mode: "active", siteKey, secretKey };
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
    const padded = String(value || "").replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value || "").length + 3) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(env, usages) {
  const secret = signingSecret(env);
  if (!secret) throw new Error("Human session signing is unavailable");
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

function cookieValue(cookieHeader, name) {
  const wanted = `${name}=`;
  for (const part of String(cookieHeader || "").split(";")) {
    const item = part.trim();
    if (item.startsWith(wanted)) return item.slice(wanted.length);
  }
  return "";
}

export async function issueHumanSession(env, now = Math.floor(Date.now() / 1000)) {
  const issuedAt = Math.floor(Number(now) || 0);
  const expiresAt = issuedAt + HUMAN_SESSION_TTL_SECONDS;
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = base64Url(nonceBytes);
  const signature = await sign(env, payload(issuedAt, expiresAt, nonce));
  return {
    token: `v1.${issuedAt}.${expiresAt}.${nonce}.${signature}`,
    issuedAt,
    expiresAt,
    ttlSeconds: HUMAN_SESSION_TTL_SECONDS
  };
}

export function humanSessionCookie(session) {
  return `${HUMAN_SESSION_COOKIE}=${session.token}; Max-Age=${session.ttlSeconds}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export async function verifyHumanSession(env, cookieHeader, now = Math.floor(Date.now() / 1000)) {
  const token = cookieValue(cookieHeader, HUMAN_SESSION_COOKIE);
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
  if (expiresAt <= issuedAt || expiresAt - issuedAt > HUMAN_SESSION_TTL_SECONDS + CLOCK_SKEW_SECONDS) return { valid: false, reason: "lifetime" };
  const valid = await verifySignature(env, payload(issuedAt, expiresAt, nonce), signature);
  return valid ? { valid: true, issuedAt, expiresAt } : { valid: false, reason: "signature" };
}

export function humanChallenge(env) {
  const config = humanAccessConfig(env);
  return {
    siteKey: config.siteKey,
    action: HUMAN_ACCESS_ACTION,
    sessionTtlSeconds: HUMAN_SESSION_TTL_SECONDS
  };
}

export async function verifyTurnstileToken(env, request, responseToken) {
  const config = humanAccessConfig(env);
  if (config.mode !== "active") return { valid: false, reason: config.mode };
  const token = String(responseToken || "").trim();
  if (!token || token.length > 4096) return { valid: false, reason: "missing_token" };

  const form = new URLSearchParams();
  form.set("secret", config.secretKey);
  form.set("response", token);
  const remoteIp = request.headers.get("cf-connecting-ip")?.trim();
  if (remoteIp) form.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: controller.signal
    });
  } catch (error) {
    return { valid: false, reason: error?.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }

  let result;
  try { result = await response.json(); }
  catch { return { valid: false, reason: "invalid_response" }; }
  if (!response.ok || result?.success !== true) {
    return { valid: false, reason: "challenge_failed", errorCodes: Array.isArray(result?.["error-codes"]) ? result["error-codes"] : [] };
  }
  if (result?.action !== HUMAN_ACCESS_ACTION) return { valid: false, reason: "action" };
  const expectedHostname = new URL(request.url).hostname.toLowerCase();
  if (String(result?.hostname || "").toLowerCase() !== expectedHostname) return { valid: false, reason: "hostname" };
  return { valid: true, result };
}
