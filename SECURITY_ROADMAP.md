# Shadow Garden Security & Anti-Abuse Roadmap

This roadmap tracks the free-only hardening work for Shadow Garden against bulk EPUB scraping, hotlinking, automated aggregation, nuisance attacks, and Garden Keeper abuse.

The goal is **deterrence and abuse resistance**, not DRM. Any EPUB delivered to a legitimate browser can ultimately be copied by a determined user. Shadow Garden should instead make automated harvesting, durable hotlinks, enumeration, and high-volume acquisition inconvenient while keeping ordinary reading smooth.

Shadow Garden intentionally remains on the free `shadowgarden-bon.pages.dev` hostname. Purchasing or attaching a custom domain is **not** a roadmap requirement. Zone-only Cloudflare controls that are unavailable on `pages.dev` are treated as optional/deferred rather than blockers.

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
| 3. Opaque public book identifiers | ✅ Done | Public `bk_...` identities, catalog redaction, opaque Reader/download URLs, private media boundary, stable replacement identity |
| 4. Human access sessions | ✅ Done | Turnstile + signed 12-hour `/book-access` human session, production accepted 2026-08-23 |
| 5. Bulk-download throttling | ✅ Done | Signed 20-unique-book/10-minute acquisition budget; zone-level WAF burst rule deferred on `pages.dev` |
| 6. Bot and crawler controls | 🟨 In progress | Repository crawler policy, protected-endpoint automation screening, Reader noindex policy; zone-only Cloudflare bot features deferred |
| 7. Garden Keeper hardening | ⬜ Planned | Turnstile/rate-limit admin unlock and reduce authentication probing |
| 8. Abuse telemetry and response | ⬜ Planned | Lightweight logging/review procedure, tripwires, temporary cooldown policy |
| 9. Final security audit | ⬜ Planned | Verify delivery paths, cache behavior, Reader compatibility, admin flows, and documentation |

---

## Milestone 1 — Baseline media hardening

**Status:** ✅ Done

Completed and production-validated.

- Reject cross-site browser EPUB requests.
- Same-origin protected-media policy and anti-index/archive headers.
- Preserve Reader Range requests and Cloudflare caching.
- Regression checks cover the public media boundary.

---

## Milestone 2 — Signed book access tickets

**Status:** ✅ Done

Completed and production-validated.

- `/book-access` mints HMAC-SHA256 tickets for the exact EPUB path.
- Signed URLs expire after roughly 10 minutes.
- Reader receives a short-lived HttpOnly, Secure, SameSite=Strict ticket cookie scoped to the exact EPUB path.
- Reader automatically renews authorization without placing auth logic inside EPUB Range requests.
- Missing/invalid signing configuration fails closed.

---

## Milestone 3 — Opaque public book identifiers

**Status:** ✅ Done

Completed and production-validated.

- Public catalogs expose stable non-sequential `bk_...` IDs instead of EPUB storage paths.
- Public catalogs redact EPUB hashes/original filenames and private B2 namespaces remain inaccessible.
- Server resolves opaque IDs to cataloged EPUB paths only.
- Reader and Download EPUB URLs remain opaque until authorization.
- Existing Continue Reading/bookmark state migrates to opaque IDs.
- Replacing an EPUB preserves its stable book ID.

---

## Milestone 4 — Human access sessions

**Status:** ✅ Done — production accepted 2026-08-23

Cloudflare Turnstile Free is used only at the protected acquisition boundary, not in the reading/rendering path.

### Completed

- [x] Keep Main/Adult Library browsing, catalogs, covers, filters, and Series browsing challenge-free.
- [x] Gate protected acquisition at `/book-access` when Turnstile is active.
- [x] Return `428 human_verification_required` when no valid human session exists.
- [x] Load Turnstile on demand and verify it server-side at `/human-access`.
- [x] Validate Siteverify success, expected `book_access` action, and exact hostname.
- [x] Create a signed 12-hour human-access session.
- [x] Scope the human cookie to `/book-access` with HttpOnly, Secure, SameSite=Strict.
- [x] Keep human-session logic out of `/media/*` and EPUB Range requests.
- [x] Retry the original Reader/download authorization automatically after successful verification.
- [x] Preserve Pages, Continuous, seeking, Page Map, Visual Page Cache, bookmarks, progress restore, and ticket renewal.
- [x] Production acceptance completed and explicitly approved.

---

## Milestone 5 — Bulk-download throttling

**Status:** ✅ Done — accepted when proceeding to Milestone 6

Milestone 5 protects **book authorization**, not EPUB delivery.

### Completed

- [x] Add signed `sg_acquisition_window` state under a separate HMAC domain.
- [x] Keep the acquisition cookie HttpOnly, Secure, SameSite=Strict and scoped only to `/book-access`.
- [x] Track opaque `bookId` values rather than storage paths.
- [x] Allow **20 different books per rolling 600 seconds**.
- [x] Re-authorizing the same book does not consume another unique-book slot.
- [x] Return HTTP `429` with `Retry-After` when the next different book exceeds the budget.
- [x] Keep acquisition throttling entirely out of `/media/*`, so Range requests and Reader rendering are unaffected.
- [x] Add dedicated Milestone 5 regression tests to the normal build/check pipeline.
- [x] Adapt the plan for a `pages.dev` deployment with no custom domain.

### Deferred optional layer

- ⏸ A zone-level Cloudflare `/book-access` IP burst rule is unavailable because `pages.dev` is not a customer-owned Cloudflare zone.
- ⏸ If a custom domain is ever added voluntarily, an optional independent WAF burst rule can be considered.
- This does **not** block Milestone 5 completion.

---

## Milestone 6 — Bot and crawler controls

**Status:** 🟨 In progress

Milestone 6 uses controls that work on the existing free `pages.dev` deployment and does not require a custom domain.

### Repository implementation — v1.12.0

- [x] Expand `robots.txt` to exclude protected media, Reader, Garden Keeper, `/book-access`, and `/human-access` from normal crawling.
- [x] Add full-site `Disallow: /` preferences for known AI training/bulk-content crawlers such as GPTBot, ClaudeBot, anthropic-ai, CCBot, Bytespider, Google-Extended, Meta-ExternalAgent, Applebot-Extended, and cohere-ai.
- [x] Add `functions/_lib/crawler-policy.js` as a low-cost User-Agent screening layer.
- [x] Reject known AI crawlers at `/book-access` before Turnstile/session/catalog work.
- [x] Reject obvious command-line/script/headless clients at `/book-access` before protected acquisition work.
- [x] Apply the same automation screening at `/human-access` so obvious automated clients cannot mint human sessions.
- [x] Deny missing User-Agent values on these protected acquisition endpoints.
- [x] Keep User-Agent automation screening completely out of `/media/*` so Range behavior remains untouched.
- [x] Serve `reader.html` with `X-Robots-Tag: noindex, nofollow, noarchive`.
- [x] Add dedicated Milestone 6 regression tests to the normal build/check pipeline.
- [x] Document the domain-free crawler policy in `MILESTONE_6_CRAWLER_POLICY.md`.

### Cloudflare zone controls — deferred on pages.dev

The following Cloudflare features are domain/zone controls and cannot be attached to the current `pages.dev` hostname without a customer-owned zone:

- ⏸ Bot Fight Mode.
- ⏸ AI Crawl Control enforcement.
- ⏸ AI Labyrinth.
- ⏸ Cloudflare-managed AI `robots.txt` controls.

These are **optional future hardening**, not Milestone 6 blockers.

### Production acceptance — pending

- [ ] Normal Chrome/Firefox/Safari/Edge Reader and Download flows still reach Garden Pass and open books normally.
- [ ] A `GPTBot`-identified request to `/book-access` is denied before Turnstile/catalog work.
- [ ] A `curl`/script-client request to `/book-access` is denied.
- [ ] The same automation screening works on `/human-access`.
- [ ] Public Library and Series browsing remains normal.
- [ ] `robots.txt` shows the sensitive-route and AI-training crawler policy.
- [ ] `reader.html` returns the noindex/nofollow/noarchive policy.
- [ ] Pages, Continuous, Range requests, seeking, Page Map, Visual Page Cache, bookmarks, and progress remain unaffected.
- [ ] Milestones 2–5 continue to work for normal browsers.

### Acceptance criteria

1. Well-behaved AI crawlers are explicitly instructed not to crawl protected/archive content intended to stay out of training collection.
2. Known AI crawler and obvious automation User-Agents are denied at protected acquisition endpoints before expensive authorization work.
3. User-Agent screening is treated only as an additive deterrent; spoofable headers never replace signed tickets, Turnstile, or throttling.
4. No bot/crawler screening is added to EPUB Range/media delivery.
5. The project remains fully usable on `pages.dev` with no custom domain requirement.
6. Milestone 7 begins after the production checks above pass.

---

## Milestone 7 — Garden Keeper hardening

**Status:** ⬜ Planned

The concealed ✦ shortcut remains convenience/camouflage only; authentication remains server enforced.

Planned work:

- Turnstile verification for Garden Keeper unlock.
- Rate-limit repeated unlock failures using application-level controls that work on `pages.dev`.
- Generic authentication failure responses.
- Optional short escalating client/server cooldown without revealing which check failed.
- Preserve token-only server authorization for every mutation API.

---

## Milestone 8 — Abuse telemetry and response

**Status:** ⬜ Planned

Create a lightweight operational playbook using Pages/Functions logs and whatever free Cloudflare analytics are available without requiring a custom zone.

Track patterns such as:

- large numbers of unique books from one browser/session;
- sequential or exhaustive catalog acquisition;
- EPUB authorization without normal navigation;
- repeated failed ticket/signature checks;
- unusual Garden Keeper authentication probing;
- repeated cross-site media attempts;
- repeated automation-policy denials.

Prefer temporary challenges/cooldowns over broad blocks.

---

## Milestone 9 — Final security audit

**Status:** ⬜ Planned

Regression checklist after all protection layers are present:

- Main and Adult Library catalogs/covers.
- Series pages.
- Reader Pages and Continuous modes.
- Range requests and seeking.
- Page Map / Visual Page Cache behavior.
- Continue Reading and bookmarks.
- Garden Keeper unlock and uploads.
- Catalog History restore/delete.
- Trash restore/purge.
- Cache behavior after ticket validation.
- Expired/tampered access URLs.
- Cross-origin/hotlink attempts.
- automation/crawler policy behavior.

---

## Explicit non-goals

Shadow Garden will not rely on fake client-side protection such as disabling right-click, blocking DevTools, Base64-obscuring URLs, encrypting an EPUB with a browser-delivered key, or relying only on `Referer`. Those measures mainly inconvenience legitimate readers and provide little resistance to automated clients.
