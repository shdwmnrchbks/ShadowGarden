# Milestone 7 — Garden Keeper hardening

**Status:** ✅ Complete — production accepted 2026-08-24

Shadow Garden v1.13.1 hardened the Garden Keeper unlock boundary while remaining compatible with the free `pages.dev` deployment.

## Accepted security boundary

A valid unlock requires:

1. a normal browser request not rejected by the automation policy;
2. a successful Cloudflare Turnstile result using the `admin_access` action; and
3. the correct `SG_ADMIN_TOKEN`.

The server then issues a signed one-hour `sg_admin_session` cookie scoped to `/admin-api`. Every Garden Keeper API request requires both the bearer admin token and the signed session.

## Server-side failed-unlock cooldown

Wrong Keeper-token attempts are tracked **server-side**. Cloudflare's `CF-Connecting-IP` is transformed with HMAC using `SG_MEDIA_SIGNING_SECRET`; the **raw IP** is never written to storage.

Private state lives in Backblaze B2 beneath:

`shadow-garden/security/admin-throttle/<opaque-id>.json`

The browser `sg_admin_failures` cookie is only a compatibility/UI mirror and is not authoritative.

As a result:

- normal and Incognito windows on the same public network share cooldown state;
- clearing cookies does not reset the cooldown;
- devices behind the same public IP share the failure budget;
- a different public IP receives a separate budget;
- successful authentication clears the server-side record.

Cooldown schedule:

- first failed token: no delay
- second: 5 seconds
- third: 15 seconds
- fourth: 60 seconds
- fifth: 5 minutes
- sixth and later: 15 minutes

If the private throttle store cannot be used, the admin unlock path fails closed rather than silently reverting to browser-only state.

## Acceptance

- [x] Correct token + Turnstile unlocks Garden Keeper.
- [x] Wrong-token cooldown escalates as designed.
- [x] Incognito/cleared-cookie sessions on the same network cannot bypass the cooldown.
- [x] Successful authentication clears failure state.
- [x] Explicit locking requires a fresh unlock.
- [x] Direct admin API access without the signed admin session is rejected.
- [x] Library management, uploads, metadata/status/banner edits, Catalog History, Maintenance, and Trash continue to operate.
- [x] Public Library/Series/Reader and EPUB Range behavior remain unaffected.