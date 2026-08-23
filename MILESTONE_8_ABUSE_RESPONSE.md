# Milestone 8 — Abuse telemetry and response

Shadow Garden v1.14.0 adds a lightweight, free-only abuse telemetry layer for the existing `pages.dev` deployment. It is designed to make repeated suspicious behavior visible and temporarily expensive without putting a limiter in the EPUB Reader's Range path.

## Public tripwire policy

Suspicious public-access signals accumulate within a rolling **15-minute** window. Each network receives an opaque HMAC-derived identity based on Cloudflare's `CF-Connecting-IP`; the **raw IP** is never written to storage.

The tripwire activates at **score 12** and applies a **10-minute** cooldown to `/book-access` and `/human-access` only.

Signal weights:

- automated/script client denied: 4
- rejected Turnstile challenge: 2
- Milestone 5 unique-book acquisition limit reached: 12
- cross-site EPUB request denied: 4
- non-Range EPUB request with a missing/invalid ticket: 1

Examples:

- three automation denials inside 15 minutes → cooldown;
- six rejected Turnstile attempts → cooldown;
- three cross-site EPUB attempts → cooldown;
- reaching the 20-unique-book Milestone 5 limit → immediate cooldown.

Once the cooldown expires, the next suspicious signal starts a fresh score window rather than extending an old punishment indefinitely.

## Reader safety

Milestone 8 deliberately does **not** check or enforce the public abuse cooldown inside `/media/*`.

Valid EPUB GET/HEAD/Range requests therefore remain governed only by the existing signed media-ticket boundary. A stale Reader Range request after ticket expiry can legitimately receive a 403 while the Reader reauthorizes; those Range denials are logged to Pages/Functions output but do not add persistent tripwire score.

Cross-site EPUB denials and invalid **non-Range** ticket requests can add telemetry signals because they are outside normal Reader recovery behavior.

## Persistent telemetry

Tripwire state is stored privately in Backblaze B2 under:

`shadow-garden/security/abuse-state/<opaque-client-id>.json`

Only a newly activated public cooldown creates a persistent Abuse Watch ledger entry. This keeps routine successful reads out of telemetry and avoids writing one permanent record for every normal request.

The bounded ledger lives at:

`shadow-garden/security/abuse-ledger.json`

It retains up to 100 recent events for seven days. Event records contain opaque network identifiers, trigger type, score/counters, and cooldown timing. They do not contain raw IP addresses, requested EPUB paths, tokens, Turnstile responses, or browser fingerprints.

Garden Keeper cooldowns of 60 seconds or longer are also written to this ledger so repeated admin probing is visible without duplicating every failed token attempt.

Cloudflare Pages/Functions console logging remains the low-cost source for individual cross-site media denials, ticket failures, automation denials, and Turnstile rejections that never reach the persistent tripwire threshold.

## Garden Keeper — Abuse Watch

Garden Maintenance now mounts an **Abuse Watch** card after Garden Health. It shows:

- active public cooldown count;
- recent persisted security events;
- the configured tripwire window and cooldown duration;
- opaque shortened network IDs;
- trigger and score information;
- significant Garden Keeper cooldowns.

An active public cooldown can be manually released from Abuse Watch. Releasing a cooldown deletes only that network's active abuse-state object and marks the ledger entry as released; the historical event remains visible until normal retention removes it.

The review API is `/admin-api/abuse` and remains behind the same bearer-token + signed `sg_admin_session` authorization boundary as every other Garden Keeper API.

## Failure model

Milestone 8 is additive telemetry, not the primary authorization boundary. If its B2 telemetry lookup fails, `/book-access` and `/human-access` log the problem and continue through the existing signed-ticket, Turnstile, and acquisition-limit protections instead of locking legitimate readers out because the telemetry store is temporarily unavailable.

The existing Milestone 7 Garden Keeper throttle remains fail-closed because that state is directly part of admin authentication protection.

## Production acceptance checklist

After v1.14.0 deploys:

- [ ] Ordinary Main and Adult Library browsing is unchanged.
- [ ] Reader Pages and Continuous modes still open EPUBs normally.
- [ ] Reader Range/seek requests remain unaffected by M8 cooldown enforcement.
- [ ] Normal book opening and Turnstile verification remain smooth with no suspicious signals.
- [ ] Repeated obvious automation/Turnstile failures eventually return `429 abuse_cooldown` on `/book-access` or `/human-access`.
- [ ] The same network cannot reset an active M8 cooldown by opening Incognito or clearing cookies.
- [ ] A different public network does not inherit another network's M8 state.
- [ ] Hitting the M5 unique-book limit creates an M8 tripwire activation.
- [ ] Garden Keeper → Maintenance shows the Abuse Watch card.
- [ ] Abuse Watch shows a newly activated public cooldown without exposing a raw IP address.
- [ ] Releasing an active cooldown from Abuse Watch makes that network eligible to try again.
- [ ] Garden Keeper failed-token cooldowns still behave as Milestone 7 specifies.
- [ ] A 60-second-or-longer Keeper cooldown appears as a recent Abuse Watch event.

Once these checks pass, Milestone 8 can be marked complete and Milestone 9 can begin.
