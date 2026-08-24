import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  canonicalMediaCacheUrl,
  issueMediaTicket,
  normalizeBookPath,
  ticketCookie,
  verifyMediaTicket,
  verifyMediaTicketCookie
} from "../../functions/_lib/media-ticket.js";

const fixture = async () => JSON.parse(await fs.readFile(new URL("../fixtures/media-ticket-scenarios.json", import.meta.url), "utf8"));

test("signed media ticket verifies by query and HttpOnly cookie", async () => {
  const data = await fixture();
  const env = { SG_MEDIA_SIGNING_SECRET: data.secret };
  const issued = await issueMediaTicket(env, data.requestUrl, data.requestUrl, data.ttlSeconds);
  assert.ok(issued?.url.includes("exp="));
  assert.ok(issued?.url.includes("sig="));
  assert.equal((await verifyMediaTicket(env, new URL(issued.url, data.requestUrl).href)).valid, true);
  const cookie = ticketCookie(issued);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await verifyMediaTicketCookie(env, data.requestUrl, cookie)).valid, true);
});

test("tampered signatures and paths are rejected", async () => {
  const data = await fixture();
  const env = { SG_MEDIA_SIGNING_SECRET: data.secret };
  const issued = await issueMediaTicket(env, data.requestUrl, data.requestUrl, data.ttlSeconds);
  const valid = new URL(issued.url, data.requestUrl);

  const badSignature = new URL(valid);
  badSignature.searchParams.set("sig", `${badSignature.searchParams.get("sig")}x`);
  const signatureResult = await verifyMediaTicket(env, badSignature.href);
  assert.equal(signatureResult.valid, false);
  assert.equal(signatureResult.reason, "signature");

  const badPath = new URL(valid);
  badPath.pathname = "/media/shadow-garden/books/other.epub";
  const pathResult = await verifyMediaTicket(env, badPath.href);
  assert.equal(pathResult.valid, false);
  assert.equal(pathResult.reason, "signature");
});

test("expired signed media tickets are rejected deterministically", async () => {
  const data = await fixture();
  const env = { SG_MEDIA_SIGNING_SECRET: data.secret };
  const realNow = Date.now;
  const start = 1_800_000_000_000;
  Date.now = () => start;
  try {
    const issued = await issueMediaTicket(env, data.requestUrl, data.requestUrl, 60);
    Date.now = () => start + 61_000;
    const result = await verifyMediaTicket(env, new URL(issued.url, data.requestUrl).href);
    assert.equal(result.valid, false);
    assert.equal(result.reason, "expired");
  } finally { Date.now = realNow; }
});

test("media paths and cache keys keep protected namespace semantics", async () => {
  const data = await fixture();
  assert.equal(normalizeBookPath(data.requestUrl, data.requestUrl), "/media/shadow-garden/books/fixture.epub");
  assert.equal(normalizeBookPath("https://example.com/book.epub", data.requestUrl), "");
  assert.equal(normalizeBookPath("/media/shadow-garden/books/../secret.epub", data.requestUrl), "");
  const cacheUrl = canonicalMediaCacheUrl(`${data.requestUrl}?exp=123&sig=abc#fragment`);
  assert.equal(cacheUrl, data.requestUrl);
});
