# Milestone 8 — Abuse telemetry and response

**Status:** ✅ Complete — production accepted 2026-08-24

Shadow Garden v1.14.0 added a lightweight abuse telemetry layer for the free `pages.dev` deployment without putting a limiter in the EPUB Reader's Range path.

## Public tripwire policy

Suspicious public-access signals accumulate within a rolling **15-minute** window. Each network receives an opaque HMAC-derived identity from Cloudflare's `CF-Connecting-IP`; the **raw IP** is never persisted.

The tripwire activates at **score 12** and applies a **10-minute** cooldown to `/book-access` and `/human-access` only.

Signal weights:

- automated/script client denied: 4
- rejected Turnstile challenge: 2
- Milestone 5 unique-book acquisition limit reached: 12
- cross-site EPUB request denied: 4
- non-Range EPUB request with missing/invalid ticket: 1

M8 never enforces the public cooldown inside `/media/*`, preserving normal EPUB GET/HEAD/Range behavior and Reader ticket-renewal recovery.

## Persistent telemetry

Private state is stored beneath:

- `shadow-garden/security/abuse-state/<opaque-client-id>.json`
- `shadow-garden/security/abuse-ledger.json`

The bounded ledger retains up to 100 recent events for seven days and excludes raw IP addresses, EPUB paths, tokens, Turnstile responses, and browser fingerprints.

## Garden Keeper — Abuse Watch

Abuse Watch shows active cooldowns and recent significant security events using shortened opaque network identifiers. Authenticated `/admin-api/abuse` operations can release an active public cooldown without erasing its historical ledger entry.

## Acceptance

- [x] Ordinary Main and Adult Library browsing remains unchanged.
- [x] Reader Pages and Continuous modes remain healthy.
- [x] Reader Range/seek requests remain outside M8 cooldown enforcement.
- [x] Repeated suspicious signals can trigger `429 abuse_cooldown` at the protected acquisition boundaries.
- [x] Same-network Incognito/cleared-cookie sessions inherit active cooldowns.
- [x] Different public networks receive independent state.
- [x] Reaching the M5 unique-book limit activates the tripwire.
- [x] Abuse Watch displays active/recent events without raw IP addresses.
- [x] Manual release clears the active restriction while retaining history.
- [x] Garden Keeper cooldown behavior from Milestone 7 remains intact.