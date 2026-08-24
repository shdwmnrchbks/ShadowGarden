import test from "node:test";
import assert from "node:assert/strict";

import { adminSessionCookie, issueAdminSession } from "../../functions/_lib/admin-session.js";
import { adminAuthorized, adminTokenMatches } from "../../functions/services/auth.js";

const env = {
  SG_ADMIN_TOKEN: "fixture-admin-token",
  SG_MEDIA_SIGNING_SECRET: "shadow-garden-r8-admin-session-secret-0123456789abcdef"
};

function request({ token = env.SG_ADMIN_TOKEN, cookie = "" } = {}) {
  return new Request("https://shadowgarden-bon.pages.dev/admin-api/status", {
    headers: {
      ...(token == null ? {} : { authorization: `Bearer ${token}` }),
      ...(cookie ? { cookie } : {})
    }
  });
}

test("Keeper API authorization requires both bearer token and signed session", async () => {
  const session = await issueAdminSession(env);
  const cookie = adminSessionCookie(session);
  assert.equal(await adminAuthorized(request({ cookie }), env), true);
  assert.equal(await adminAuthorized(request({ token: null, cookie }), env), false);
  assert.equal(await adminAuthorized(request({ token: "wrong", cookie }), env), false);
  assert.equal(await adminAuthorized(request({ cookie: "" }), env), false);
});

test("Keeper bearer comparison and session signatures reject tampering", async () => {
  assert.equal(await adminTokenMatches(env.SG_ADMIN_TOKEN, env), true);
  assert.equal(await adminTokenMatches(`${env.SG_ADMIN_TOKEN}x`, env), false);
  const session = await issueAdminSession(env);
  const cookie = adminSessionCookie(session);
  const separator = cookie.indexOf(";");
  const raw = cookie.slice(0, separator);
  const suffix = cookie.slice(separator);
  const signatureStart = raw.lastIndexOf(".") + 1;
  const signatureHead = raw[signatureStart];
  const tampered = `${raw.slice(0, signatureStart)}${signatureHead === "A" ? "B" : "A"}${raw.slice(signatureStart + 1)}${suffix}`;
  assert.equal(await adminAuthorized(request({ cookie: tampered }), env), false);
});
