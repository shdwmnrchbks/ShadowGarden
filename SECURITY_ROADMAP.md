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
| 3. Opaque public book identifiers | 🟨 In progress | Hide durable EPUB object paths from public catalog/download UI; code implementation complete, CI + production validation pending |
| 4. Human access sessions | ⬜ Planned | Free Cloudflare Turnstile session verification before protected book acquisition |
| 5. Bulk-download throttling | ⬜ Planned | Free Cloudflare rate-limiting rule and unique-book acquisition policy |
| 6. Bot and crawler controls | ⬜ Planned | Bot Fight Mode, AI bot controls, AI Labyrinth, crawler policy |
| 7. Garden Keeper hardening | ⬜ Planned | Turnstile/rate-limit admin unlock and reduce authentication probing |
| 8. Abuse telemetry and response | ⬜ Planned | Security Analytics review procedure, tripwires, temporary cooldown policy |
| 9. Final security audit | ⬜ Planned | Verify delivery paths, cache behavior, Reader compatibility, admin flows, and documentation |

---

## Milestone 1 — Baseline media hardening

**Status:** ✅ Done

Implemented and production-validated.

### Completed

- [x] Reject browser EPUB requests when `Sec-Fetch-Site: cross-site`.
- [x] Add `Cross-Origin-Resource-Policy: same-origin` to protected media/catalog responses.
- [x] Strip upstream CORS exposure headers from protected responses.
- [x] Add `X-Robots-Tag` anti-index/archive headers.
- [x] Add crawler exclusions for `/media/`, `/admin.html`, `/admin-api/`, and `/book-access`.
- [x] Preserve Reader Range requests and Cloudflare caching.
- [x] Add repository regression checks.
- [x] Pass CI and production Reader/catalog smoke tests.

---

## Milestone 2 — Signed book access tickets

**Status:** ✅ Done

Short-lived authorization is active in Production and was validated before Milestone 3 work began.

### Completed

- [x] Add same-origin `/book-access` ticket issuance.
- [x] Sign EPUB authorization with HMAC-SHA256.
- [x] Default signed URLs to roughly 10 minutes.
- [x] Bind signatures to the exact EPUB path and expiry.
- [x] Use an HttpOnly, Secure, SameSite=Strict cookie scoped to the exact EPUB path for Reader requests.
- [x] Automatically renew Reader authorization during long reading sessions.
- [x] Preserve HTTP Range requests and canonical Cloudflare EPUB cache keys.
- [x] Intercept Series-page downloads and issue fresh signed URLs.
- [x] Configure Production `SG_MEDIA_SIGNING_SECRET`.
- [x] Verify `/book-access` returns `200`, `active`, `protected: true`, and an expiring signed URL.
- [x] Verify bare EPUB URLs are denied in a fresh private/incognito session.
- [x] Deploy v1.8.2 fail-closed behavior: a missing/invalid signing secret produces unavailable media instead of public EPUB fallback.
- [x] Pass repository CI and production Reader/download validation.

---

## Milestone 3 — Opaque public book identifiers

**Status:** 🟨 In progress — implementation complete; CI and production validation pending

Remove durable EPUB/B2 object names from data exposed to unauthenticated clients while retaining the private B2 catalogs as Garden Keeper's source of truth.

### Implementation

- [x] Add stable opaque identifiers in the form `bk_<opaque-id>`.
- [x] Make IDs non-sequential using SHA-256-derived opaque values for legacy migration.
- [x] Redact EPUB `file` paths from the public Main and Adult catalog responses.
- [x] Redact private `sha256` and `originalFilename` fields from public catalog responses.
- [x] Keep the unredacted B2 catalogs private and available to authenticated Garden Keeper workflows.
- [x] Add a server-side `bookId` → cataloged EPUB path resolver.
- [x] Restrict legacy raw-path authorization to EPUBs that actually exist in a current private catalog.
- [x] Make `/book-access` accept opaque `bookId` values and return signed Milestone 2 delivery URLs.
- [x] Keep direct EPUB delivery protected by Milestone 2 tickets/cookies.
- [x] Normalize public volume data so existing Library/Series code receives `volume.file = bookId`, never the storage path.
- [x] Migrate existing path-keyed Continue Reading progress to opaque-ID aliases without deleting the old local data.
- [x] Migrate Reader bookmark/progress aliases when an affected book is opened.
- [x] Resolve an opaque Reader URL before EPUB initialization while leaving the stabilized Reader core, Continuous Core, Page Map, and Visual Page Cache unchanged.
- [x] Make Download EPUB links expose only an opaque ID before authorization.
- [x] Reject stale pre-Milestone-3 raw catalog cache entries unless they carry `X-SG-Catalog-View: opaque-v1`.
- [x] Preserve existing Garden Keeper catalog cache invalidation behavior.
- [x] Persist `bookId` on new Garden Keeper uploads.
- [x] Preserve the prior `bookId` when an existing volume's EPUB object is replaced.
- [x] Refresh the resolver once on a cache miss so a just-uploaded book can be authorized immediately.
- [x] Extend security regression tests for public redaction, opaque-ID determinism, resolver wiring, and legacy fallback restrictions.
- [ ] Pass GitHub Actions CI on the Milestone 3 PR.
- [ ] Production smoke-test Main/Adult Library, Reader, downloads, Continue Reading, and Garden Keeper upload/replace behavior.

### Acceptance criteria

1. Public Main and Adult catalog responses contain `bookId` for each EPUB volume and do **not** expose the volume's `/media/...epub` path.
2. Public catalog responses do not expose EPUB SHA-256 hashes or original upload filenames.
3. Copying the visible **Download EPUB** link exposes an opaque `bk_...` identifier rather than the storage path.
4. Clicking **Download EPUB** still downloads the EPUB through a fresh Milestone 2 signed URL.
5. Start Reading, Recently Added, and Continue Reading open the correct volume.
6. Existing reading progress survives the migration.
7. Pages, Continuous, seeking, bookmarks, Page Map, and Visual Page Cache remain functional.
8. A known bare `/media/...epub` URL still returns a denial in a fresh incognito session.
9. `/book-access` with a valid current `bookId` succeeds; a random/unknown `bookId` returns 404.
10. A newly uploaded volume receives a stable `bookId`; replacing its EPUB file preserves that ID.
11. Garden Keeper management, Trash, Catalog History, backup/restore, and maintenance continue to operate against the private full catalogs.

Milestone 4 must not begin until these production checks pass.

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
