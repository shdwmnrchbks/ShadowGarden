import { deleteObject, getTextObject, putObject, readClient, writeClient } from "../services/storage.js";

const encoder = new TextEncoder();
const CLIENT_DOMAIN = "sg-abuse-client-v1";
const STATE_PREFIX = "shadow-garden/security/abuse-state/";
const LEDGER_KEY = "shadow-garden/security/abuse-ledger.json";
const STATE_VERSION = 1;
const LEDGER_VERSION = 1;
const MAX_CLOCK_SKEW_SECONDS = 60;

export const ABUSE_WINDOW_SECONDS = 900;
export const ABUSE_SCORE_LIMIT = 12;
export const ABUSE_COOLDOWN_SECONDS = 600;
export const ABUSE_LEDGER_LIMIT = 100;
export const ABUSE_LEDGER_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const ABUSE_SIGNAL_WEIGHTS = Object.freeze({
  automation_denied: 4,
  turnstile_rejected: 2,
  acquisition_limited: 12,
  media_cross_site: 4,
  media_ticket_invalid: 1
});

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

async function hmacKey(env) {
  const secret = signingSecret(env);
  if (!secret) throw new Error("Abuse telemetry signing is unavailable");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function hmacId(env, domain, value) {
  const key = await hmacKey(env);
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(`${domain}\n${String(value || "")}`));
  return base64Url(new Uint8Array(bytes)).slice(0, 32);
}

function clientIp(request) {
  return cleanEnv(request?.headers?.get?.("cf-connecting-ip")) || cleanEnv(request?.headers?.get?.("x-forwarded-for")?.split(",")[0]);
}

export async function abuseClientId(env, request) {
  const ip = clientIp(request);
  if (!ip) return hmacId(env, CLIENT_DOMAIN, "unknown-network");
  return hmacId(env, CLIENT_DOMAIN, ip);
}

function stateKey(id) { return `${STATE_PREFIX}${id}.json`; }
function nowSeconds(value = Date.now()) { return Math.floor(Number(value) / 1000); }
function arr(value) { return Array.isArray(value) ? value : []; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function normalizeState(value = {}) {
  return {
    version: STATE_VERSION,
    score: Math.max(0, Number(value.score) || 0),
    windowStartedAt: Math.max(0, Number(value.windowStartedAt) || 0),
    cooldownUntil: Math.max(0, Number(value.cooldownUntil) || 0),
    lastSignalAt: Math.max(0, Number(value.lastSignalAt) || 0),
    signals: arr(value.signals).slice(-20)
  };
}

async function readJson(aws, key, fallback) {
  const text = await getTextObject(aws, key);
  if (!text) return clone(fallback);
  try { return JSON.parse(text); }
  catch { return clone(fallback); }
}

async function storeFor(env, mode = "read") {
  try { return mode === "write" ? writeClient(env) : readClient(env); }
  catch { return null; }
}

async function loadState(env, clientId, store) {
  const aws = store || await storeFor(env, "read");
  if (!aws) return normalizeState();
  return normalizeState(await readJson(aws, stateKey(clientId), {}));
}

async function saveState(env, clientId, state, store) {
  const aws = store || await storeFor(env, "write");
  if (!aws) throw new Error("Abuse telemetry persistence is unavailable");
  await putObject(aws, stateKey(clientId), JSON.stringify(normalizeState(state), null, 2), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store"
  });
}

async function deleteState(env, clientId, store) {
  const aws = store || await storeFor(env, "write");
  if (!aws) throw new Error("Abuse telemetry persistence is unavailable");
  await deleteObject(aws, stateKey(clientId));
}

async function loadLedger(env, store) {
  const aws = store || await storeFor(env, "read");
  if (!aws) return { version: LEDGER_VERSION, updatedAt: "", events: [] };
  const value = await readJson(aws, LEDGER_KEY, { version: LEDGER_VERSION, events: [] });
  return { version: LEDGER_VERSION, updatedAt: value.updatedAt || "", events: arr(value.events) };
}

async function saveLedger(env, ledger, store) {
  const aws = store || await storeFor(env, "write");
  if (!aws) throw new Error("Abuse telemetry persistence is unavailable");
  const payload = { version: LEDGER_VERSION, updatedAt: new Date().toISOString(), events: arr(ledger.events).slice(0, ABUSE_LEDGER_LIMIT) };
  await putObject(aws, LEDGER_KEY, JSON.stringify(payload, null, 2), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store"
  });
  return payload;
}

async function appendLedgerEvent(env, event, store) {
  const ledger = await loadLedger(env, store);
  const now = nowSeconds();
  const cutoff = now - ABUSE_LEDGER_RETENTION_SECONDS;
  ledger.events = [event, ...arr(ledger.events).filter(item => Number(item?.createdAtSeconds) >= cutoff)].slice(0, ABUSE_LEDGER_LIMIT);
  return saveLedger(env, ledger, store);
}

export async function registerAbuseSignal(env, request, signal, at = Date.now(), store = null) {
  const weight = Number(ABUSE_SIGNAL_WEIGHTS[signal]) || 0;
  const clientId = await abuseClientId(env, request), now = nowSeconds(at), state = await loadState(env, clientId, store);
  if (!state.windowStartedAt || now - state.windowStartedAt > ABUSE_WINDOW_SECONDS + MAX_CLOCK_SKEW_SECONDS) {
    state.score = 0; state.windowStartedAt = now; state.signals = [];
  }
  const wasBlocked = state.cooldownUntil > now;
  if (weight > 0) {
    state.score += weight; state.lastSignalAt = now; state.signals.push({ signal, weight, at: new Date(now * 1000).toISOString() }); state.signals = state.signals.slice(-20);
  }
  let activated = false;
  if (!wasBlocked && state.score >= ABUSE_SCORE_LIMIT) { state.cooldownUntil = now + ABUSE_COOLDOWN_SECONDS; activated = true; }
  await saveState(env, clientId, state, store);
  if (activated) {
    await appendLedgerEvent(env, {
      id: `${now}-${crypto.randomUUID().slice(0, 8)}`, kind: "public_cooldown", clientId, trigger: signal, score: state.score,
      createdAt: new Date(now * 1000).toISOString(), createdAtSeconds: now, cooldownUntil: state.cooldownUntil, releasedAt: ""
    }, store);
  }
  return { clientId, score: state.score, blocked: state.cooldownUntil > now, activated, retryAfterSeconds: Math.max(0, state.cooldownUntil - now), storage: "server" };
}

export async function abuseCooldown(env, request, at = Date.now(), store = null) {
  const clientId = await abuseClientId(env, request), now = nowSeconds(at), state = await loadState(env, clientId, store);
  return { clientId, score: state.score, blocked: state.cooldownUntil > now, retryAfterSeconds: Math.max(0, state.cooldownUntil - now), storage: "server" };
}

export async function releaseAbuseClient(env, clientId, at = Date.now(), store = null) {
  const id = String(clientId || "").trim(); if (!/^[A-Za-z0-9_-]{20,64}$/.test(id)) throw new Error("Invalid abuse client id");
  await deleteState(env, id, store);
  const ledger = await loadLedger(env, store), releasedAt = new Date(Number(at)).toISOString(); let changed = false;
  for (const event of ledger.events) if (event?.kind === "public_cooldown" && event.clientId === id && !event.releasedAt) { event.releasedAt = releasedAt; changed = true; }
  if (changed) await saveLedger(env, ledger, store);
  return changed;
}

export async function recordSecurityEvent(env, request, kind, detail = {}, at = Date.now(), store = null) {
  const clientId = await abuseClientId(env, request), now = nowSeconds(at);
  await appendLedgerEvent(env, {
    id: `${now}-${crypto.randomUUID().slice(0, 8)}`, kind: String(kind || "security_event").slice(0, 80), clientId,
    createdAt: new Date(now * 1000).toISOString(), createdAtSeconds: now, detail: clone(detail)
  }, store);
}

export async function loadAbuseOverview(env, at = Date.now(), store = null) {
  const now = nowSeconds(at), ledger = await loadLedger(env, store), events = arr(ledger.events).filter(item => Number(item?.createdAtSeconds) >= now - ABUSE_LEDGER_RETENTION_SECONDS);
  let activeCooldowns = 0;
  for (const event of events) if (event?.kind === "public_cooldown" && !event.releasedAt && Number(event.cooldownUntil) > now) activeCooldowns++;
  return { policy: { windowSeconds: ABUSE_WINDOW_SECONDS, scoreLimit: ABUSE_SCORE_LIMIT, cooldownSeconds: ABUSE_COOLDOWN_SECONDS }, activeCooldowns, events };
}
