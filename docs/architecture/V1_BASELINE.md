# Shadow Garden v1 Architecture Baseline

**Refactor milestone:** R0 — Freeze the v1 baseline  
**Frozen application version:** v1.15.14  
**Baseline main commit:** `ff545731676876d962e64660ea729a2a6694fc53`  
**Production platform:** Cloudflare Pages (`shadowgarden-bon.pages.dev`) + private Backblaze B2

This document freezes the behavior and ownership of the v1 application before structural refactoring begins. It is descriptive, not aspirational: modules listed here may be consolidated later, but the contracts they currently implement must remain intact until a refactor slice explicitly replaces them and its regression checks pass.

## Runtime surfaces

Shadow Garden currently has five browser application surfaces.

### Main Library — `src/index.html`

Primary owners:

- `data-source.js` — public catalog source selection/loading.
- `library.js` — catalog state, search/filter/sort/view model, incremental rendering, adult acknowledgement support, Recently Added, and the original Continue panel.
- `reading-status.js` — dynamically loaded canonical Unread / In Progress / Finished state machine.
- `nav.js` — site navigation shell.
- `nav-pinned.js` — pinned-series navigation and card indicators.
- `library-mobile-filter.js` — mobile filter collapse state and selected-tag placement.
- `library-series-polish.js` — post-render Library/Series presentation mutations; debt target for R3.
- `library-finished-polish.js` — authoritative completion-aware Library banner behavior added late in v1; debt target for R3.
- `library-footer-version.js` — deployed version footer metadata.
- `site-a11y.js`, `ui-direction-triangles.js` — cross-page accessibility/UI affordances.

Main styles are layered through `site.css`, `nav.css`, `library-scale.css`, `site-current.css`, `site-v1.9.4.css`, `library-compact-alignment.css`, and `ui-symbols.css`. The versioned/override layers are intentional R7 cleanup targets.

### Adult Library — `src/nsfw.html`

Uses the same Library implementation with `data-library-scope="nsfw"`, plus `adult.css` and the browser-local `sg-adult-ack` acknowledgement. Main and Adult Library behavior must continue to share the same data/state implementation; shelf differences are scope/theme inputs rather than separate business logic.

### Series — `src/series.html`

Primary owners:

- `series.js` — series lookup, hero, volume cards, primary series action, status presentation.
- `reading-status.js` — dynamically imported shared volume state.
- `series-read-again.js` — Read Again confirmation/reset flow and action interception.
- `series-cover-links.js` — mirrors volume action state onto cover links; debt target for R3 because cover/button actions should eventually be produced from one render model.
- `library-series-polish.js` — shared post-render mutation layer; debt target for R3.
- `book-access.js` — protected book acquisition client used by Read/Download flows.
- shared navigation/accessibility modules.

The canonical visible action contract is:

```text
Unread      -> Read
In Progress -> Continue
Finished    -> Read Again (confirmation required)
```

Cover taps and visible buttons must remain behaviorally identical for each state.

### Reader — `src/reader.html`

The Reader is the highest-risk subsystem and is intentionally frozen before R4.

Direct bootstrap/adapter layers:

- `book-access.js` — signed book authorization, Turnstile Garden Pass, ticket renewal, legacy state migration.
- `reader-bootstrap.js` — authorization-to-Reader handoff, canonical/public identity mirroring, restart/read-again handoff, module startup order.
- `reader.js` — primary Reader application; imports `reader/storage.js`, `reader/theme.js`, `reader/toc.js`, and `reader/page-map.js`.
- `reader-epub-adapter.js` — EPUB.js compatibility/integration layer.
- `reader-continuous-core.js` — sole Continuous rendering manager.
- `reader-continuous-rail.js` — Continuous seek/progress rail.
- `reader-visual-cache.js` — IndexedDB standalone visual-page cache.
- `reader-paginated-visual-fit.js` — paginated cover/illustration fitting.
- `reader-gesture-hook.js`, `reader-wheel-pages.js` — input bridges.
- `reader-polish.js`, `reader-v1.10.1.js` — accumulated v1 presentation/behavior patches; debt targets for R4/R7.
- `reading-status.js` + `reader-finished.js` — completion state and end-page controls loaded by `reader-bootstrap.js`.
- `reader-a11y.js`, `ui-direction-triangles.js` — accessibility/UI affordances.

Reader invariants that must survive every refactor slice:

- Page and Continuous modes both open and restore EPUB position.
- `reader-continuous-core.js` remains the only Continuous manager until R4 deliberately replaces it.
- Page Map remains the canonical device page model shared by reading modes.
- Visual Page Cache remains optional/fail-soft and does not change the logical reading state.
- page 1/cover is Unread; page 2+ is In Progress; Finished overrides progress.
- Read Again clears progress and Finished state, preserves bookmarks, and opens page 1.
- Read Next Volume persists the current volume as Finished before navigation.
- ticket renewal and HTTP Range recovery do not lose reading position.
- browser-local progress/bookmarks/settings remain local; no reader account/server history is introduced.

### Garden Keeper — `src/admin.html`

The current Keeper is a layered shell rather than a clean module graph. Direct scripts include `admin.js`, audio/preflight/batch/maintenance modules and later enhancement layers. `admin-bootstrap.js` then injects security, series-status, upload workflow/completion/polish, history, banner, Abuse Watch, site voice, version styling, and shared UI scripts.

Current ownership areas:

- `admin.js` — original Keeper app state/API/upload primitives and core UI.
- `admin-security.js` — Keeper Gate/Turnstile session establishment and cooldown UI.
- `admin-preflight.js` — local EPUB inspection.
- `admin-batch*.js` — batch upload/edit/safety flows.
- `admin-maintenance.js` — Garden Health, catalog history, trash, cover maintenance.
- `admin-series-status.js`, `admin-series-banner.js`, `admin-series-editor-polish.js` — series editing enhancements.
- `admin-upload-workflow.js`, `admin-upload-completion.js`, `admin-upload-polish.js` — upload workflow layering.
- `admin-backup-history.js` — backup history enhancement.
- `admin-abuse.js` — Abuse Watch.
- `admin-bootstrap.js` — late-stage composition, opaque cover-key interception, dynamically loaded feature layers, deployment footer.
- `admin-overhaul.js`, `site-flavor.js` — post-render behavior/copy layers.

This layering is a principal R5 target. Until R5, authentication remains server-authoritative regardless of UI state.

## Shared browser-domain contracts

### Catalog identity

Public catalog volume identity is an opaque `bk_` identifier matching:

```text
^bk_[A-Za-z0-9_-]{22}$
```

It is derived from SHA-256 of the normalized private EPUB media path under the domain string `shadow-garden-book-id-v1`, using the first 16 digest bytes encoded Base64URL. A `bk_...` value is a public opaque identifier, not a secret and not an authorization credential.

Legacy private Reader/media paths may still appear in local migration aliases during the v1 transition. New public catalog responses remove private `file`, SHA-256 and original filename fields.

### Cover identity

New cover objects use opaque names:

```text
shadow-garden/covers/cv_<opaque-id>-detail.<ext>
shadow-garden/covers/cv_<opaque-id>-thumb.<ext>
```

The current browser generator uses 16 cryptographically random bytes encoded Base64URL. `/admin-api/upload` enforces the opaque `cv_` cover pattern server-side. Existing pre-v1.15.10 descriptive test-cover names may remain until those test books are removed; no migration is required.

### Reading state

`reading-status.js` is the v1 canonical state layer. It defines exactly three user-facing states:

- **Unread:** no meaningful progress, page 1, cover page, or <=1% fallback when page data is unavailable.
- **In Progress:** not Finished and meaningful progress past page 1.
- **Finished:** explicit Finished marker; Finished wins over progress.

The service recognizes public book IDs, legacy media aliases, and stable `series:<series-id>:volume:<number>` / title/index fallbacks. Later refactors may reduce aliases, but may not change the three-state semantics without an explicit behavior change.

## Current dependency direction

```text
HTML surface
  -> page bootstrap/controller
      -> shared browser services / late patch layers
          -> localStorage / IndexedDB / public catalog

Reader HTML
  -> book-access + EPUB adapters
  -> reader-bootstrap
      -> reader.js
          -> storage / theme / TOC / Page Map
      -> reading-status + reader-finished

Pages Functions route
  -> auth/validation/telemetry helpers
  -> B2 read/write transport
  -> private B2 objects
```

The refactor goal is to make these directions explicit and remove sideways/post-render ownership, not to change the user-facing contract.

## Known duplicate/competing ownership

The following are recorded debt, not permission to remove them without tests:

- `library.js` plus `library-finished-polish.js` both participate in Continue/reading-banner behavior.
- `library.js` plus `library-series-polish.js` both affect Library card presentation.
- `series.js` plus `series-cover-links.js` plus `series-read-again.js` collectively determine a volume action.
- `reader.js` plus `reader-polish.js`, `reader-v1.10.1.js`, `reader-bootstrap.js`, and `reader-finished.js` layer behavior around one Reader session.
- `admin.js` plus `admin-bootstrap.js`, `admin-overhaul.js`, `admin-series-editor-polish.js`, and upload polish/workflow scripts mutate/enhance the same Keeper shell.
- `site.css` / `site-current.css` / `site-v1.9.4.css` and analogous Reader/Admin style layers override each other rather than expressing one design-system owner.
- MutationObservers are used in several enhancement layers to repair or mirror DOM owned elsewhere. R3/R5 should replace these with direct render ownership where possible.

## R0 change rule

R0 itself must not change production behavior. Its code changes are limited to documentation and automated contract checks. Any behavioral change discovered while documenting the baseline belongs in a separate refactor/bug-fix slice with its own acceptance evidence.
