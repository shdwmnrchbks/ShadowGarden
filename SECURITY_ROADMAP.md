# Shadow Garden Security & Anti-Abuse Roadmap

This roadmap tracks the free-only hardening work for Shadow Garden against bulk EPUB scraping, hotlinking, automated aggregation, nuisance attacks, and Garden Keeper abuse.

The goal is **deterrence and abuse resistance**, not DRM. Any EPUB that a legitimate browser can read can ultimately be copied by a determined user. Shadow Garden should instead make automated harvesting, durable hotlinks, enumeration, and high-volume acquisition inconvenient and expensive while keeping ordinary reading smooth.

## Status legend

- ⬜ Planned
- 🟨 In progress
- ✅ Done
- ⏸ Deferred

## Progress

| Milestone | Status | Scope |
| --- | --- | --- |
| 1. Baseline media hardening | 🟨 In progress | Merged and CI-verified; production smoke test pending |
| 2. Signed book access tickets | ⬜ Planned | Short-lived HMAC access URLs for EPUB delivery |
| 3. Opaque public book identifiers | ⬜ Planned | Stop exposing durable B2 object paths in public catalog data |
| 4. Human access sessions | ⬜ Planned | Free Cloudflare Turnstile session verification before protected book acquisition |
| 5. Bulk-download throttling | ⬜ Planned | Free Cloudflare rate-limiting rule and unique-book acquisition policy |
| 6. Bot and crawler controls | ⬜ Planned | Bot Fight Mode, AI bot controls, AI Labyrinth, crawler policy |
| 7. Garden Keeper hardening | ⬜ Planned | Turnstile/rate-limit admin unlock and reduce authentication probing |
| 8. Abuse telemetry and response | ⬜ Planned | Security Analytics review procedure, tripwires, temporary cooldown policy |
| 9. Final security audit | ⬜ Planned | Verify delivery paths, cache behavior, Reader compatibility, admin flows, and documentation |

---

## Milestone 1 — Baseline media hardening

**Status:** 🟨 In progress — merged and CI-verified; production validation pending

Low-risk hardening of the delivery surface before changing how book URLs are generated.

### Implementation

- [x] Reject browser requests for EPUB files when `Sec-Fetch-Site: cross-site`.
- [x] Add `Cross-Origin-Resource-Policy: same-origin` to EPUB and catalog responses.
- [x] Remove upstream CORS response headers from protected EPUB/catalog responses.
- [x] Add `X-Robots-Tag` anti-index/archive headers to EPUB/catalog delivery.
- [x] Add `robots.txt` rules for `/media/`, `/admin.html`, `/admin-api/`, and future `/book-access/` routes.
- [x] Keep Range forwarding unchanged so same-origin Reader seeking remains supported.
- [x] Preserve existing Cloudflare cache behavior and private B2 origin.
- [x] Extend repository checks so the baseline hardening cannot accidentally disappear.
- [x] Pass repository CI.
- [ ] Production smoke-test Main/Adult catalog loading plus Reader Pages/Continuous and seeking.

### Acceptance criteria

1. Shadow Garden itself can still load both catalogs and EPUBs.
2. Range requests from the Reader still work.
3. A normal browser request initiated from an unrelated origin cannot use the EPUB endpoint as a hotlink.
4. Search/archive crawlers receive explicit instructions not to index media/admin endpoints.
5. No catalog schema change is introduced yet.

---

## Milestone 2 — Signed book access tickets

**Status:** ⬜ Planned

Replace permanently reusable EPUB delivery URLs with short-lived HMAC-authorized access.

### Planned design

- `/book-access/:bookId` issues a short-lived ticket.
- Ticket contains book identity, expiry, nonce/session binding, and HMAC signature.
- `/media/book/:bookId?...` validates the ticket before resolving the private B2 object.
- Initial target lifetime: roughly 10 minutes, configurable.
- Range requests remain valid for the ticket lifetime.
- Cloudflare cache uses a canonical book cache key after authorization so unique signatures do not fragment cached EPUBs.
- Signing secret exists only as a Cloudflare secret such as `SG_MEDIA_SIGNING_SECRET`.

### Acceptance criteria

- Copying a protected EPUB URL stops working after expiry.
- Changing the book ID or expiry invalidates the signature.
- Existing Reader functions work without prompting on every Range request.

---

## Milestone 3 — Opaque public book identifiers

**Status:** ⬜ Planned

Remove durable B2 object names from data exposed to unauthenticated clients.

### Planned design

- Public catalog exposes opaque stable `bookId` values instead of direct object paths for EPUB acquisition.
- Server-side resolver maps `bookId` to the actual B2 object key.
- IDs are non-sequential and non-enumerable.
- Catalog migration remains backward-compatible during rollout.

---

## Milestone 4 — Human access sessions

**Status:** ⬜ Planned

Use Cloudflare Turnstile Free as an occasional human verification layer rather than placing a challenge in front of every book request.

### Planned design

- First protected book acquisition requests verification when no valid access session exists.
- Successful verification creates a signed same-site access-session cookie/token.
- Proposed normal session lifetime: 8–12 hours.
- Ordinary browsing/catalog viewing remains challenge-free.
- Suspicious bulk behavior can require re-verification.

---

## Milestone 5 — Bulk-download throttling

**Status:** ⬜ Planned

Use the Cloudflare Free rate-limiting allowance on **new book authorizations**, not EPUB Range requests.

### Initial policy to test

- Normal use: no interruption.
- Approximately 15–25 different book authorization attempts per IP/session in 10 minutes: Managed Challenge or temporary denial.
- Do not count individual Range requests as separate books.
- Later add session-level unique-book tripwires if needed.

Cloudflare dashboard changes will be documented here because they are not stored in the GitHub repository.

---

## Milestone 6 — Bot and crawler controls

**Status:** ⬜ Planned

Free Cloudflare configuration pass:

- Bot Fight Mode.
- Block/limit AI crawler policies available on the Free plan.
- AI Labyrinth where appropriate.
- Review known-good crawler impact before leaving controls enabled.
- Keep `robots.txt` as the compliant-crawler baseline even though malicious bots can ignore it.

---

## Milestone 7 — Garden Keeper hardening

**Status:** ⬜ Planned

The concealed ✦ shortcut remains convenience/camouflage only; authentication remains server enforced.

### Planned work

- Turnstile verification for Garden Keeper unlock.
- Rate-limit repeated unlock failures.
- Generic authentication failure responses.
- Optional short escalating client/server cooldown without revealing which check failed.
- Preserve token-only server authorization for every mutation API.

---

## Milestone 8 — Abuse telemetry and response

**Status:** ⬜ Planned

Create a lightweight operational playbook using free Cloudflare Security Analytics and existing logs.

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

- Main Library catalog and covers.
- Adult Library catalog and covers.
- Series pages.
- Reader Pages mode.
- Reader Continuous mode.
- Range requests and seeking.
- Page Map / Visual Page Cache behavior.
- Continue Reading and bookmarks.
- Garden Keeper unlock.
- New Books and series-specific uploads.
- Catalog History restore/delete.
- Trash restore/purge.
- Cache behavior after ticket validation.
- Expired/tampered access URLs.
- Cross-origin/hotlink attempts.

---

## Explicit non-goals

Shadow Garden will not rely on fake client-side protection such as disabling right-click, blocking DevTools, Base64-obscuring URLs, encrypting an EPUB with a browser-delivered key, or relying only on `Referer`. Those measures mainly inconvenience legitimate readers and provide little resistance to automated clients.
