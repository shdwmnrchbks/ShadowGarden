# Milestone 6 — Bot and crawler controls without a custom domain

**Status:** ✅ Complete — accepted with Milestone 9 on 2026-08-24

Shadow Garden remains on the free `shadowgarden-bon.pages.dev` hostname. A custom domain is not required.

## Active policy

- `src/robots.txt` excludes `/media/`, `/reader.html`, `/admin.html`, `/admin-api/`, `/book-access`, and `/human-access` from normal crawler access.
- Common AI training/bulk-content crawlers receive full-site opt-out directives.
- `functions/_lib/crawler-policy.js` screens known AI crawler User-Agents, obvious script/headless clients, and missing User-Agent requests at `/book-access` and `/human-access`.
- User-Agent screening is deliberately a cheap deterrent rather than an authorization boundary; signed tickets, opaque IDs, Turnstile sessions, acquisition throttling, and M8 abuse response remain authoritative.
- `reader.html` is served with `X-Robots-Tag: noindex, nofollow, noarchive`.
- No crawler User-Agent policy is added to `/media/*`, preserving Reader GET/HEAD/Range behavior, Page Map, Visual Page Cache, seeking, and embedded resources.

## Deferred Cloudflare zone controls

The following remain **optional future hardening** if Shadow Garden ever moves to a customer-owned Cloudflare zone:

- Bot Fight Mode
- AI Crawl Control
- AI Labyrinth
- Cloudflare-managed AI crawler / robots controls

They are not required for the accepted `pages.dev` baseline.

## Acceptance

Milestone 6 production acceptance was closed as part of the Milestone 9 final regression pass.

- [x] Normal browser Read and Download flows remain functional.
- [x] Identified AI crawler/script clients are denied at protected acquisition endpoints.
- [x] The same automation policy is applied to `/human-access`.
- [x] Public Library and Series browsing remains normal.
- [x] Sensitive-route exclusions and Reader anti-indexing are present.
- [x] EPUB Range behavior and Reader rendering remain unaffected.
- [x] Milestones 2–5 remain intact.