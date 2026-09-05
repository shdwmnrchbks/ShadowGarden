import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACQUISITION_COOKIE,
  ACQUISITION_UNIQUE_LIMIT,
  ACQUISITION_WINDOW_SECONDS,
  evaluateAcquisition,
  verifyAcquisitionState
} from '../../functions/_lib/acquisition-limit.js';
import { classifyAutomatedClient } from '../../functions/_lib/crawler-policy.js';
import {
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  issueAdminSession,
  verifyAdminSession
} from '../../functions/_lib/admin-session.js';
import {
  adminCooldown,
  adminThrottleClientId,
  clearAdminFailureState,
  registerAdminFailure
} from '../../functions/_lib/admin-throttle.js';
import {
  ABUSE_COOLDOWN_SECONDS,
  ABUSE_SCORE_LIMIT,
  ABUSE_SIGNAL_WEIGHTS,
  ABUSE_WINDOW_SECONDS,
  abuseClientId,
  abuseCooldown,
  loadAbuseOverview,
  recordSecurityEvent,
  registerAbuseSignal,
  releaseAbuseClient
} from '../../functions/_lib/abuse-telemetry.js';

const SIGNING_SECRET = 'shadow-garden-ci-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const env = { SG_MEDIA_SIGNING_SECRET: SIGNING_SECRET };

function memoryStore() {
  const values = new Map();
  return {
    values,
    async get(key) { return values.get(key) ?? null; },
    async put(key, value) { values.set(String(key), String(value)); },
    async delete(key) { values.delete(String(key)); }
  };
}

function client(ip, cookie = '') {
  return new Request('https://shadow.example/book-access', {
    headers: {
      'cf-connecting-ip': ip,
      'user-agent': 'Mozilla/5.0 Test Browser',
      ...(cookie ? { cookie } : {})
    }
  });
}

test('bulk acquisition throttling preserves the 20-book rolling-window contract', async () => {
  assert.equal(ACQUISITION_UNIQUE_LIMIT, 20);
  assert.equal(ACQUISITION_WINDOW_SECONDS, 600);

  let cookie = '';
  let firstId = '';
  const now = 2_000_000;
  for (let index = 0; index < ACQUISITION_UNIQUE_LIMIT; index += 1) {
    const id = `bk_${String(index).padStart(22, 'A')}`;
    if (index === 0) firstId = id;
    const result = await evaluateAcquisition(env, cookie, id, now + index);
    assert.equal(result.allowed, true);
    assert.match(result.cookie, new RegExp(`${ACQUISITION_COOKIE}=`));
    for (const marker of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/book-access', 'Max-Age=600']) {
      assert.match(result.cookie, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    cookie = result.cookie;
  }

  const repeated = await evaluateAcquisition(env, cookie, firstId, now + 30);
  assert.equal(repeated.allowed, true);
  assert.equal(repeated.newBook, false);
  cookie = repeated.cookie;

  const blocked = await evaluateAcquisition(env, cookie, 'bk_ZZZZZZZZZZZZZZZZZZZZZZ', now + 40);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1 && blocked.retryAfterSeconds <= ACQUISITION_WINDOW_SECONDS);

  const recovered = await evaluateAcquisition(
    env,
    cookie,
    'bk_ZZZZZZZZZZZZZZZZZZZZZZ',
    now + ACQUISITION_WINDOW_SECONDS + 50
  );
  assert.equal(recovered.allowed, true);

  const token = cookie.split(';')[0];
  const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
  assert.equal((await verifyAcquisitionState(env, tampered, now + 50)).valid, false);
});

test('protected acquisition endpoints classify normal browsers and automated clients deterministically', () => {
  const browser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0 Safari/537.36';
  assert.equal(classifyAutomatedClient(browser).blocked, false);

  for (const [userAgent, category] of [
    ['GPTBot/1.2', 'ai_crawler'],
    ['ClaudeBot/1.0', 'ai_crawler'],
    ['curl/8.8.0', 'script_client'],
    ['python-requests/2.32', 'script_client'],
    ['Mozilla/5.0 HeadlessChrome/151.0 Safari/537.36', 'script_client']
  ]) {
    const result = classifyAutomatedClient(userAgent);
    assert.equal(result.blocked, true);
    assert.equal(result.category, category);
  }
  assert.equal(classifyAutomatedClient('').blocked, true);
});

test('Garden Keeper signed sessions and server-side cooldown remain bounded and network-scoped', async () => {
  assert.equal(ADMIN_SESSION_TTL_SECONDS, 3600);
  const sessionEnv = {
    SG_ADMIN_TOKEN: 'correct-horse-battery-staple',
    SG_MEDIA_SIGNING_SECRET: SIGNING_SECRET
  };
  const fixedSession = await issueAdminSession(sessionEnv, 1_000_000);
  const fixedCookie = adminSessionCookie(fixedSession);
  for (const marker of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/admin-api', 'Max-Age=3600']) {
    assert.match(fixedCookie, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal((await verifyAdminSession(sessionEnv, fixedCookie, 1_000_060)).valid, true);
  assert.equal((await verifyAdminSession(sessionEnv, fixedCookie, fixedSession.expiresAt + 1)).valid, false);

  const store = memoryStore();
  const normal = client('203.0.113.24', 'sg_admin_failures=old-browser-state');
  const incognito = client('203.0.113.24');
  const otherNetwork = client('198.51.100.77');
  const normalId = await adminThrottleClientId(sessionEnv, normal);
  assert.equal(normalId, await adminThrottleClientId(sessionEnv, incognito));
  assert.notEqual(normalId, await adminThrottleClientId(sessionEnv, otherNetwork));

  const first = await registerAdminFailure(sessionEnv, normal, 2_000_000, store);
  assert.equal(first.retryAfterSeconds, 0);
  assert.equal(first.storage, 'server');
  const second = await registerAdminFailure(sessionEnv, incognito, 2_000_001, store);
  assert.equal(second.retryAfterSeconds, 5);
  assert.equal([...store.values.keys()].some(key => key.includes('203.0.113.24')), false);

  const active = await adminCooldown(sessionEnv, incognito, 2_000_001, store);
  assert.equal(active.blocked, true);
  assert.equal(active.retryAfterSeconds, 5);
  assert.equal((await adminCooldown(sessionEnv, otherNetwork, 2_000_001, store)).blocked, false);
  assert.equal((await adminCooldown(sessionEnv, normal, 2_000_006, store)).blocked, false);

  await clearAdminFailureState(sessionEnv, normal, store);
  const cleared = await adminCooldown(sessionEnv, incognito, 2_000_006, store);
  assert.equal(cleared.blocked, false);
  assert.equal(cleared.failures, 0);
});

test('abuse telemetry tripwire, persistence, and manual release remain bounded', async () => {
  assert.equal(ABUSE_WINDOW_SECONDS, 900);
  assert.equal(ABUSE_SCORE_LIMIT, 12);
  assert.equal(ABUSE_COOLDOWN_SECONDS, 600);
  assert.equal(ABUSE_SIGNAL_WEIGHTS.acquisition_limited, 12);

  const store = memoryStore();
  const normal = client('203.0.113.50', 'sg_anything=1');
  const incognito = client('203.0.113.50');
  const other = client('198.51.100.88');
  const normalId = await abuseClientId(env, normal);
  assert.equal(normalId, await abuseClientId(env, incognito));
  assert.notEqual(normalId, await abuseClientId(env, other));

  assert.equal((await registerAbuseSignal(env, normal, 'automation_denied', 3_000_000, store)).blocked, false);
  assert.equal((await registerAbuseSignal(env, incognito, 'automation_denied', 3_000_001, store)).blocked, false);
  const third = await registerAbuseSignal(env, normal, 'automation_denied', 3_000_002, store);
  assert.equal(third.activated, true);
  assert.equal(third.blocked, true);
  assert.equal(third.retryAfterSeconds, 600);

  const inherited = await abuseCooldown(env, incognito, 3_000_002, store);
  assert.equal(inherited.blocked, true);
  assert.equal(inherited.retryAfterSeconds, 600);
  assert.equal((await abuseCooldown(env, other, 3_000_002, store)).blocked, false);

  let overview = await loadAbuseOverview(env, 3_000_002, store);
  assert.equal(overview.activeCooldowns, 1);
  assert.equal(overview.events[0]?.kind, 'public_cooldown');
  assert.equal([...store.values.values()].join('\n').includes('203.0.113.50'), false);

  await releaseAbuseClient(env, normalId, 3_000_010, store);
  assert.equal((await abuseCooldown(env, incognito, 3_000_010, store)).blocked, false);
  overview = await loadAbuseOverview(env, 3_000_010, store);
  assert.equal(overview.activeCooldowns, 0);
  assert.ok(overview.events.find(event => event.kind === 'public_cooldown')?.releasedAt);

  await recordSecurityEvent(env, normal, 'admin_cooldown', { failures: 4, retryAfterSeconds: 60 }, 3_000_020, store);
  overview = await loadAbuseOverview(env, 3_000_020, store);
  assert.ok(overview.events.some(event => event.kind === 'admin_cooldown' && event.detail?.failures === 4));
});
