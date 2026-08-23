# Milestone 6 — Bot and crawler controls without a custom domain

Shadow Garden stays on the free Cloudflare Pages hostname (`shadowgarden-bon.pages.dev`). The project intentionally does **not** require purchasing or attaching a custom domain.

Cloudflare's Bot Fight Mode, AI Crawl Control, managed AI crawler controls, and AI Labyrinth are zone/domain controls. Because the Pages hostname is not a customer-owned Cloudflare zone, those dashboard controls are not part of Shadow Garden's required security baseline.

Milestone 6 therefore uses protections that work directly in the Pages repository and Functions runtime.

## Active policy

### 1. Standards-based crawler instructions

`src/robots.txt` keeps normal public Library/Series pages crawlable by ordinary search engines, but excludes:

- `/media/`
- `/reader.html`
- `/admin.html`
- `/admin-api/`
- `/book-access`
- `/human-access`

Known AI training/bulk-content crawlers are additionally asked not to crawl the public archive at all. This includes GPTBot, ClaudeBot, anthropic-ai, CCBot, Bytespider, Google-Extended, Meta-ExternalAgent, Applebot-Extended, and cohere-ai.

`robots.txt` remains a voluntary preference signal. It is not treated as an authorization boundary.

### 2. Protected-endpoint automation screening

`functions/_lib/crawler-policy.js` rejects known AI crawler User-Agents and obvious script/headless clients before they reach either:

- `/book-access`
- `/human-access`

The denylist includes common command-line/script clients such as curl, wget, python-requests/httpx, aiohttp, Scrapy, Go's default HTTP client, libwww-perl, OkHttp, PostmanRuntime, PowerShell, node-fetch, undici, axios, HeadlessChrome, and PhantomJS.

Requests with no User-Agent are also denied at these protected acquisition endpoints.

This is intentionally a **cheap first filter only**. User-Agent strings are spoofable, so Milestones 2–5 remain authoritative:

- signed media tickets;
- opaque `bk_...` identifiers;
- Turnstile-backed human sessions;
- signed 20-unique-book / 10-minute acquisition throttling.

### 3. Reader indexing policy

`reader.html` is served with `X-Robots-Tag: noindex, nofollow, noarchive`, and the Reader is disallowed in `robots.txt`. Public Library and Series pages are not globally noindexed.

### 4. Keep bot logic out of media delivery

No User-Agent crawler policy is added to `/media/*`.

That preserves:

- HTTP Range behavior;
- Pages and Continuous reading;
- seeking;
- Page Map;
- Visual Page Cache;
- image/audio/text resources inside EPUBs.

Protected EPUB media remains controlled by the signed-ticket layer instead.

## Deferred Cloudflare zone controls

The following are **optional future hardening only** if Shadow Garden ever gains a customer-owned Cloudflare domain. They are not required to complete Milestone 6:

- Bot Fight Mode;
- AI Crawl Control crawler blocks;
- AI Labyrinth;
- Cloudflare-managed AI `robots.txt` controls.

The project owner has explicitly chosen to remain on the free `pages.dev` hostname, so the roadmap must not block on those features.

## Acceptance checklist

- [ ] Normal Chrome/Firefox/Safari/Edge Read and Download flows still reach the existing Garden Pass behavior normally.
- [ ] A request identifying as `GPTBot` is denied at `/book-access` before Turnstile/catalog resolution.
- [ ] A request identifying as `curl` or another obvious script client is denied at `/book-access`.
- [ ] The same automation policy is enforced at `/human-access`.
- [ ] Public Library and Series browsing remains normal.
- [ ] `robots.txt` exposes the sensitive-route exclusions and AI-training crawler policy.
- [ ] `reader.html` returns the noindex/nofollow/noarchive policy.
- [ ] EPUB Range requests and Reader rendering remain unaffected.
- [ ] Milestones 2–5 continue to function unchanged for normal browsers.
