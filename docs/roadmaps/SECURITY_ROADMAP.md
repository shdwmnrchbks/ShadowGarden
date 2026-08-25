# Shadow Garden Security & Anti-Abuse Roadmap

**Status:** ✅ Completed 2026-08-24  
**Accepted production baseline:** v1.15.14  
**Deployment:** `shadowgarden-bon.pages.dev`

This roadmap records the completed free-only hardening work for Shadow Garden against bulk EPUB scraping, hotlinking, automated aggregation, nuisance attacks, and Garden Keeper abuse.

The design goal is **deterrence and abuse resistance, not DRM**. Any EPUB delivered to a legitimate browser can ultimately be copied by a determined user. Shadow Garden instead makes automated harvesting, durable hotlinks, enumeration, high-volume acquisition, and admin probing more expensive while keeping ordinary reading smooth.

Shadow Garden intentionally remains on the free `pages.dev` hostname. A custom domain is not required. Cloudflare controls that need a customer-owned zone remain optional future hardening rather than incomplete roadmap work.

## Final status

| Milestone | Status | Scope |
| --- | --- | --- |
| 1. Baseline media hardening | ✅ Done | Same-origin browser policy, cross-site EPUB rejection, crawler controls, anti-indexing headers |
| 2. Signed book access tickets | ✅ Done | HMAC tickets, expiring media URLs, path-scoped Reader authorization, fail-closed enforcement |
| 3. Opaque public book identifiers | ✅ Done | Public `bk_...` identities, catalog redaction, opaque Reader/download URLs, private media boundary |
| 4. Human access sessions | ✅ Done | Turnstile + signed 12-hour `/book-access` human session; accepted 2026-08-23 |
| 5. Bulk-download throttling | ✅ Done | Signed 20-unique-book/10-minute acquisition budget; zone WAF burst rule deferred on `pages.dev` |
| 6. Bot and crawler controls | ✅ Done | Repository crawler policy, protected-endpoint automation screening, Reader anti-indexing; accepted with M9 on 2026-08-24 |
| 7. Garden Keeper hardening | ✅ Done | Turnstile-gated unlock, signed admin session, server-side cross-session cooldowns; accepted 2026-08-24 |
| 8. Abuse telemetry and response | ✅ Done | HMAC network tripwires, temporary public cooldowns, private Abuse Watch ledger; accepted 2026-08-24 |
| 9. Final security audit | ✅ Done | End-to-end delivery, Reader, cache, admin, anti-abuse, opaque-cover, and documentation audit; accepted 2026-08-24 |

## Baseline guarantees preserved after completion

### Media and acquisition

- Private Backblaze B2 remains the origin store.
- Public EPUB access uses opaque `bk_...` identifiers rather than storage paths.
- `/book-access` is the signed authorization boundary for new EPUB acquisition.
- `/media/*` preserves GET/HEAD/Range behavior for the Reader and is not burdened with acquisition throttling or crawler User-Agent filtering.
- Tampered/expired/unauthorized EPUB media requests fail closed.
- Cross-site browser EPUB requests are rejected.
- Cover object keys for new uploads use opaque random `cv_...` identifiers.

### Human and bulk-access controls

- Turnstile-backed Garden Pass sessions protect book acquisition without interrupting normal page turns/seeks.
- The acquisition budget allows 20 distinct books per rolling 10 minutes per signed browser state; same-book reauthorization does not consume another slot.
- Known AI crawlers, obvious script/headless clients, and missing User-Agent requests are screened at protected acquisition endpoints.
- `robots.txt` and Reader `X-Robots-Tag` policies keep sensitive/private reading surfaces out of normal indexing.

### Garden Keeper

- `/admin-access` requires Turnstile plus the Keeper token.
- `/admin-api/*` requires the bearer token and a signed one-hour `sg_admin_session`.
- Failed unlock cooldowns are server-side and keyed by an HMAC-derived network identity, so Incognito/cleared cookies cannot reset the same-network cooldown.
- Raw IP addresses are not persisted.
- Explicit locking clears the admin session.

### Abuse response

- Suspicious public signals accumulate in a rolling 15-minute window.
- Score 12 activates a 10-minute cooldown on `/book-access` and `/human-access`, never on `/media/*`.
- Abuse Watch stores only bounded, private, opaque telemetry and supports authenticated manual release.

## Milestone records

Detailed implementation and acceptance history is archived under [`../security/`](../security/):

- [Milestone 5 — pages.dev deployment notes](../security/MILESTONE_5_CLOUDFLARE.md)
- [Milestone 6 — bot and crawler controls](../security/MILESTONE_6_CRAWLER_POLICY.md)
- [Milestone 7 — Garden Keeper hardening](../security/MILESTONE_7_GARDEN_KEEPER.md)
- [Milestone 8 — abuse telemetry and response](../security/MILESTONE_8_ABUSE_RESPONSE.md)
- [Milestone 9 — final security audit](../security/MILESTONE_9_FINAL_AUDIT.md)

## Deferred zone-only options

If Shadow Garden ever moves to a customer-owned Cloudflare zone, the following may be evaluated as optional extra hardening:

- Bot Fight Mode
- AI Crawl Control
- AI Labyrinth
- Cloudflare-managed AI crawler/robots controls
- independent zone-level WAF burst limiting for `/book-access`

They are **not** required for the accepted `pages.dev` security baseline.

## Explicit non-goals

Shadow Garden does not rely on fake client-side protection such as disabling right-click, blocking DevTools, Base64-obscuring URLs, browser-delivered encryption keys, or `Referer` alone. Those measures mainly inconvenience legitimate readers and provide little resistance to automated clients.

## Next roadmap

The active project plan is now the [Full Refactor Roadmap](./REFACTOR_ROADMAP.md). Every refactor milestone must preserve the completed security guarantees above.