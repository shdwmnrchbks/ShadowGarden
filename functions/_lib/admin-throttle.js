const encoder = new TextEncoder();
const FAILURE_DOMAIN = "sg-admin-failures-v1";
const STATE_TTL_SECONDS = 1800;

export const ADMIN_FAILURE_COOKIE = "sg_admin_failures";

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
  if (!secret) throw new Error("Garden Keeper cooldown signing is unavailable");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

function payload(updatedAt, failures, cooldownUntil) {
  return `${FAILURE_DOMAIN}\n${updatedAt}\n${failures}\n${cooldownUntil}`;
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

function cooldownForFailureCount(failures) {
  if (failures <= 1) return 0;
  if (failures === 2) return 5;
  if (failures === 3) return 15;
  if (failures === 4) return 60;
  if (failures === 5) return 300;
  return 900;
}

async function verifyState(env, cookieHeader, now = Math.floor(Date.now() / 1000)) {
  const token = cookieValue(cookieHeader, ADMIN_FAILURE_COOKIE);
  if (!token) return { valid: false, failures: 0, cooldownUntil: 0, updatedAt: 0 };
  const match = token.match(/^v1\.(\d{1,12})\.(\d{1,3})\.(\d{1,12})\.([A-Za-z0-9_-]{32,128})$/);
  if (!match) return { valid: false, failures: 0, cooldownUntil: 0, updatedAt: 0 };
  const updatedAt = Number(match[1]);
  const failures = Number(match[2]);
  const cooldownUntil = Number(match[3]);
  const clock = Math.floor(Number(now) || 0);
  if (!Number.isSafeInteger(updatedAt) || !Number.isSafeInteger(failures) || !Number.isSafeInteger(cooldownUntil)) return { valid: false, failures: 0, cooldownUntil: 0, updatedAt: 0 };
  if (updatedAt > clock + 60 || clock - updatedAt > STATE_TTL_SECONDS) return { valid: false, failures: 0, cooldownUntil: 0, updatedAt: 0 };
  if (failures < 0 || failures > 999 || cooldownUntil < 0) return { valid: false, failures: 0, cooldownUntil: 0, updatedAt: 0 };
  const valid = await verifySignature(env, payload(updatedAt, failures, cooldownUntil), match[4]);
  return valid ? { valid: true, failures, cooldownUntil, updatedAt } : { valid: false, failures: 0, cooldownUntil: 0, updatedAt: 0 };
}

export async function adminCooldown(env, cookieHeader, now = Math.floor(Date.now() / 1000)) {
  const state = await verifyState(env, cookieHeader, now);
  const clock = Math.floor(Number(now) || 0);
  const retryAfterSeconds = state.valid ? Math.max(0, state.cooldownUntil - clock) : 0;
  return { ...state, retryAfterSeconds, blocked: retryAfterSeconds > 0 };
}

export async function registerAdminFailure(env, cookieHeader, now = Math.floor(Date.now() / 1000)) {
  const clock = Math.floor(Number(now) || 0);
  const prior = await verifyState(env, cookieHeader, clock);
  const failures = (prior.valid ? prior.failures : 0) + 1;
  const delay = cooldownForFailureCount(failures);
  const cooldownUntil = clock + delay;
  const signature = await sign(env, payload(clock, failures, cooldownUntil));
  const token = `v1.${clock}.${failures}.${cooldownUntil}.${signature}`;
  return {
    failures,
    retryAfterSeconds: delay,
    cookie: `${ADMIN_FAILURE_COOKIE}=${token}; Max-Age=${STATE_TTL_SECONDS}; Path=/admin-access; HttpOnly; Secure; SameSite=Strict`
  };
}

export function clearAdminFailureCookie() {
  return `${ADMIN_FAILURE_COOKIE}=; Max-Age=0; Path=/admin-access; HttpOnly; Secure; SameSite=Strict`;
}
