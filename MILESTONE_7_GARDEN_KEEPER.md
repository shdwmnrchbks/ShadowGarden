# Milestone 7 — Garden Keeper hardening

Shadow Garden v1.13.1 hardens the Garden Keeper unlock boundary while remaining fully compatible with the free `pages.dev` deployment.

## What changed

Garden Keeper now uses a dedicated `/admin-access` flow before any `/admin-api/*` request is accepted.

A valid unlock requires all of the following:

1. a normal browser request that is not rejected by the Milestone 6 automation policy;
2. a successful Cloudflare Turnstile response using the `admin_access` action on the current hostname;
3. the correct `SG_ADMIN_TOKEN`.

On success, the server issues a signed one-hour `sg_admin_session` cookie scoped to `/admin-api`. Every admin API request still requires the bearer admin token **and** this signed session.

## Failed unlock cooldown

Wrong keeper-token attempts are now tracked **server-side** instead of trusting browser cookie state.

Cloudflare supplies `CF-Connecting-IP` to the Pages Function. Shadow Garden never writes that raw IP address to storage: it first derives an HMAC identifier using `SG_MEDIA_SIGNING_SECRET`, then stores only that opaque identifier beneath the private Backblaze B2 prefix:

`shadow-garden/security/admin-throttle/<opaque-id>.json`

The existing signed `sg_admin_failures` HttpOnly cookie remains only as a compatibility/UI mirror. It is no longer authoritative for deciding whether an unlock is allowed.

This means attempts from a normal window, Incognito window, or a browser with cleared cookies share the same cooldown while they come from the same public IP. A different public IP receives a separate failure budget. A successful keeper-token authentication clears the server-side failure record for that client identity.

The cooldown schedule remains intentionally modest for legitimate use:

- first failed token: no delay;
- second: 5 seconds;
- third: 15 seconds;
- fourth: 60 seconds;
- fifth: 5 minutes;
- sixth and later: 15 minutes.

During a cooldown, `/admin-access` returns HTTP `429` with `Retry-After`. Garden Keeper shows the remaining wait time. If the private server-side throttle store cannot be read or updated, the unlock path fails closed with a temporary-unavailable response rather than silently reverting to cookie-only throttling.

No KV namespace, custom domain, or paid Cloudflare feature is required; the throttle reuses Shadow Garden's existing private Backblaze B2 credentials.

### Expected network behavior

- Normal browser → wrong token → cooldown is recorded server-side.
- Incognito on the same network → inherits the same cooldown.
- Clearing cookies → does not reset the cooldown.
- Another device behind the same public IP → shares the cooldown.
- A different public IP → has a separate cooldown state.
- Successful authentication after the cooldown → clears that client's server-side failure state.

This is intentionally keyed to the public network identity, so shared NAT networks also share the Garden Keeper failure budget. That is acceptable for the private Keeper surface and avoids storing persistent browser fingerprints.

## Generic failures

The unlock boundary deliberately avoids telling the client whether the Turnstile result or keeper token was incorrect. Ordinary authentication failures use the same public response:

`Access denied. Please try again.`

Operational configuration/storage failures remain distinguishable as temporary/unavailable errors so the owner can diagnose a broken deployment.

## Admin API boundary

The shared `adminAuthorized` function requires:

- `Authorization: Bearer <SG_ADMIN_TOKEN>` to match in constant time; and
- a fresh valid signed `sg_admin_session` cookie.

This protects the existing status, library, catalog, upload, backup, maintenance, and series-banner APIs without duplicating auth logic in each endpoint.

## Production acceptance checklist

After the v1.13.1 Cloudflare Pages deployment is live:

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
- [ ] While that cooldown is active, open an Incognito window on the same connection and confirm the cooldown is still enforced.
- [ ] Clear ordinary browser cookies and confirm the same-network cooldown is still enforced.
- [ ] Confirm later failures escalate according to the documented schedule.
- [ ] After the cooldown expires, authenticate successfully and confirm a later fresh failure starts again at the first-failure level.
- [ ] Confirm a direct `/admin-api/status` request with the keeper token but without `sg_admin_session` is rejected.
- [ ] Confirm Main/Adult Library, Series, Reader, Turnstile book acquisition, and EPUB Range requests remain unaffected.

Once these checks pass, Milestone 7 can be marked complete and Milestone 8 can begin.
