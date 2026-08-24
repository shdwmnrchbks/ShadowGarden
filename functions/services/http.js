/* Shadow Garden R6 — canonical Pages Functions HTTP service. */

export const PRIVATE_NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
});

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

export function jsonWithCookies(data, status = 200, headers = {}, cookies = []) {
  const responseHeaders = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  for (const cookie of cookies) if (cookie) responseHeaders.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export function sameOriginBrowserRequest(request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export function defer(context, promise, label = "Deferred function task failed") {
  const guarded = Promise.resolve(promise).catch(error => console.warn(label, error));
  try { context.waitUntil(guarded); }
  catch { void guarded; }
  return guarded;
}

export function methodNotAllowed(allow, headers = {}) {
  return json({ error: "Method not allowed." }, 405, { ...headers, Allow: allow });
}

export async function parseJson(request) {
  try { return { ok: true, value: await request.json() }; }
  catch { return { ok: false, value: null }; }
}
