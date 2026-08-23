const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ACQUISITION_DOMAIN = "sg-acquisition-window-v1";
const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_LENGTH = 3500;
const MAX_DECODED_ENTRIES = 40;
const BOOK_ID = /^bk_[A-Za-z0-9_-]{22}$/;

export const ACQUISITION_COOKIE = "sg_acquisition_window";
export const ACQUISITION_WINDOW_SECONDS = 600;
export const ACQUISITION_UNIQUE_LIMIT = 20;

function signingSecret(env) {
  const value = typeof env?.SG_MEDIA_SIGNING_SECRET === "string" ? env.SG_MEDIA_SIGNING_SECRET.trim() : "";
  return value.length >= 32 ? value : "";
}

function base64Url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  try {
    const text = String(value || "");
    const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(env, usages) {
  const secret = signingSecret(env);
  if (!secret) throw new Error("Acquisition throttling signing is unavailable");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

async function sign(env, payload) {
  const key = await hmacKey(env, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64Url(new Uint8Array(signature));
}

async function verifySignature(env, payload, signature) {
  const bytes = fromBase64Url(signature);
  if (!bytes) return false;
  try {
    const key = await hmacKey(env, ["verify"]);
    return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(payload));
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

function payload(encodedState) {
  return `${ACQUISITION_DOMAIN}\n${encodedState}`;
}

function encodeEntries(entries) {
  const compact = entries.map(entry => [entry.bookId, entry.at]);
  return base64Url(encoder.encode(JSON.stringify(compact)));
}

function decodeEntries(encodedState, now) {
  const bytes = fromBase64Url(encodedState);
  if (!bytes) return null;
  let parsed;
  try { parsed = JSON.parse(decoder.decode(bytes)); }
  catch { return null; }
  if (!Array.isArray(parsed) || parsed.length > MAX_DECODED_ENTRIES) return null;

  const clock = Math.floor(Number(now) || 0);
  const cutoff = clock - ACQUISITION_WINDOW_SECONDS;
  const byBook = new Map();
  for (const item of parsed) {
    if (!Array.isArray(item) || item.length !== 2) return null;
    const bookId = String(item[0] || "");
    const at = Number(item[1]);
    if (!BOOK_ID.test(bookId) || !Number.isSafeInteger(at)) return null;
    if (at > clock + CLOCK_SKEW_SECONDS) return null;
    if (at <= cutoff) continue;
    const previous = byBook.get(bookId);
    if (!previous || at > previous.at) byBook.set(bookId, { bookId, at });
  }
  return [...byBook.values()].sort((a, b) => a.at - b.at || a.bookId.localeCompare(b.bookId));
}

async function tokenForEntries(env, entries) {
  const encodedState = encodeEntries(entries);
  const signature = await sign(env, payload(encodedState));
  return `v1.${encodedState}.${signature}`;
}

export function acquisitionCookie(token) {
  return `${ACQUISITION_COOKIE}=${token}; Max-Age=${ACQUISITION_WINDOW_SECONDS}; Path=/book-access; HttpOnly; Secure; SameSite=Strict`;
}

export async function verifyAcquisitionState(env, cookieHeader, now = Math.floor(Date.now() / 1000)) {
  const token = cookieValue(cookieHeader, ACQUISITION_COOKIE);
  if (!token) return { valid: false, reason: "missing", entries: [] };
  if (token.length > MAX_TOKEN_LENGTH) return { valid: false, reason: "length", entries: [] };
  const match = token.match(/^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{32,128})$/);
  if (!match) return { valid: false, reason: "format", entries: [] };
  const encodedState = match[1];
  const signature = match[2];
  if (!(await verifySignature(env, payload(encodedState), signature))) return { valid: false, reason: "signature", entries: [] };
  const entries = decodeEntries(encodedState, now);
  if (!entries) return { valid: false, reason: "state", entries: [] };
  return { valid: true, reason: "ok", entries };
}

export async function evaluateAcquisition(env, cookieHeader, bookId, now = Math.floor(Date.now() / 1000)) {
  const id = String(bookId || "");
  if (!BOOK_ID.test(id)) throw new Error("Acquisition throttling requires an opaque book ID");
  const clock = Math.floor(Number(now) || 0);
  const state = await verifyAcquisitionState(env, cookieHeader, clock);
  const entries = state.valid ? [...state.entries] : [];
  const existing = entries.find(entry => entry.bookId === id);

  if (!existing && entries.length >= ACQUISITION_UNIQUE_LIMIT) {
    const earliest = entries[0]?.at || clock;
    const retryAfterSeconds = Math.max(1, earliest + ACQUISITION_WINDOW_SECONDS - clock);
    return {
      allowed: false,
      newBook: true,
      count: entries.length,
      remaining: 0,
      retryAfterSeconds,
      cookie: "",
      stateReason: state.reason
    };
  }

  if (!existing) entries.push({ bookId: id, at: clock });
  entries.sort((a, b) => a.at - b.at || a.bookId.localeCompare(b.bookId));
  const token = await tokenForEntries(env, entries);
  return {
    allowed: true,
    newBook: !existing,
    count: entries.length,
    remaining: Math.max(0, ACQUISITION_UNIQUE_LIMIT - entries.length),
    retryAfterSeconds: 0,
    cookie: acquisitionCookie(token),
    stateReason: state.reason
  };
}
