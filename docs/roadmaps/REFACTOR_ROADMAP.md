# Shadow Garden Full Refactor Roadmap

**Status:** 🟨 Active planning  
**Starting baseline:** v1.15.14  
**Security baseline:** Milestones 1–9 complete  
**Hosting constraint:** remain compatible with the free `shadowgarden-bon.pages.dev` deployment and private Backblaze B2.

This roadmap is for a **full structural refactor of the existing application**, not a feature rewrite. The goal is to make Shadow Garden easier to reason about, test, extend, and maintain while preserving the behavior that has already been production-tested.

The intended end state is a clean major-version architecture baseline (provisionally **v2.0**) with substantially fewer patch/override files, explicit module ownership, canonical data/state services, and a stronger automated test boundary.

## Refactor rules

1. **Behavior before beauty.** A refactor PR must preserve user-visible behavior unless a behavior change is explicitly part of that PR.
2. **Security invariants are contracts.** Signed media tickets, opaque IDs, Turnstile sessions, admin sessions, throttles, Range behavior, and private B2 boundaries must not be weakened during cleanup.
3. **Reader stability is the highest-risk area.** Page mode, Continuous mode, Page Map, Visual Page Cache, Range renewal, progress, bookmarks, and completion state must be regression-tested before and after every Reader slice.
4. **One owner per responsibility.** Avoid multiple scripts independently correcting/rendering the same UI or state. The v1.x "base + polish + patch" layering should be replaced by explicit modules.
5. **Small mergeable slices.** Do not perform a repository-wide rename/rewrite in one PR. Each milestone should leave `main` deployable.
6. **Delete dead compatibility code when proven safe.** Do not keep permanent fallback layers solely because they once existed.
7. **No framework rewrite by default.** Keep the current platform unless a milestone demonstrates that a framework/bundler materially simplifies the code without harming Pages Functions, EPUB.js, or deployment. Architecture cleanup comes first.
8. **Browser-local reading data remains browser-local.** Refactoring must not introduce accounts or server-side reading-history tracking.

## Status legend

- ⬜ Planned
- 🟨 In progress
- ✅ Done
- ⏸ Deferred / optional

## Roadmap overview

| Refactor milestone | Status | Primary outcome |
| --- | --- | --- |
| R0. Freeze the v1 baseline | ⬜ Planned | Map runtime contracts, dependencies, persistent keys, APIs, and security invariants before moving code |
| R1. Repository and tooling hygiene | ⬜ Planned | Clean directory structure, deterministic tooling, documentation organization, and ownership conventions |
| R2. Shared domain and state layer | ⬜ Planned | Canonical catalog, book identity, reading-state, URL, storage, and formatting services |
| R3. Library + Series decomposition | ⬜ Planned | Replace overlapping Library/Series patch scripts with explicit controllers/renderers/components |
| R4. Reader architecture refactor | ⬜ Planned | One Reader orchestrator with clean Page/Continuous adapters and canonical progress/completion state |
| R5. Garden Keeper decomposition | ⬜ Planned | Thin app shell, shared admin API client, isolated workflows, reusable dialog/form primitives |
| R6. Pages Functions service layer | ⬜ Planned | Thin route handlers over shared auth, catalog, B2, validation, media, and abuse services |
| R7. CSS and design-system consolidation | ⬜ Planned | Tokens + component/layout layers; remove stacked versioned polish/override stylesheets |
| R8. Test architecture and fixtures | ⬜ Planned | Unit/integration/browser coverage around the contracts most likely to regress |
| R9. Build and deployment cleanup | ⬜ Planned | Deterministic builds, clearer generated/source boundaries, dependency audit, optional bundling decision |
| R10. Final cutover and legacy removal | ⬜ Planned | Remove obsolete compatibility paths, complete docs, run full production regression, establish v2 baseline |

---

## R0 — Freeze the v1 baseline

**Goal:** document what the current application does before changing how it is organized.

### Work

- Inventory every JavaScript and CSS entry point loaded by Main Library, Adult Library, Series, Reader, and Garden Keeper.
- Produce a dependency/ownership map showing which module owns each behavior.
- Record all persistent browser keys, including progress, bookmarks, Finished state, pinned state, filters, Reader settings, and Adult acknowledgement.
- Record every public/private HTTP route and its authorization requirements.
- Record B2 object namespaces and which code is allowed to read/write/delete them.
- Record the canonical book/cover identity formats (`bk_...`, `cv_...`) and migration assumptions.
- Turn the completed Milestone 9 security assertions into permanent refactor guardrails rather than milestone-only checks.
- Identify duplicate/competing modules and "polish" layers that currently mutate another module's output.

### Acceptance

- [ ] Architecture map exists under `docs/architecture/`.
- [ ] Persistent state/API/storage contracts are documented.
- [ ] High-risk behaviors have automated baseline tests.
- [ ] No production behavior has changed.

---

## R1 — Repository and tooling hygiene

**Goal:** make the repository structure communicate ownership before deeper code movement.

### Proposed documentation structure

```text
docs/
├─ README.md
├─ architecture/
├─ roadmaps/
│  ├─ REFACTOR_ROADMAP.md
│  └─ SECURITY_ROADMAP.md
├─ security/
│  └─ milestone records
└─ style/
   └─ SITE_VOICE.md
```

### Code/tooling work

- Establish naming rules for source modules: no new `*-polish.js`, `*-fix.js`, or version-specific patch files unless explicitly temporary.
- Separate generated build artifacts from authored source clearly.
- Add/maintain a dependency lockfile once dependency strategy is finalized.
- Introduce formatting/lint rules only after they can be applied without obscuring functional diffs.
- Remove abandoned scripts/configuration and document what remains intentionally at repository root.
- Standardize version/cache-busting strategy so source files do not need manual version query changes scattered across HTML.

### Acceptance

- [ ] Root directory contains only normal project entry/configuration files.
- [ ] Documentation has a single index.
- [ ] New code naming/ownership rules are documented.
- [ ] `npm run check` remains green.

---

## R2 — Shared domain and state layer

**Goal:** stop Library, Series, Reader, and Garden Keeper from independently re-implementing the same concepts.

### Introduce canonical modules

- `catalog` domain helpers: series/volume lookup, normalization, status, tags, shelf scope.
- `book-identity` helpers: public IDs, safe aliases, Reader identity mapping.
- `reading-state` service: **Unread / In Progress / Finished** as the only volume state machine.
- `progress` storage service: canonical read/write/clear and alias migration.
- `bookmarks` storage service.
- `library-preferences` service: pinned/filter/view state.
- shared URL builders for Series/Reader/download navigation.
- shared escaping/formatting utilities instead of repeated local `esc`, `arr`, size/date helpers.

### Critical contract

The three-state model introduced in v1.15.14 becomes a domain API, not UI-specific logic:

```text
Unread      -> Read
In Progress -> Continue
Finished    -> Read Again (confirmed reset)
```

### Acceptance

- [ ] Series and Library consume the same state API.
- [ ] Reader writes progress through the same canonical service/contract.
- [ ] No UI module scans unrelated localStorage keys directly.
- [ ] State transitions have dedicated tests.

---

## R3 — Library and Series decomposition

**Goal:** replace accumulated rendering patches with clear feature modules.

### Library target modules

- library controller/bootstrap
- catalog query/filter/sort model
- grid renderer
- compact renderer
- Recently Added renderer
- reading banner renderer
- filter UI/controller
- footer/version component

### Series target modules

- series controller
- hero renderer
- volume-card renderer
- volume action controller
- Read Again dialog/controller
- pin/tag navigation controller

### Cleanup targets

- Fold `library-series-polish.js`, `library-finished-polish.js`, and similar post-render mutation layers into the owning renderer/controller.
- Stop using MutationObserver where direct render ownership can solve the same problem.
- Make cover taps derive from the same action object as the visible button rather than mirroring after render.

### Acceptance

- [ ] Each Library/Series behavior has one owner.
- [ ] Grid/Compact share data/state but not brittle DOM post-processing.
- [ ] Read / Continue / Read Again behavior is identical for cover and button actions.
- [ ] Main and Adult scopes use the same implementation with explicit theme/scope inputs.

---

## R4 — Reader architecture refactor

**Goal:** simplify the highest-risk subsystem without changing EPUB behavior.

### Target ownership

- `reader/app` — orchestration only.
- `reader/book-session` — canonical authorized book identity and ticket renewal handoff.
- `reader/rendition` — EPUB.js lifecycle adapter.
- `reader/paginated` — page-only navigation behavior.
- `reader/continuous` — continuous manager/rail/seek behavior.
- `reader/page-map` — canonical device page map.
- `reader/progress` — state persistence and progress events.
- `reader/completion` — Finished toggle, end page, next-volume completion.
- `reader/bookmarks` — bookmark model/controller.
- `reader/settings` / `reader/theme` — preferences and presentation.
- `reader/visual-cache` — visual-page optimization boundary.

### Remove architectural debt

- Eliminate private/public progress mirroring timers once Reader storage writes canonical state directly.
- Remove temporary URLSearchParams interception if the authorization/session abstraction can provide the EPUB source without masquerading as the public URL.
- Reduce global `window.__sg...` handoffs to a narrow documented bootstrap contract.
- Keep exactly one owner for Continuous rendering.

### Non-negotiable regression matrix

- Pages and Continuous open/restore correctly.
- Cover/page-1 state remains Unread.
- Page 2+ becomes In Progress.
- Finished always overrides progress.
- Read Again clears progress + Finished, preserves bookmarks, and reopens page 1.
- Range renewal never loses reading position.
- Page Map, Visual Page Cache, image-only pages, swipe/wheel/seek, TOC, fullscreen, and themes remain functional.

---

## R5 — Garden Keeper decomposition

**Goal:** turn the admin console into isolated workflows rather than a large bootstrap plus enhancement layers.

### Target modules

- Keeper app shell/router
- authentication/session client
- shared admin API client
- library manager
- series editor
- upload/new-books workflow
- maintenance/Garden Health
- Catalog History
- Trash
- Abuse Watch
- version/footer component
- shared dialog/confirmation/toast/form primitives

### Cleanup targets

- Remove post-load script injection chains where normal ES modules can express dependencies.
- Centralize API errors, auth-expiry handling, retry/cooldown display, and destructive confirmations.
- Keep SITE_VOICE copy close to reusable UI primitives rather than patching already-rendered strings globally where practical.

### Acceptance

- [ ] Every admin workflow can initialize independently through the app shell.
- [ ] One admin API client owns bearer/session/error behavior.
- [ ] Lock/unlock cannot be bypassed through UI state.
- [ ] Upload/edit/backup/trash/abuse workflows pass regression tests.

---

## R6 — Cloudflare Pages Functions service layer

**Goal:** make route files thin and move reusable backend logic into explicit services.

### Target layers

```text
functions/
├─ routes / endpoint handlers
└─ _lib/
   ├─ auth/
   ├─ media/
   ├─ catalog/
   ├─ storage/
   ├─ abuse/
   ├─ validation/
   └─ http/
```

### Work

- Shared request parsing and JSON/error response helpers.
- Central validation for managed B2 keys and public IDs.
- Separate B2 transport from catalog/business operations.
- Thin admin endpoints that call tested services.
- Consolidate Turnstile, signed-session, signed-ticket, throttling, and opaque-client logic into clearly named boundaries.
- Preserve the deliberate distinction between **authorization** and **telemetry** failure behavior.

### Security acceptance

- `/media/*` retains Range semantics and signed authorization.
- M8 cooldown enforcement remains outside `/media/*`.
- Admin APIs still require token + signed admin session.
- Raw IP addresses remain unpersisted.
- Direct B2 URLs/credentials remain private.

---

## R7 — CSS and design-system consolidation

**Goal:** replace layered versioned overrides with predictable styles.

### Structure

- design tokens: color, spacing, typography, radius, elevation, breakpoints.
- primitives: buttons, badges, pills, cards, dialogs, inputs, drawers.
- layouts: header, footer, Library grid/compact, Series hero, Reader chrome, Keeper shell.
- feature styles only where a reusable primitive is insufficient.

### Cleanup targets

- Merge `site-current.css`, `site-v1.*.css`, one-off alignment fixes, and equivalent admin/reader override layers into owned modules.
- Remove `!important` where it only exists to beat earlier patch layers.
- Preserve Main/Adult/Reader theme differences through tokens/variants rather than duplicated blocks.

### Acceptance

- [ ] No visual regression at supported mobile/tablet/desktop widths.
- [ ] Compact cards and Reader end-page actions remain stable with long content.
- [ ] Accessibility media queries remain intact.
- [ ] Temporary version-named CSS files are removed.

---

## R8 — Test architecture and fixtures

**Goal:** make future refactors cheaper by detecting regressions before production.

### Test tiers

1. **Unit tests** — state machines, ID normalization, signing helpers, filters, formatters.
2. **Service/integration tests** — Pages Function auth and B2 adapters with in-memory/fake storage.
3. **DOM tests** — Library/Series/Reader action state and dialog behavior.
4. **Browser smoke tests** — critical end-to-end flows against a local/preview build.

### Required fixtures

- single-volume and multi-volume series
- Main and Adult series
- long titles and unusual metadata
- EPUB with standalone cover/map/illustration pages
- EPUB with enough pages to exercise Page Map and Continuous mode
- progress states: none/page 1/page 2+/Finished
- expired/tampered ticket scenarios

### Priority browser flows

- Read → Continue → Finished → Read Again.
- Finished series badge/filter behavior.
- Page/Continuous position parity.
- Garden Pass and Keeper Gate flows.
- Garden Keeper upload/edit/backup/trash basics.

---

## R9 — Build and deployment cleanup

**Goal:** make builds deterministic and source/deployed output easy to understand.

### Work

- Audit all dependencies and remove unused packages.
- Introduce a committed lockfile when dependency choices settle.
- Generate deployment version/cache metadata centrally.
- Stop scattering manual `?v=x.y.z` query parameters where possible.
- Keep `dist/` purely generated.
- Evaluate bundling/minification only after module boundaries are clean.

### Bundler decision gate

A bundler/framework is adopted only if it provides a measurable benefit such as:

- fewer manual script-order dependencies;
- reliable asset hashing/cache invalidation;
- smaller/deferred bundles;
- simpler tests/development server;

without complicating Cloudflare Pages Functions or EPUB.js runtime behavior. Otherwise native ES modules remain the preferred architecture.

---

## R10 — Final cutover and v2 baseline

**Goal:** remove the scaffolding that was needed only during migration.

### Work

- Delete obsolete `*-polish`, compatibility, migration, and version-specific patch files.
- Remove old localStorage alias migrations once the supported transition window has passed.
- Remove deprecated API/helper exports.
- Regenerate architecture diagrams and source-layout documentation.
- Run the complete security + Reader + Library + Garden Keeper production matrix.
- Update `README.md`, `CHANGELOG.md`, and docs index to the final architecture.

### Completion criteria

- [ ] Every behavior has a documented owner/module.
- [ ] No known duplicate runtime owner modifies the same state/UI independently.
- [ ] Full CI and browser regression suite passes.
- [ ] Production smoke test passes on `pages.dev`.
- [ ] Completed Security Milestones 1–9 remain intact.
- [ ] Repository contains no known obsolete compatibility/patch layer.
- [ ] The refactored architecture becomes the new major-version baseline.

---

## Recommended execution order

Start with **R0 → R2** before touching the large UI subsystems. Then refactor **Library/Series (R3)** before **Reader (R4)** so the canonical reading-state contract has stable consumers. Follow with **Garden Keeper (R5)** and **Functions (R6)**. Consolidate CSS after component ownership is clearer, then strengthen browser tests and build tooling before the final cleanup.

Avoid mixing a major Reader rewrite, backend service rewrite, and CSS redesign in the same PR. The purpose of this roadmap is to make a full refactor **incremental, reversible, and continuously deployable**.