# Milestone 5 — pages.dev deployment notes

Shadow Garden v1.11.0 adds the application-side Milestone 5 protection: a signed, HttpOnly rolling budget of **20 different books per 10 minutes** on `/book-access`. Re-authorizing the same book does not consume another unique-book slot, and EPUB `/media/*` Range requests are never counted.

## Current hosting constraint

Shadow Garden is intentionally staying on the Cloudflare Pages hostname `shadowgarden-bon.pages.dev` and does not use a custom domain/zone.

Cloudflare zone-level WAF rate-limiting rules therefore cannot be attached to this deployment. A custom domain is **not required** for Shadow Garden, and Milestone 5 will not require purchasing one.

The previously planned IP-level Cloudflare burst rule is consequently **deferred by hosting/platform constraint**, not treated as an incomplete mandatory step.

## Active Milestone 5 protection

The repository implementation remains active on `pages.dev`:

- **20 unique books per rolling 10 minutes** at `/book-access`.
- State is signed with `SG_MEDIA_SIGNING_SECRET`.
- The state cookie is HttpOnly, Secure, SameSite=Strict and scoped to `/book-access`.
- Re-authorizing the same `bookId` does not consume another slot.
- The next different book after the budget is exhausted returns HTTP `429` with `Retry-After`.
- `/media/*`, HTTP Range requests, page turns, seeking, Page Map, Visual Page Cache, covers, catalogs and ordinary Library/Series browsing are not counted.

This is a deterrence layer rather than DRM. Because the unique-book budget is browser/session state, a determined client that deliberately discards browser state can eventually force a new human-verification flow. Milestone 4 Turnstile still raises the cost of doing so.

## Deferred optional layer

If Shadow Garden ever moves to a custom Cloudflare zone in the future, an optional independent IP burst rule can be added:

- URI Path equals `/book-access`
- 8 requests per 10 seconds
- Managed Challenge
- never target `/media/*`

This is **optional future hardening** and is not part of current Milestone 5 acceptance.

## Production acceptance

For the current `pages.dev` deployment:

- [ ] A normal first Read/Download still succeeds after the existing Garden Pass behavior.
- [ ] Opening or renewing the same book repeatedly does not consume additional unique-book slots.
- [ ] Normal Pages/Continuous reading, seeking, Page Map, Visual Page Cache, bookmarks, progress restore, and Range requests remain unaffected.
- [ ] Repository regression tests confirm that 20 distinct books inside 10 minutes are allowed and the 21st different book receives `429` with `Retry-After`.
- [ ] Repository regression tests confirm the rolling budget recovers after the 10-minute window.
- [ ] Main/Adult Library browsing, Series pages, covers, and catalogs remain challenge-free.
- [ ] Milestone 2 bare-media denial, Milestone 3 opaque IDs, and Milestone 4 Turnstile sessions remain intact.

Once these checks pass, Milestone 5 can be marked complete and Milestone 6 can begin.
