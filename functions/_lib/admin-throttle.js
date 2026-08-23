import { deleteObject, getTextObject, putObject, writeClient } from "./b2.js";

const encoder = new TextEncoder();
const FAILURE_DOMAIN = "sg-admin-failures-v2";
const CLIENT_DOMAIN = "sg-admin-client-v1";
const STATE_TTL_SECONDS = 1800;
const STATE_PREFIX = "shadow-garden/security/admin-throttle/";

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

async function hmacKey(env, usages) {
  const secret = signingSecret(env);
  if (!secret) throw new Error("Garden Keeper cooldown signing is unavailable");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

async function sign(env, text) {
  const key = await hmacKey(env, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return base64Url(new Uint8Array(signature));
}

function payload(updatedAt, failures, cooldownUntil) {
  return `${FAILURE_DOMAIN}\n${updatedAt}\n${failures}\n${cooldownUntil}`;
}

function requestIp(requestOrIp) {
  if (typeof requestOrIp === "string") return requestOrIp.trim() || "unknown";
  const headers = requestOrIp?.headers;
  const cf = headers?.get?.("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = headers?.get?.("x-forwarded-for")?.split(",")?.[0]?.trim();
  return forwarded || "unknown";
}

export async function adminThrottleClientId(env, requestOrIp) {
  const ip = requestIp(requestOrIp);
  const key = await hmacKey(env, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${CLIENT_DOMAIN}\n${ip}`));
  return base64Url(new Uint8Array(signature).slice(0, 24));
}

function stateKey(clientId) {
  return `${STATE_PREFIX}${clientId}.json`;
}

function defaultStore(env) {
  const aws = writeClient(env);
  return {
    get: key => getTextObject(aws, key),
    async put(key, value) {
      await putObject(aws, key, value, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
    },
    delete: key => deleteObject(aws, key)
  };
}

function cooldownForFailureCount(failures) {
  if (failures <= 1) return 0;
  if (failures === 2) return 5;
  if (failures === 3) return 15;
  if (failures === 4) return 60;
  if (failures === 5) return 300;
  return 900;
}

function validState(value, now) {
  const updatedAt = Number(value?.updatedAt);
  const failures = Number(value?.failures);
  const cooldownUntil = Number(value?.cooldownUntil);
  const clock = Math.floor(Number(now) || 0);
  if (!Number.isSafeInteger(updatedAt) || !Number.isSafeInteger(failures) || !Number.isSafeInteger(cooldownUntil)) return null;
  if (updatedAt > clock + 60 || clock - updatedAt > STATE_TTL_SECONDS) return null;
  if (failures < 0 || failures > 999 || cooldownUntil < 0) return null;
  return { updatedAt, failures, cooldownUntil };
}

async function readState(env, requestOrIp, now, storeOverride) {
  const clientId = await adminThrottleClientId(env, requestOrIp);
  const key = stateKey(clientId);
  const store = storeOverride || defaultStore(env);
  const raw = await store.get(key);
  if (!raw) return { clientId, key, store, state: { updatedAt: 0, failures: 0, cooldownUntil: 0 } };
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  const state = validState(parsed, now) || { updatedAt: 0, failures: 0, cooldownUntil: 0 };
  return { clientId, key, store, state };
}

function mirrorCookie(env, state) {
  return sign(env, payload(state.updatedAt, state.failures, state.cooldownUntil)).then(signature => {
    const token = `v2.${state.updatedAt}.${state.failures}.${state.cooldownUntil}.${signature}`;
    return `${ADMIN_FAILURE_COOKIE}=${token}; Max-Age=${STATE_TTL_SECONDS}; Path=/admin-access; HttpOnly; Secure; SameSite=Strict`;
  });
}

export async function adminCooldown(env, requestOrIp, now = Math.floor(Date.now() / 1000), storeOverride = null) {
  const clock = Math.floor(Number(now) || 0);
  const loaded = await readState(env, requestOrIp, clock, storeOverride);
  const retryAfterSeconds = Math.max(0, loaded.state.cooldownUntil - clock);
  return {
    valid: loaded.state.updatedAt > 0,
    failures: loaded.state.failures,
    cooldownUntil: loaded.state.cooldownUntil,
    updatedAt: loaded.state.updatedAt,
    retryAfterSeconds,
    blocked: retryAfterSeconds > 0,
    clientId: loaded.clientId,
    storage: "server"
  };
}

export async function registerAdminFailure(env, requestOrIp, now = Math.floor(Date.now() / 1000), storeOverride = null) {
  const clock = Math.floor(Number(now) || 0);
  const loaded = await readState(env, requestOrIp, clock, storeOverride);
  const failures = loaded.state.failures + 1;
  const delay = cooldownForFailureCount(failures);
  const state = { updatedAt: clock, failures, cooldownUntil: clock + delay };
  await loaded.store.put(loaded.key, JSON.stringify(state));
  return {
    failures,
    retryAfterSeconds: delay,
    cooldownUntil: state.cooldownUntil,
    clientId: loaded.clientId,
    storage: "server",
    cookie: await mirrorCookie(env, state)
  };
}

export async function clearAdminFailureState(env, requestOrIp, storeOverride = null) {
  const clientId = await adminThrottleClientId(env, requestOrIp);
  const store = storeOverride || defaultStore(env);
  await store.delete(stateKey(clientId));
  return { clientId, cleared: true };
}

export function clearAdminFailureCookie() {
  return `${ADMIN_FAILURE_COOKIE}=; Max-Age=0; Path=/admin-access; HttpOnly; Secure; SameSite=Strict`;
}
