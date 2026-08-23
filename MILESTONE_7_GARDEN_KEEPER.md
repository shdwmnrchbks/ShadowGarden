# Milestone 7 — Garden Keeper hardening

Shadow Garden v1.13.0 hardens the Garden Keeper unlock boundary while remaining fully compatible with the free `pages.dev` deployment.

## What changed

Garden Keeper now uses a dedicated `/admin-access` flow before any `/admin-api/*` request is accepted.

A valid unlock requires all of the following:

1. a normal browser request that is not rejected by the Milestone 6 automation policy;
2. a successful Cloudflare Turnstile response using the `admin_access` action on the current hostname;
3. the correct `SG_ADMIN_TOKEN`.

On success, the server issues a signed one-hour `sg_admin_session` cookie scoped to `/admin-api`. Every admin API request still requires the bearer admin token **and** this signed session.

## Failed unlock cooldown

Wrong keeper-token attempts are tracked in a signed HttpOnly cookie scoped to `/admin-access`.

The cooldown schedule is intentionally modest for legitimate use:

- first failed token: no delay;
- second: 5 seconds;
- third: 15 seconds;
- fourth: 60 seconds;
- fifth: 5 minutes;
- sixth and later: 15 minutes.

During a cooldown, `/admin-access` returns HTTP `429` with `Retry-After`, and Garden Keeper shows the remaining wait time.

The failure state is browser/session deterrence rather than an IP-global lockout. A determined client can discard browser state, but doing so still leaves the independent Turnstile requirement in place. No custom domain or paid Cloudflare feature is required.

## Generic failures

The unlock boundary deliberately avoids telling the client whether the Turnstile result or keeper token was incorrect. Ordinary authentication failures use the same public response:

`Access denied. Please try again.`

Operational configuration failures remain distinguishable as temporary/unavailable errors so the owner can diagnose a broken deployment.

## Admin API boundary

The shared `adminAuthorized` function now requires:

- `Authorization: Bearer <SG_ADMIN_TOKEN>` to match in constant time; and
- a fresh valid signed `sg_admin_session` cookie.

This protects the existing status, library, catalog, upload, backup, maintenance, and series-banner APIs without duplicating auth logic in each endpoint.

## Production acceptance checklist

After the v1.13.0 Cloudflare Pages deployment is live:

- [ ] Open Garden Keeper in a normal browser and enter the correct keeper token.
- [ ] Confirm Turnstile appears and a successful challenge unlocks the dashboard.
- [ ] Confirm normal Library management loads after unlock.
- [ ] Confirm New Books upload still works.
- [ ] Confirm series metadata/status/banner editing still works.
- [ ] Confirm Catalog History create/restore/delete still works.
- [ ] Confirm Maintenance and Trash restore/purge still work.
- [ ] Press the Garden Keeper lock control, then confirm the dashboard cannot be re-entered without a fresh unlock flow.
- [ ] Enter a wrong keeper token once and confirm only the generic denial is shown.
- [ ] Enter it incorrectly again and confirm the 5-second cooldown appears.
- [ ] Confirm later failures escalate according to the documented schedule.
- [ ] Confirm a direct `/admin-api/status` request with the keeper token but without `sg_admin_session` is rejected.
- [ ] Confirm Main/Adult Library, Series, Reader, Turnstile book acquisition, and EPUB Range requests remain unaffected.

Once these checks pass, Milestone 7 can be marked complete and Milestone 8 can begin.
