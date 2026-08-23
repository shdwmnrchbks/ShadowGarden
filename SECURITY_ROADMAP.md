# Shadow Garden Security & Anti-Abuse Roadmap

This roadmap tracks the free-only hardening work for Shadow Garden against bulk EPUB scraping, hotlinking, automated aggregation, nuisance attacks, and Garden Keeper abuse.

The goal is **deterrence and abuse resistance**, not DRM. Any EPUB delivered to a legitimate browser can ultimately be copied by a determined user. Shadow Garden should instead make automated harvesting, durable hotlinks, enumeration, high-volume acquisition, and admin probing inconvenient while keeping ordinary reading smooth.

Shadow Garden intentionally remains on the free `shadowgarden-bon.pages.dev` hostname. Purchasing or attaching a custom domain is **not** a roadmap requirement. Zone-only Cloudflare controls that are unavailable on `pages.dev` are optional/deferred rather than blockers.

## Status legend

- ⬜ Planned
- 🟨 In progress
- ✅ Done
- ⏸ Deferred

## Progress

| Milestone | Status | Scope |
| --- | --- | --- |
| 1. Baseline media hardening | ✅ Done | Same-origin browser policy, cross-site EPUB rejection, crawler controls, anti-indexing headers |
| 2. Signed book access tickets | ✅ Done | HMAC tickets, expiring download URLs, path-scoped Reader authorization, fail-closed enforcement |
| 3. Opaque public book identifiers | ✅ Done | Public `bk_...` identities, catalog redaction, opaque Reader/download URLs, private media boundary |
| 4. Human access sessions | ✅ Done | Turnstile + signed 12-hour `/book-access` human session, production accepted 2026-08-23 |
| 5. Bulk-download throttling | ✅ Done | Signed 20-unique-book/10-minute acquisition budget; zone WAF burst rule deferred on `pages.dev` |
| 6. Bot and crawler controls | 🟨 In progress | Repository crawler policy, protected-endpoint automation screening, Reader noindex policy; zone-only controls deferred |
| 7. Garden Keeper hardening | 🟨 In progress | Turnstile-gated unlock, signed admin session, generic failures, escalating cooldowns, server-enforced admin APIs |
| 8. Abuse telemetry and response | ⬜ Planned | Lightweight logging/review procedure, tripwires, temporary cooldown policy |
| 9. Final security audit | ⬜ Planned | Delivery paths, cache behavior, Reader compatibility, admin flows, and documentation |

---

## Milestones 1–5 — Completed

### 1. Baseline media hardening — ✅

- Reject cross-site browser EPUB requests.
- Apply anti-index/archive headers to protected media and private surfaces.
- Preserve Reader Range requests and normal caching behavior.

### 2. Signed book access tickets — ✅

- `/book-access` mints HMAC-SHA256 tickets for the exact EPUB path.
- Reader receives a short-lived HttpOnly, Secure, SameSite=Strict ticket cookie scoped to the EPUB path.
- Missing signing configuration fails closed.

### 3. Opaque public book identifiers — ✅

- Public catalogs expose stable non-sequential `bk_...` IDs instead of EPUB storage paths.
- Public catalogs redact EPUB hashes/original filenames.
- Reader/download URLs remain opaque until authorization.
- EPUB replacement preserves stable identity.

### 4. Human access sessions — ✅

- Turnstile is required only at protected acquisition, not in the reading/rendering path.
- Successful verification creates a signed 12-hour human session scoped to `/book-access`.
- Main/Adult browsing, Pages, Continuous, Page Map, Visual Page Cache, bookmarks, progress restore, and Range behavior remain unaffected.
- Production accepted 2026-08-23.

### 5. Bulk-download throttling — ✅

- Signed `sg_acquisition_window` state allows **20 different books per rolling 10 minutes**.
- Re-authorizing the same book does not consume another slot.
- The next distinct book returns `429` with `Retry-After`.
- No limiter state is placed in `/media/*`.
- A zone-level WAF burst rule is ⏸ deferred because `pages.dev` is not a customer-owned zone.

---

## Milestone 6 — Bot and crawler controls

**Status:** 🟨 In progress

Repository-side protection is implemented; final production acceptance is still open while Milestone 7 proceeds at the owner's request.

### Implemented

- [x] Sensitive-route and Reader exclusions in `robots.txt`.
- [x] Full-site crawl opt-outs for common AI training/bulk-content crawlers.
- [x] `functions/_lib/crawler-policy.js` for low-cost User-Agent screening.
- [x] Known AI crawlers and obvious script/headless clients are rejected at `/book-access` and `/human-access` before expensive authorization work.
- [x] Missing User-Agent values are denied at those protected acquisition endpoints.
- [x] User-Agent screening remains completely outside `/media/*`.
- [x] `reader.html` is served `noindex, nofollow, noarchive`.
- [x] Dedicated Milestone 6 regression checks are part of `npm run check`.

### Deferred zone-only controls

- ⏸ Bot Fight Mode.
- ⏸ AI Crawl Control enforcement.
- ⏸ AI Labyrinth.
- ⏸ Cloudflare-managed AI `robots.txt` controls.

These are not required while Shadow Garden stays on `pages.dev`.

### Remaining acceptance

- [ ] Confirm normal Chrome/Firefox/Safari/Edge Reader and Download flows still work.
- [ ] Confirm identified crawler/script requests are denied at protected acquisition endpoints.
- [ ] Confirm Library/Series browsing and Reader Range behavior are unaffected.

---

## Milestone 7 — Garden Keeper hardening

**Status:** 🟨 In progress

The concealed ✦ shortcut remains convenience/camouflage only. Garden Keeper authorization is server enforced.

### Repository implementation — v1.13.0

- [x] Add `/admin-access` as the dedicated Garden Keeper unlock boundary.
- [x] Reuse the existing Turnstile site/secret configuration with a separate `admin_access` action.
- [x] Fail closed when Turnstile, `SG_ADMIN_TOKEN`, or signing configuration is unavailable.
- [x] Compare the submitted admin token in constant time.
- [x] Create a signed one-hour `sg_admin_session` after successful Turnstile + token verification.
- [x] Scope the admin session cookie to `/admin-api`, with HttpOnly, Secure, SameSite=Strict.
- [x] Require **both** the bearer admin token and a valid signed Garden Keeper session on `/admin-api/*`.
- [x] Keep every existing mutation/read API behind the shared `adminAuthorized` boundary.
- [x] Add signed failed-unlock state and escalating cooldowns: first failure no wait, then 5s, 15s, 60s, 5m, then 15m.
- [x] Return generic `Access denied. Please try again.` responses rather than revealing whether Turnstile or the admin token was the failing factor.
- [x] Return `Retry-After` during an active cooldown and show a client-side countdown.
- [x] Clear the signed admin session when Garden Keeper is explicitly locked.
- [x] Apply Milestone 6 automation screening to `/admin-access` as an additive deterrent.
- [x] Route `/admin-access` through Pages Functions and exclude it from crawling.
- [x] Serve the Garden Keeper security client with `Cache-Control: no-store`.
- [x] Add dedicated Milestone 7 regression checks to the normal build/check pipeline.

### Security model

The unlock flow now has three independent requirements:

1. a normal browser-shaped request that passes the low-cost automation policy;
2. a valid Turnstile response bound to the `admin_access` action and current hostname;
3. the correct `SG_ADMIN_TOKEN`.

A successful unlock then issues a short signed admin session. Admin API requests still require the original bearer token **and** that signed session. Deleting browser state can reset the signed cooldown, so the cooldown is a deterrence layer rather than an IP-global lockout; Turnstile remains the independent cost against repeated resets.

### Production acceptance — pending

- [ ] Correct token + successful Turnstile unlocks Garden Keeper.
- [ ] Wrong token returns only the generic denial and does not reveal which check failed.
- [ ] Repeated failed unlocks show the escalating cooldown and `Retry-After` behavior.
- [ ] Locking Garden Keeper clears the admin session and requires a new unlock flow.
- [ ] Direct `/admin-api/*` requests with only the bearer token are rejected without the signed admin session.
- [ ] Upload, metadata edit, series status, banner, Catalog History, maintenance, Trash restore/purge, and other Garden Keeper operations still work after a valid unlock.
- [ ] Main/Adult Library, Series pages, Reader, and protected book acquisition remain unaffected.

Milestone 8 begins after these production checks pass.

---

## Milestone 8 — Abuse telemetry and response

**Status:** ⬜ Planned

Create a lightweight operational playbook using Pages/Functions logs and free analytics available on the current deployment.

Track patterns such as unusual unique-book acquisition, repeated ticket/signature failures, cross-site media attempts, repeated automation-policy denials, and Garden Keeper unlock denials/cooldowns. Prefer temporary challenges/cooldowns over broad blocks.

---

## Milestone 9 — Final security audit

**Status:** ⬜ Planned

Final regression pass across Main/Adult Library, Series pages, Reader Pages/Continuous, Range/seek behavior, Page Map, Visual Page Cache, Continue Reading/bookmarks, Garden Keeper uploads/maintenance/history/trash, cache behavior, expired/tampered tickets, cross-origin attempts, and all anti-automation/admin-hardening layers.

---

## Explicit non-goals

Shadow Garden will not rely on fake client-side protection such as disabling right-click, blocking DevTools, Base64-obscuring URLs, encrypting an EPUB with a browser-delivered key, or relying only on `Referer`. Those measures mainly inconvenience legitimate readers and provide little resistance to automated clients.
