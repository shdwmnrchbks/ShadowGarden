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
| 6. Bot and crawler controls | 🟨 In progress | Repository crawler policy implemented; remaining browser/crawler acceptance closes with M9 |
| 7. Garden Keeper hardening | ✅ Done | Turnstile-gated unlock, signed admin session, server-side cross-session cooldowns; accepted 2026-08-24 |
| 8. Abuse telemetry and response | ✅ Done | HMAC network tripwires, temporary public cooldowns, private Abuse Watch ledger; accepted 2026-08-24 |
| 9. Final security audit | 🟨 In progress | End-to-end delivery, Reader, cache, admin, anti-abuse, and documentation audit |

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

**Status:** 🟨 In progress — final acceptance is folded into Milestone 9.

### Implemented

- [x] Sensitive-route and Reader exclusions in `robots.txt`.
- [x] Full-site crawl opt-outs for common AI training/bulk-content crawlers.
- [x] `functions/_lib/crawler-policy.js` for low-cost User-Agent screening.
- [x] Known AI crawlers and obvious script/headless clients are rejected at `/book-access` and `/human-access` before expensive authorization work.
- [x] Missing User-Agent values are denied at protected acquisition endpoints.
- [x] User-Agent screening remains outside `/media/*`.
- [x] `reader.html` is served `noindex, nofollow, noarchive`.
- [x] Dedicated M6 regression checks are part of `npm run check`.

### Deferred zone-only controls

- ⏸ Bot Fight Mode.
- ⏸ AI Crawl Control enforcement.
- ⏸ AI Labyrinth.
- ⏸ Cloudflare-managed AI `robots.txt` controls.

These are not required while Shadow Garden stays on `pages.dev`.

### Final acceptance to close in M9

- [ ] Confirm normal Chrome/Firefox/Safari/Edge Reader and Download flows still work.
- [ ] Confirm identified crawler/script requests are denied at protected acquisition endpoints.
- [ ] Confirm Library/Series browsing and Reader Range behavior are unaffected.

---

## Milestone 7 — Garden Keeper hardening

**Status:** ✅ Done — production accepted 2026-08-24

The concealed ✦ shortcut remains convenience/camouflage only. Garden Keeper authorization is server enforced.

### Repository implementation — v1.13.1

- [x] Dedicated `/admin-access` unlock boundary.
- [x] Turnstile bound to a separate `admin_access` action.
- [x] Constant-time admin-token comparison.
- [x] Signed one-hour `sg_admin_session`, HttpOnly/Secure/SameSite=Strict, scoped to `/admin-api`.
- [x] Every Garden Keeper API requires both bearer token and signed admin session.
- [x] Escalating failed-unlock cooldowns: no wait, 5s, 15s, 60s, 5m, then 15m.
- [x] Failed-unlock state moved server-side so Incognito/cleared cookies cannot reset the same-network cooldown.
- [x] Throttle keys are HMAC-derived from `CF-Connecting-IP`; raw IPs are not stored.
- [x] Private Backblaze B2 is used for throttle state; no custom domain/KV is required.
- [x] Successful unlock clears the server-side failure record.
- [x] Generic failure responses avoid revealing which check failed.
- [x] Explicit locking clears the admin session.
- [x] Dedicated M7 regression checks cover same-IP Incognito behavior and admin session enforcement.

---

## Milestone 8 — Abuse telemetry and response

**Status:** ✅ Done — production accepted 2026-08-24

The v1.14.0 deployment was accepted after normal Library/Reader/Garden Keeper behavior remained healthy and Abuse Watch operated as intended.

### Implemented

- [x] HMAC-derived network identities based on `CF-Connecting-IP`; raw IP addresses are never persisted.
- [x] Server-side public tripwire survives Incognito and cleared cookies on the same public network.
- [x] Rolling 15-minute suspicious-signal window with score threshold 12.
- [x] 10-minute temporary cooldown on `/book-access` and `/human-access` only.
- [x] Signal weights for automation denial, Turnstile rejection, M5 acquisition-limit activation, cross-site EPUB attempts, and invalid non-Range tickets.
- [x] Hitting the M5 unique-book limit immediately activates the M8 tripwire.
- [x] M8 cooldown enforcement remains entirely outside `/media/*`.
- [x] Reader Range ticket failures are log-only for M8 scoring to avoid renewal false positives.
- [x] Private B2 abuse-state objects and bounded 7-day/100-event Abuse Watch ledger.
- [x] Significant Garden Keeper cooldowns appear in Abuse Watch.
- [x] Authenticated `/admin-api/abuse` review/release operations.
- [x] Manual release clears an active public cooldown without erasing its historical event.
- [x] Dedicated M8 regression checks are part of the build pipeline.

See `MILESTONE_8_ABUSE_RESPONSE.md` for the policy details.

---

## Milestone 9 — Final security audit

**Status:** 🟨 In progress

Milestone 9 is the final full-system regression pass. It validates the accumulated security architecture against the current Reader/Library/Garden Keeper application rather than adding another independent protection layer.

### Repository audit baseline — v1.15.0

- [x] Add `tools/check-m9.mjs` to enforce final architecture invariants in CI.
- [x] Confirm signed-ticket authorization and Range support remain present in `/media/*`.
- [x] Assert M8 cooldown enforcement remains outside `/media/*` while staying active on `/book-access` and `/human-access`.
- [x] Assert Garden Keeper retains bearer-token + signed-session authorization and server-side cooldowns.
- [x] Assert all protected Pages Functions routes remain routed through `_routes.json`.
- [x] Assert public HTML does not expose direct private B2 delivery URLs.
- [x] Assert Reader startup retains opaque `bk_...` authorization handoff.
- [x] Assert browser-local finished-reading state does not create a new server tracking/API surface.
- [x] Add generated `/data/version.json` metadata so Garden Keeper shows the exact deployed package version and short commit.
- [x] Add the detailed production matrix in `MILESTONE_9_FINAL_AUDIT.md`.

### Production audit — pending

The final audit covers:

- Main and Adult Library Grid/Compact views, search, filters, pinned state, Finished/Unfinished state, and incremental loading.
- Series page status, volume badges, cover/banner behavior, and reading links.
- Reader Page and Continuous modes, Range/seek, Page Map, Visual Page Cache, bookmarks, Continue Reading, themes, mobile end page, and the new Mark as Finished toggle.
- Signed/expired/tampered media behavior, cross-origin rejection, Turnstile, M5 throttling, M6 automation screening, and M8 tripwires.
- Garden Keeper unlock/lock, uploads, edits, banners, Catalog History, Garden Health, cover optimization, Trash, Abuse Watch, and deployed-version display.
- Cloudflare Pages deployment and cache/header behavior.

See `MILESTONE_9_FINAL_AUDIT.md` for the acceptance checklist. When that matrix is accepted, M6 and M9 can both be marked ✅ Done and the security roadmap is complete.

---

## Explicit non-goals

Shadow Garden will not rely on fake client-side protection such as disabling right-click, blocking DevTools, Base64-obscuring URLs, encrypting an EPUB with a browser-delivered key, or relying only on `Referer`. Those measures mainly inconvenience legitimate readers and provide little resistance to automated clients.
