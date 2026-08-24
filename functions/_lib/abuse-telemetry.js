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

function requestIp(requestOrIp) {
  if (typeof requestOrIp === "string") return requestOrIp.trim() || "unknown";
  const headers = requestOrIp?.headers;
  const cf = headers?.get?.("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = headers?.get?.("x-forwarded-for")?.split(",")?.[0]?.trim();
  return forwarded || "unknown";
}

export async function abuseClientId(env, requestOrIp) {
  const key = await hmacKey(env);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${CLIENT_DOMAIN}\n${requestIp(requestOrIp)}`));
  return base64Url(new Uint8Array(signature).slice(0, 24));
}

function stateKey(clientId) {
  return `${STATE_PREFIX}${clientId}.json`;
}

function defaultStore(env) {
  const reader = readClient(env);
  const writer = writeClient(env);
  return {
    get: key => getTextObject(reader, key),
    async put(key, value) {
      await putObject(writer, key, value, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store"
      });
    },
    delete: key => deleteObject(writer, key)
  };
}

function blankState() {
  return {
    version: STATE_VERSION,
    windowStartedAt: 0,
    updatedAt: 0,
    score: 0,
    signals: {},
    cooldownUntil: 0
  };
}

function validState(value, now) {
  const clock = Math.floor(Number(now) || 0);
  if (!value || Number(value.version) !== STATE_VERSION) return blankState();
  const windowStartedAt = Number(value.windowStartedAt);
  const updatedAt = Number(value.updatedAt);
  const score = Number(value.score);
  const cooldownUntil = Number(value.cooldownUntil);
  if (![windowStartedAt, updatedAt, score, cooldownUntil].every(Number.isSafeInteger)) return blankState();
  if (updatedAt > clock + MAX_CLOCK_SKEW_SECONDS || score < 0 || score > 10000 || cooldownUntil < 0) return blankState();
  const signals = {};
  for (const [name, count] of Object.entries(value.signals || {})) {
    if (!(name in ABUSE_SIGNAL_WEIGHTS)) continue;
    const numeric = Number(count);
    if (Number.isSafeInteger(numeric) && numeric > 0 && numeric < 10000) signals[name] = numeric;
  }
  return { version: STATE_VERSION, windowStartedAt, updatedAt, score, signals, cooldownUntil };
}

async function loadState(env, requestOrIp, now, storeOverride = null) {
  const clientId = await abuseClientId(env, requestOrIp);
  const key = stateKey(clientId);
  const store = storeOverride || defaultStore(env);
  const raw = await store.get(key);
  if (!raw) return { clientId, key, store, state: blankState() };
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  return { clientId, key, store, state: validState(parsed, now) };
}

function normalizeLedger(value, now) {
  const clock = Math.floor(Number(now) || 0);
  const cutoff = clock - ABUSE_LEDGER_RETENTION_SECONDS;
  const events = Array.isArray(value?.events) ? value.events : [];
  return {
    version: LEDGER_VERSION,
    updatedAt: String(value?.updatedAt || ""),
    events: events.filter(event => {
      const created = Math.floor(new Date(event?.createdAt || 0).getTime() / 1000);
      return Number.isFinite(created) && created >= cutoff;
    }).slice(0, ABUSE_LEDGER_LIMIT)
  };
}

async function loadLedgerFromStore(store, now) {
  const raw = await store.get(LEDGER_KEY);
  if (!raw) return normalizeLedger({ version: LEDGER_VERSION, events: [] }, now);
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  return normalizeLedger(parsed || {}, now);
}

async function saveLedgerToStore(store, ledger) {
  ledger.version = LEDGER_VERSION;
  ledger.updatedAt = new Date().toISOString();
  ledger.events = (Array.isArray(ledger.events) ? ledger.events : []).slice(0, ABUSE_LEDGER_LIMIT);
  await store.put(LEDGER_KEY, JSON.stringify(ledger, null, 2));
}

function safeDetail(detail = {}) {
  const out = {};
  for (const key of ["failures", "retryAfterSeconds", "category", "reason"]) {
    const value = detail?.[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = Math.max(0, Math.floor(value));
    else out[key] = String(value).slice(0, 80);
  }
  return out;
}

async function appendLedgerEvent(env, requestOrIp, event, now, storeOverride = null) {
  const store = storeOverride || defaultStore(env);
  const clientId = event.clientId || await abuseClientId(env, requestOrIp);
  const ledger = await loadLedgerFromStore(store, now);
  const entry = {
    id: `${Math.floor(Number(now) || 0)}-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date(Math.floor(Number(now) || 0) * 1000).toISOString(),
    clientId,
    releasedAt: "",
    ...event,
    clientId
  };
  ledger.events = [entry, ...ledger.events.filter(item => item?.id !== entry.id)].slice(0, ABUSE_LEDGER_LIMIT);
  await saveLedgerToStore(store, ledger);
  return entry;
}

export async function abuseCooldown(env, requestOrIp, now = Math.floor(Date.now() / 1000), storeOverride = null) {
  const clock = Math.floor(Number(now) || 0);
  const loaded = await loadState(env, requestOrIp, clock, storeOverride);
  const retryAfterSeconds = Math.max(0, loaded.state.cooldownUntil - clock);
  return {
    blocked: retryAfterSeconds > 0,
    retryAfterSeconds,
    cooldownUntil: loaded.state.cooldownUntil,
    score: loaded.state.score,
    signals: { ...loaded.state.signals },
    clientId: loaded.clientId
  };
}

export async function registerAbuseSignal(env, requestOrIp, signal, now = Math.floor(Date.now() / 1000), storeOverride = null) {
  const weight = ABUSE_SIGNAL_WEIGHTS[signal];
  if (!weight) throw new Error(`Unknown abuse signal: ${signal}`);
  const clock = Math.floor(Number(now) || 0);
  const loaded = await loadState(env, requestOrIp, clock, storeOverride);
  const prior = loaded.state;
  const activeRetry = Math.max(0, prior.cooldownUntil - clock);
  if (activeRetry > 0) {
    return {
      blocked: true,
      activated: false,
      retryAfterSeconds: activeRetry,
      cooldownUntil: prior.cooldownUntil,
      score: prior.score,
      signals: { ...prior.signals },
      clientId: loaded.clientId
    };
  }

  const priorCooldownExpired = prior.cooldownUntil > 0 && prior.cooldownUntil <= clock;
  const windowExpired = !prior.windowStartedAt || clock - prior.windowStartedAt > ABUSE_WINDOW_SECONDS;
  const base = priorCooldownExpired || windowExpired ? blankState() : prior;
  const signals = { ...base.signals, [signal]: (base.signals[signal] || 0) + 1 };
  const score = base.score + weight;
  const activated = score >= ABUSE_SCORE_LIMIT;
  const cooldownUntil = activated ? clock + ABUSE_COOLDOWN_SECONDS : 0;
  const state = {
    version: STATE_VERSION,
    windowStartedAt: base.windowStartedAt || clock,
    updatedAt: clock,
    score,
    signals,
    cooldownUntil
  };
  await loaded.store.put(loaded.key, JSON.stringify(state));

  if (activated) {
    await appendLedgerEvent(env, requestOrIp, {
      kind: "public_cooldown",
      trigger: signal,
      score,
      signals,
      cooldownUntil,
      clientId: loaded.clientId
    }, clock, loaded.store);
  }

  return {
    blocked: activated,
    activated,
    retryAfterSeconds: activated ? ABUSE_COOLDOWN_SECONDS : 0,
    cooldownUntil,
    score,
    signals,
    clientId: loaded.clientId
  };
}

export async function recordSecurityEvent(env, requestOrIp, kind, detail = {}, now = Math.floor(Date.now() / 1000), storeOverride = null) {
  return appendLedgerEvent(env, requestOrIp, {
    kind: String(kind || "security_event").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60),
    detail: safeDetail(detail),
    cooldownUntil: Number(detail?.cooldownUntil) || 0
  }, Math.floor(Number(now) || 0), storeOverride);
}

export async function loadAbuseOverview(env, now = Math.floor(Date.now() / 1000), storeOverride = null) {
  const clock = Math.floor(Number(now) || 0);
  const store = storeOverride || defaultStore(env);
  const ledger = await loadLedgerFromStore(store, clock);
  const events = ledger.events.map(event => ({ ...event }));
  const active = events.filter(event => event.kind === "public_cooldown" && !event.releasedAt && Number(event.cooldownUntil) > clock).length;
  return {
    generatedAt: new Date(clock * 1000).toISOString(),
    policy: {
      windowSeconds: ABUSE_WINDOW_SECONDS,
      scoreLimit: ABUSE_SCORE_LIMIT,
      cooldownSeconds: ABUSE_COOLDOWN_SECONDS,
      signalWeights: { ...ABUSE_SIGNAL_WEIGHTS },
      ledgerLimit: ABUSE_LEDGER_LIMIT,
      ledgerRetentionSeconds: ABUSE_LEDGER_RETENTION_SECONDS
    },
    activeCooldowns: active,
    events
  };
}

export async function releaseAbuseClient(env, clientId, now = Math.floor(Date.now() / 1000), storeOverride = null) {
  const id = String(clientId || "").trim();
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(id)) throw new Error("Invalid abuse client identifier");
  const clock = Math.floor(Number(now) || 0);
  const store = storeOverride || defaultStore(env);
  await store.delete(stateKey(id));
  const ledger = await loadLedgerFromStore(store, clock);
  const releasedAt = new Date(clock * 1000).toISOString();
  let changed = false;
  ledger.events = ledger.events.map(event => {
    if (event?.clientId !== id || event?.kind !== "public_cooldown" || event?.releasedAt) return event;
    changed = true;
    return { ...event, releasedAt };
  });
  if (changed) await saveLedgerToStore(store, ledger);
  return { clientId: id, releasedAt, changed };
}
