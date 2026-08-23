# Milestone 9 — Final security audit

Milestone 9 is the final end-to-end verification of Shadow Garden's security and reader compatibility on the existing free `shadowgarden-bon.pages.dev` deployment. No custom domain is required.

## Repository baseline

`tools/check-m9.mjs` is now part of `npm run check` and asserts the architectural invariants that must not regress while the production audit is performed:

- `/media/*` keeps signed-ticket authorization and Range support.
- Milestone 8 cooldown enforcement stays outside `/media/*`.
- `/book-access` and `/human-access` retain server-side abuse cooldown checks.
- Garden Keeper retains server-side cooldowns plus bearer-token + signed-session authorization.
- Pages Functions routing covers every protected endpoint.
- Reader/Admin/version surfaces retain no-store/noindex behavior where appropriate.
- public HTML does not expose direct private B2 delivery URLs.
- Reader startup retains opaque `bk_...` authorization handoff.
- browser-local finished-reading state does not introduce a new server/API tracking surface.

## Production audit matrix

### Library and Series

- [ ] Main Library loads normally in Grid and Compact views.
- [ ] Adult Library gate and catalog load normally.
- [ ] Search, author/year/volume/tag filters, pinned filter, Finished/Unfinished filters, sorting, and incremental loading work together.
- [ ] Finished series badges appear only when every current volume is marked finished.
- [ ] Series pages show green checks only on volumes marked finished.
- [ ] Continue Reading does not surface a volume marked finished when another resumable unfinished item exists.
- [ ] Series banners, status tags, clickable tags, cover links, and mobile layouts remain intact.

### Reader

- [ ] Page mode opens, turns pages, restores progress, and reaches the end page normally.
- [ ] Continuous mode opens, scrolls, seeks, restores progress, and reaches the end page normally.
- [ ] Page Map and Visual Page Cache continue to operate.
- [ ] Bookmark creation/removal/navigation works.
- [ ] End-page long next-volume titles wrap correctly on mobile.
- [ ] `Mark as Finished` persists locally and can be toggled back to unfinished.
- [ ] Finished state is reflected after returning to Series/Library pages.
- [ ] Theme, typography, fullscreen, swipe controls, and mobile chrome remain functional.

### Signed media and anti-abuse

- [ ] Fresh book acquisition completes Turnstile when required and opens the EPUB.
- [ ] Reauthorizing the same book does not consume another M5 unique-book slot.
- [ ] Bare/expired/tampered media requests are rejected.
- [ ] Cross-site EPUB requests are rejected.
- [ ] Normal EPUB Range/seek requests remain unaffected by M8 cooldown enforcement.
- [ ] Known automation/script clients are denied at protected acquisition endpoints.
- [ ] M8 suspicious-signal tripwire produces a temporary cooldown at the configured threshold.
- [ ] M8 cooldown survives Incognito/cleared cookies on the same public network.
- [ ] Abuse Watch shows significant events without exposing raw IP addresses.
- [ ] Manual Abuse Watch release clears an active public cooldown while retaining history.

### Garden Keeper

- [ ] Current deployed version and short commit are visible in the Garden Keeper header.
- [ ] Correct token + Turnstile unlocks Garden Keeper.
- [ ] Wrong-token cooldown survives Incognito on the same public network.
- [ ] Locking requires a fresh unlock before admin APIs can be used again.
- [ ] Direct admin API requests without the signed admin session are rejected.
- [ ] Upload/new-books workflow works.
- [ ] Metadata, series status, series banner, and volume edits work.
- [ ] Catalog History create/restore/delete works.
- [ ] Garden Health and deep B2 checks work.
- [ ] Cover optimization remains functional.
- [ ] Trash restore and permanent purge work.
- [ ] Abuse Watch loads and release controls work.

### Deployment and cache behavior

- [ ] Cloudflare Pages deploy succeeds from `main`.
- [ ] `/data/version.json` reports the package version and deployed commit.
- [ ] Admin/Reader/security scripts that must refresh are served `no-store`.
- [ ] Catalog and immutable cover caching still behaves as intended.
- [ ] No direct private B2 book URL is exposed through public catalog/HTML responses.

## Milestone completion

Milestone 9 can be marked complete when the repository checks are green and the production matrix above has been accepted. At that point Milestone 6's remaining production acceptance items are closed as part of the same final regression pass, leaving Milestones 1–9 at one coherent security baseline.
