# Milestone 5 — pages.dev deployment notes

**Status:** ✅ Complete

Shadow Garden v1.11.0 added the application-side Milestone 5 protection: a signed, HttpOnly rolling budget of **20 different books per 10 minutes** on `/book-access`. Re-authorizing the same book does not consume another unique-book slot, and EPUB `/media/*` Range requests are never counted.

## Current hosting constraint

Shadow Garden intentionally stays on `shadowgarden-bon.pages.dev` and does not use a custom domain/zone.

Cloudflare zone-level WAF rate-limiting rules therefore cannot be attached to this deployment. A custom domain is **not required** for Shadow Garden, and Milestone 5 does not require purchasing one.

The previously planned IP-level Cloudflare burst rule is consequently **deferred by hosting/platform constraint**, not treated as an incomplete mandatory step.

## Active Milestone 5 protection

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

## Acceptance

Milestone 5 was accepted when the project owner instructed Shadow Garden to proceed to Milestone 6 on the existing `pages.dev` deployment.

- [x] Normal Read/Download remains under the existing Garden Pass boundary.
- [x] Same-book authorization is excluded from additional unique-book consumption by design and regression test.
- [x] Pages/Continuous reading, seeking, Page Map, Visual Page Cache, bookmarks, progress restore, and Range requests stay outside the limiter.
- [x] Regression tests confirm that 20 distinct books inside 10 minutes are allowed and the 21st different book is throttled with `Retry-After`.
- [x] Regression tests confirm the rolling budget recovers after the 10-minute window.
- [x] Main/Adult Library browsing, Series pages, covers, and catalogs remain outside the limiter.
- [x] Milestones 2–4 remain the underlying signed-ticket, opaque-ID, and human-session protections.