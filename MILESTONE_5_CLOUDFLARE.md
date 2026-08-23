# Milestone 5 — Cloudflare Free rate-limit setup

Shadow Garden v1.11.0 adds the application-side part of Milestone 5: a signed, HttpOnly rolling budget of **20 different books per 10 minutes** on `/book-access`. Re-authorizing the same book does not consume another unique-book slot, and EPUB `/media/*` Range requests are never counted by this application limiter.

Cloudflare Free should provide the independent IP-level burst layer.

## Why the Cloudflare rule is a burst rule

As of August 2026, Cloudflare Free provides one WAF rate-limiting rule, exposes `Path` and `Verified Bot` in the Free rule expression, and supports a **10-second** counting period. A 10-minute Cloudflare counting window is not available on Free. Therefore Shadow Garden splits Milestone 5 into two complementary controls:

- **Application/session:** 20 unique books per 10 minutes, signed with `SG_MEDIA_SIGNING_SECRET`.
- **Cloudflare/IP burst:** 8 requests to `/book-access` per 10 seconds, then Managed Challenge.

This keeps ordinary Reader ticket renewal and EPUB Range requests out of the hot path while making fast authorization scraping expensive.

## Dashboard configuration

In the Cloudflare dashboard for the Shadow Garden zone:

1. Open **Security → Security rules** and create a **Rate limiting rule**.
2. Name it `Shadow Garden book-access burst`.
3. Match **URI Path equals `/book-access`**.
4. Set the rate to **8 requests** per **10 seconds**.
5. Use the default per-IP counting characteristic supplied by the dashboard.
6. Choose **Managed Challenge** as the action.
7. Save/deploy the rule.

Do **not** target `/media/*`, EPUB files, Range requests, covers, catalogs, Reader assets, `/human-access`, or ordinary Library/Series navigation.

## Production acceptance

After v1.11.0 is deployed and the Cloudflare rule is enabled:

- [ ] A normal first Read/Download succeeds after the existing Garden Pass behavior.
- [ ] Opening or renewing the same book repeatedly does not consume extra unique-book slots.
- [ ] Normal Pages/Continuous reading, seeking, Page Map, Visual Page Cache, bookmarks, and Range requests remain unaffected.
- [ ] Opening 20 different books within 10 minutes is allowed; the next different book returns HTTP 429 with `Retry-After`.
- [ ] The 429 clears after the rolling window expires.
- [ ] A burst above 8 `/book-access` requests in 10 seconds from one IP triggers Cloudflare Managed Challenge.
- [ ] Main/Adult Library browsing, Series pages, covers, and catalogs remain challenge-free.
- [ ] Milestone 2 bare-media denial, Milestone 3 opaque IDs, and Milestone 4 Turnstile sessions remain intact.

Once these checks pass, Milestone 5 can be marked complete and Milestone 6 can begin.
