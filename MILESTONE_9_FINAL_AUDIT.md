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

## Findings fixed during the audit

- **v1.15.1/v1.15.2 finished-reading identity gap:** treating only the Reader URL or signed ticket identity as authoritative was still not enough to guarantee that the completion key exactly matched the `volume.file` identity rendered by Series/Library. v1.15.3 resolves the current volume from the same public catalog used by the Series page, writes every equivalent identity in one verified operation, adds a stable `series + volume` alias, and keeps a redundant per-alias local marker so a finished state survives navigation/reload even if one representation changes.
- **v1.15.3 Continuous end-page event gap:** Continuous mode does not display the master `#volumeEndPage`; it clones that DOM with `cloneNode(true)`. DOM cloning copies the checkbox markup and checked behavior but never copies JavaScript event listeners. The result was a switch that visibly toggled in Continuous mode while no persistence callback ran. v1.15.4 delegates the completion change handler at document level, installs/synchronizes controls in every Continuous clone, and observes newly created end-page clones. Pages and Continuous now share one persistence path.
- **v1.15.4 Library completion presentation gap:** the Library Continue Reading card could still remain visible for a volume already marked finished, while Compact view rendered both the cover-overlay Finished badge and the compact badge rail. v1.15.5 adds a catalog-aware Library finished-state observer that suppresses a Continue card targeting a finished volume and hides only the redundant cover-overlay Finished badge in Compact view; Grid view keeps its cover badge and Compact keeps the badge rail.
- **Garden Keeper version placement:** version information is no longer mounted in the header. v1.15.3 creates a dedicated centered Garden Keeper footer showing the deployed version and short commit, leaving the header layout untouched.
- Library/Series completion clients remain explicitly cache-busted/no-store so a prior cached client cannot mask reading-status fixes during the final audit.

## Production audit matrix

### Library and Series

- [ ] Main Library loads normally in Grid and Compact views.
- [ ] Adult Library gate and catalog load normally.
- [ ] Search, author/year/volume/tag filters, pinned filter, Finished/Unfinished filters, sorting, and incremental loading work together.
- [ ] Finished series badges appear only when every current volume is marked finished.
- [ ] Series pages show green checks only on volumes marked finished.
- [ ] Continue Reading does not surface a volume marked finished.
- [ ] Compact view shows only the badge-rail Finished badge, not a second Finished overlay on the thumbnail cover.
- [ ] Series banners, status tags, clickable tags, cover links, and mobile layouts remain intact.

### Reader

- [ ] Page mode opens, turns pages, restores progress, and reaches the end page normally.
- [ ] Continuous mode opens, scrolls, seeks, restores progress, and reaches the end page normally.
- [ ] Page Map and Visual Page Cache continue to operate.
- [ ] Bookmark creation/removal/navigation works.
- [ ] End-page long next-volume titles wrap correctly on mobile.
- [ ] `Mark as Finished` persists locally and can be toggled back to unfinished in Page mode.
- [ ] `Mark as Finished` persists locally and can be toggled back to unfinished in the cloned Continuous end page.
- [ ] Finished state is reflected after returning to Series/Library pages.
- [ ] Reader completion resolves and stores the exact public catalog volume identity used by the Series page.
- [ ] Legacy/private-path Reader URLs migrate finished state to the canonical/stable volume aliases.
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

- [ ] Current deployed version and short commit are visible in the centered Garden Keeper footer.
- [ ] Garden Keeper header remains unchanged with the Library link at the far right.
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
