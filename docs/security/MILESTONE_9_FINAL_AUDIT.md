# Milestone 9 — Final security audit

**Status:** ✅ Complete — accepted 2026-08-24  
**Accepted baseline:** Shadow Garden v1.15.14 on `shadowgarden-bon.pages.dev`

Milestone 9 was the final end-to-end verification of Shadow Garden's accumulated security architecture, Reader compatibility, Library behavior, Garden Keeper workflows, cache behavior, and public/private storage boundaries.

The project owner accepted the production baseline after the iterative M9 regression/fix cycle through v1.15.14. Milestone 6's remaining production acceptance items were closed as part of the same final pass.

## Permanent repository baseline

`tools/check-m9.mjs` remains part of `npm run check` and protects these architectural invariants:

- `/media/*` retains signed-ticket authorization and Range support.
- M8 cooldown enforcement stays outside `/media/*`.
- `/book-access` and `/human-access` retain server-side abuse cooldown checks.
- Garden Keeper retains server-side cooldowns plus bearer-token + signed-session authorization.
- Pages Functions routing covers every protected endpoint.
- Reader/Admin/version surfaces retain no-store/noindex behavior where appropriate.
- Public HTML does not expose direct private B2 delivery URLs.
- Reader startup retains opaque `bk_...` authorization handoff.
- Browser-local reading state stays local-only.
- New cover object names use opaque random `cv_...` identifiers.

## Findings fixed during the audit

M9 deliberately exposed several cross-module problems that were corrected before acceptance:

- **Finished-state identity mismatch (v1.15.1–v1.15.3):** Reader, Series, and Library could use different aliases for the same volume. Completion persistence was hardened around catalog-aware aliases and stable series/volume identity.
- **Continuous end-page cloned controls (v1.15.4):** Continuous mode clones the end page, so direct listeners on the original Finished switch did not persist. Completion handling was changed to delegated event ownership.
- **Library Finished/Continue conflicts (v1.15.5–v1.15.7):** competing scripts and raw progress selection could resurface completed books or duplicate badges. One completion-aware Library banner renderer became authoritative.
- **Compact Library layout regressions (v1.15.8–v1.15.11):** thumbnail/detail columns and badge rails were normalized across mobile compact cards.
- **Read Again semantics (v1.15.12–v1.15.14):** Finished volumes now have a confirmed reset path that clears Finished + progress, preserves bookmarks, and returns to page 1. Cover clicks and action buttons follow the same state.
- **Canonical three-state volume model (v1.15.14):** every volume is now explicitly Unread, In Progress, or Finished and UI actions derive from that state.
- **Garden Keeper version placement:** deployed version metadata moved to the centered admin footer.
- **Opaque covers (v1.15.10):** new cover uploads use random `cv_...` identifiers rather than descriptive filenames.
- **Cache freshness:** security, Reader, reading-state, and UI correction clients that need immediate deployment freshness are served `no-store`.

## Accepted production matrix

### Library and Series

- [x] Main Library loads normally in Grid and Compact views.
- [x] Adult Library gate and catalog load normally.
- [x] Search, author/year/volume/tag filters, pinned filter, Finished/Unfinished filters, sorting, and incremental loading work together.
- [x] Finished series badges appear only when every current volume is marked finished.
- [x] Series pages show green checks only on Finished volumes.
- [x] Finished volumes do not remain in the Continue/Read banner.
- [x] Page-1/cover state uses `Read`; progressed state uses `Continue`; Finished uses `Read Again`.
- [x] Cover taps use the same action as the visible volume button.
- [x] Compact view avoids duplicate Finished badges and keeps details/badge rails within the card.
- [x] Series banners, status tags, clickable tags, cover links, and mobile layouts remain functional.

### Reader

- [x] Page mode opens, turns pages, restores progress, and reaches the end page normally.
- [x] Continuous mode opens, scrolls, seeks, restores progress, and reaches the end page normally.
- [x] Page Map and Visual Page Cache continue to operate.
- [x] Bookmark creation/removal/navigation remains functional.
- [x] Long next-volume titles wrap correctly on the mobile end page.
- [x] `Mark as Finished` persists in Page and Continuous end pages.
- [x] Selecting `Read next volume` marks the current volume Finished before navigation.
- [x] Finished state is reflected on Series and Library pages.
- [x] Read Again prompts for confirmation, clears progress + Finished, preserves bookmarks, and reopens page 1.
- [x] Reader/Series/Library share the canonical Unread / In Progress / Finished state model.
- [x] Themes, typography, fullscreen, swipe/wheel controls, and mobile chrome remain functional.

### Signed media and anti-abuse

- [x] Fresh book acquisition reaches Turnstile/Garden Pass when required and opens the EPUB.
- [x] Same-book reauthorization does not consume another M5 unique-book slot.
- [x] Bare/expired/tampered media requests are rejected.
- [x] Cross-site EPUB requests are rejected.
- [x] Normal EPUB Range/seek requests remain unaffected by M8 cooldown enforcement.
- [x] Known automation/script clients are denied at protected acquisition endpoints.
- [x] M8 suspicious-signal thresholds can create a temporary cooldown.
- [x] M8 cooldown survives same-network Incognito/cleared cookies.
- [x] Abuse Watch avoids raw IP storage/display.
- [x] Manual Abuse Watch release clears an active restriction while retaining history.

### Garden Keeper

- [x] Current deployed version and short commit are visible in the centered footer.
- [x] Correct token + Turnstile unlocks Garden Keeper.
- [x] Wrong-token cooldown survives same-network Incognito/cleared cookies.
- [x] Locking requires a fresh unlock before admin APIs can be used again.
- [x] Direct admin API requests without the signed admin session are rejected.
- [x] Upload/New Books workflow remains functional.
- [x] Metadata, series status, series banner, and volume edits remain functional.
- [x] Catalog History create/restore/delete remains functional.
- [x] Garden Health/deep B2 checks remain functional.
- [x] Cover optimization remains functional.
- [x] Trash restore/permanent purge remains functional.
- [x] Abuse Watch loads and release controls work.

### Deployment and cache behavior

- [x] Cloudflare Pages deploys successfully from `main`.
- [x] `/data/version.json` reports deployed package/version metadata.
- [x] Admin/Reader/security clients that require freshness are served `no-store`.
- [x] Catalog and cover caching remain compatible with normal browsing.
- [x] Public HTML/catalog delivery does not expose direct private B2 EPUB URLs.
- [x] New cover filenames are opaque and do not encode title/volume information.

## Completion

Milestones **1–9 are now complete** as one coherent security baseline. The completed roadmap is archived at [`../roadmaps/SECURITY_ROADMAP.md`](../roadmaps/SECURITY_ROADMAP.md).

Future refactoring must preserve these guarantees. The active project plan is the [`REFACTOR_ROADMAP.md`](../roadmaps/REFACTOR_ROADMAP.md).