# Shadow Garden Security & Anti-Abuse Roadmap

This roadmap tracks the free-only hardening work for Shadow Garden against bulk EPUB scraping, hotlinking, automated aggregation, nuisance attacks, and Garden Keeper abuse.

The goal is **deterrence and abuse resistance**, not DRM. Any EPUB delivered to a legitimate browser can ultimately be copied by a determined user. Shadow Garden should instead make automated harvesting, durable hotlinks, enumeration, and high-volume acquisition inconvenient while keeping ordinary reading smooth.

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
| 5. Bulk-download throttling | 🟨 In progress | Signed 20-unique-book/10-minute `/book-access` budget; optional zone-level IP burst rule deferred while hosted on `pages.dev` |
| 6. Bot and crawler controls | ⬜ Planned | Bot Fight Mode, AI bot controls, AI Labyrinth, crawler policy |
| 7. Garden Keeper hardening | ⬜ Planned | Turnstile/rate-limit admin unlock and reduce authentication probing |
| 8. Abuse telemetry and response | ⬜ Planned | Security Analytics review procedure, tripwires, temporary cooldown policy |
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
- [x] Keep Milestone 4 dormant when both Turnstile variables are absent and fail closed on partial/misconfigured activation.
- [x] Production-test first Read and Download in a fresh session.
- [x] Verify subsequent protected acquisitions in the same human session do not re-challenge normally.
- [x] Verify ordinary Main/Adult browsing remains challenge-free.
- [x] Verify Milestone 2 bare-media denial and Milestone 3 opaque URLs remain intact.

### Acceptance

Milestone 4 was explicitly accepted after production Turnstile behavior and Reader regressions were verified. Milestone 5 is now allowed to proceed.

---

## Milestone 5 — Bulk-download throttling

**Status:** 🟨 In progress

Milestone 5 protects **book authorization**, not EPUB delivery. Individual `/media/*` Range requests, page turns, seeking, Page Map, Visual Page Cache, covers, catalogs, and ordinary browsing must not consume the acquisition budget.

### Current hosting constraint

Shadow Garden is staying on `shadowgarden-bon.pages.dev` and does not use a custom domain/Cloudflare zone. Zone-level WAF rate-limiting rules therefore cannot be attached to the site in its current configuration.

Buying a domain is **not** a Milestone 5 requirement. The previously planned Cloudflare IP burst rule is recorded as optional future hardening and deferred by the current hosting model.

### Active design

Shadow Garden uses an application/session unique-book budget at the protected acquisition boundary:

- **20 different books per rolling 10 minutes**.
- State is signed with `SG_MEDIA_SIGNING_SECRET`.
- Re-authorizing the same book does not consume another unique-book slot.
- The 21st different book inside the window returns `429` plus `Retry-After`.
- The limiter is kept completely out of `/media/*` and EPUB Range delivery.

This is a deterrence layer, not an IP-global DRM mechanism. Deliberately discarding browser state can eventually force a new Milestone 4 human-verification flow, which remains the intended free-hosting fallback against automated resets.

### Repository implementation — v1.11.0

- [x] Add signed `sg_acquisition_window` state using `SG_MEDIA_SIGNING_SECRET` under a separate HMAC domain.
- [x] Keep the acquisition cookie HttpOnly, Secure, SameSite=Strict and scoped only to `/book-access`.
- [x] Track opaque `bookId` values rather than storage paths.
- [x] Allow **20 different books per rolling 600 seconds**.
- [x] Re-authorizing the same book does not consume another unique-book slot.
- [x] Return HTTP `429` with `Retry-After` when the next different book exceeds the budget.
- [x] Return diagnostic `X-SG-Acquisition-Limit`, `X-SG-Acquisition-Window`, and `X-SG-Acquisition-Remaining` headers.
- [x] Keep acquisition throttling entirely out of `/media/*`, so Range requests and Reader rendering are unaffected.
- [x] Add dedicated Milestone 5 regression tests to the normal build/check pipeline.
- [x] Document the `pages.dev` hosting constraint and optional future zone rule in `MILESTONE_5_CLOUDFLARE.md`.

### Optional Cloudflare zone layer — ⏸ Deferred

This is not available while Shadow Garden remains solely on `pages.dev`:

- [ ] If a custom Cloudflare zone is ever adopted, optionally create an IP burst rule for `/book-access`.
- [ ] Keep `/media/*`, `/human-access`, catalogs, covers, and static Reader assets outside that rule.

No custom domain purchase is planned or required.

### Production acceptance — pending

- [ ] Normal Read/Download remains smooth under typical use.
- [ ] Same-book ticket renewal does not consume unique-book slots.
- [ ] Repository regression tests verify that 20 distinct books inside 10 minutes are allowed and the next distinct book receives `429` plus `Retry-After`.
- [ ] Repository regression tests verify that the signed rolling budget recovers after the window expires.
- [ ] Main/Adult browsing and Series pages remain challenge-free.
- [ ] Pages, Continuous, seeking, Page Map, Visual Page Cache, bookmarks, progress restore, and Range behavior remain normal.
- [ ] Milestones 2–4 protections remain intact.

### Acceptance criteria

1. Bulk authorization is slowed before EPUB transfer begins.
2. Ordinary readers are not penalized for Range requests or same-book ticket renewal.
3. A normal browser session cannot walk more than 20 different books in a 10-minute rolling window without temporary throttling.
4. No state or limiter is placed in the EPUB media proxy.
5. The absence of a custom Cloudflare zone does not block Milestone 5 completion.
6. Milestone 6 begins only after the production checks above pass.

---

## Milestone 6 — Bot and crawler controls

**Status:** ⬜ Planned

Free Cloudflare configuration pass:

- Bot Fight Mode where available to the `pages.dev` deployment/account.
- Block/limit AI crawler policies available without requiring a purchased custom domain.
- AI Labyrinth where available and appropriate.
- Review known-good crawler impact before leaving controls enabled.
- Keep `robots.txt` as the compliant-crawler baseline even though malicious bots can ignore it.

If a control requires a custom zone/domain, record it as unavailable/deferred rather than making domain purchase a project requirement.

---

## Milestone 7 — Garden Keeper hardening

**Status:** ⬜ Planned

The concealed ✦ shortcut remains convenience/camouflage only; authentication remains server enforced.

Planned work:

- Turnstile verification for Garden Keeper unlock.
- Rate-limit repeated unlock failures using mechanisms available on the current free `pages.dev` deployment.
- Generic authentication failure responses.
- Optional short escalating client/server cooldown without revealing which check failed.
- Preserve token-only server authorization for every mutation API.

---

## Milestone 8 — Abuse telemetry and response

**Status:** ⬜ Planned

Create a lightweight operational playbook using free Cloudflare analytics/logging that is actually available to the current Pages deployment, plus existing application logs.

Track patterns such as:

- large numbers of unique books from one address/session;
- sequential or exhaustive catalog acquisition;
- EPUB authorization without normal navigation;
- repeated failed ticket/signature checks;
- unusual Garden Keeper authentication probing;
- repeated cross-site media attempts.

Prefer temporary challenges/cooldowns over broad country blocks.

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

---

## Explicit non-goals

Shadow Garden will not rely on fake client-side protection such as disabling right-click, blocking DevTools, Base64-obscuring URLs, encrypting an EPUB with a browser-delivered key, or relying only on `Referer`. Those measures mainly inconvenience legitimate readers and provide little resistance to automated clients.
