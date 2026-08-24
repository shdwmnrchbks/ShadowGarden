# Shadow Garden Full Refactor Roadmap

**Status:** 🟨 Active — R0–R4 complete; R5 next  
**Starting baseline:** v1.15.14  
**Current refactor release:** v1.18.0  
**Security baseline:** Milestones 1–9 complete  
**Hosting constraint:** remain compatible with `shadowgarden-bon.pages.dev` and private Backblaze B2.

This is an incremental structural refactor toward a clean v2 architecture. `main` must remain deployable after every slice, security contracts must remain intact, and browser-local reading data must stay browser-local.

## Refactor rules

1. **Behavior before beauty.** Refactors preserve user-visible behavior unless a correction is explicitly included and tested.
2. **Security invariants are contracts.** Signed media tickets, opaque IDs, Turnstile sessions, admin sessions, throttles, Range behavior, and private B2 boundaries cannot weaken during cleanup.
3. **Reader stability is highest risk.** Page/Continuous, Page Map, Visual Page Cache, ticket renewal, progress, bookmarks, completion and gestures require regression coverage around every Reader slice.
4. **One owner per responsibility.** Replace v1's base + polish + patch ownership with controllers, models, renderers, and services.
5. **Small mergeable slices.** Do not combine unrelated subsystem rewrites.
6. **Delete dead compatibility code when proven safe.**
7. **No framework rewrite by default.** Native modules remain preferred until a later decision demonstrates a measurable benefit.
8. **No Reader accounts or server-side reading history.**
9. **Refactoring is also an audit.** When duplicated ownership exposes a closely related behavioral flaw, correct it in the owning milestone and add a regression check rather than preserving a known defect.

## Status legend

- ⬜ Planned
- 🟨 In progress
- ✅ Done
- ⏸ Deferred / optional

## Roadmap overview

| Refactor milestone | Status | Primary outcome |
| --- | --- | --- |
| R0. Freeze the v1 baseline | ✅ Done | Map runtime contracts, dependencies, persistent keys, APIs, and security invariants before moving code |
| R1. Repository and tooling hygiene | ✅ Done | Clean repository/document structure, naming rules, deterministic tooling, and build boundaries |
| R2. Shared domain and state layer | ✅ Done | Canonical catalog, identity, reading-state, progress/bookmarks, preferences, URLs, and formatting |
| R3. Library + Series decomposition | ✅ Done | Single-owner Library/Series controllers/renderers plus one canonical volume-action pipeline |
| R4. Reader architecture refactor | ✅ Done | Explicit Reader session/orchestrator/controllers plus unified swipe/wheel/pinch/pan/zoom ownership |
| R5. Garden Keeper decomposition | ⬜ Planned | Thin Keeper shell, shared admin client, isolated workflows, reusable UI primitives |
| R6. Pages Functions service layer | ⬜ Planned | Thin routes over explicit auth, catalog, B2, validation, media, and abuse services |
| R7. CSS and design-system consolidation | ⬜ Planned | Tokens/components/layout layers; remove stacked override stylesheets |
| R8. Test architecture and fixtures | ⬜ Planned | Unit/integration/DOM/browser coverage around high-risk contracts |
| R9. Build and deployment cleanup | ⬜ Planned | Dependency audit, lockfile, deterministic assets, optional bundler decision |
| R10. Final cutover and legacy removal | ⬜ Planned | Remove obsolete compatibility paths, complete production regression, establish v2 baseline |

---

## R0 — Freeze the v1 baseline

**Status:** ✅ Done — accepted 2026-08-24  
**Goal:** document the stable v1.15.14 behavior before changing ownership.

Artifacts: `V1_BASELINE.md`, `PERSISTENCE_CONTRACTS.md`, `HTTP_STORAGE_CONTRACTS.md`, `v1-entrypoints.json`, and `tools/check-r0.mjs`.

### Acceptance

- [x] Architecture/entrypoint map exists.
- [x] Persistent state/API/storage contracts are documented.
- [x] High-risk security/Reader behavior has permanent baseline checks.
- [x] R0 itself changed no production behavior.

---

## R1 — Repository and tooling hygiene

**Status:** ✅ Done — accepted 2026-08-24  
**Goal:** make source placement, naming, generated boundaries, CI, and documentation ownership explicit.

Completed work includes `MODULE_CONVENTIONS.md`, `BUILD_CONTRACT.md`, the legacy-source exception manifest, Node 22 pinning, immutable Actions pins, centralized build-time asset versioning, dead-file enforcement, and production-build verification in CI. Dependency lockfile work remains intentionally deferred to R9 after dependency audit.

### Acceptance

- [x] Root/document layout has an explicit policy.
- [x] New patch-style permanent filenames are rejected.
- [x] Authored/generated boundaries are documented and checked.
- [x] `npm run check` and production build are CI gates.

---

## R2 — Shared domain and state layer

**Status:** ✅ Done — accepted 2026-08-24  
**Release:** v1.16.0  
**Goal:** stop Library, Series, Reader, and shared public UI from independently interpreting the same identities and browser persistence.

Canonical `src/assets/js/domain/` owners:

- `catalog.js`
- `book-identity.js`
- `reading-state.js`
- `progress.js`
- `bookmarks.js`
- `preferences.js`
- `storage.js`
- `urls.js`
- `format.js`
- `index.js`

Critical state contract:

```text
Unread      -> Read
In Progress -> Continue
Finished    -> Read Again
```

Cover/page 1 remains Unread; page 2+ is In Progress while unmarked; Finished overrides progress; Read Again clears Finished + progress aliases, preserves bookmarks, and reopens page 1.

See [`../architecture/DOMAIN_LAYER.md`](../architecture/DOMAIN_LAYER.md) and `tools/check-r2.mjs`.

### Acceptance

- [x] Series and Library consume the same state API.
- [x] Reader writes progress/bookmarks through canonical services.
- [x] Public UI no longer scans unrelated localStorage families itself.
- [x] State transitions have automated tests.

---

## R3 — Library and Series decomposition

**Status:** ✅ Done — accepted 2026-08-24  
**Release:** v1.17.0  
**Goal:** remove public post-render repair layers and make every Library/Series behavior have one owner.

### Final ownership

- `library.js` — Library controller, Main/Adult scope, URL/filter/control orchestration, incremental rendering and refresh lifecycle.
- `library-model.js` — search/filter/sort/Recently Added model.
- `library-renderers.js` — Grid/Compact cards, compact badge rail, Recently Added cards, reading banner/backdrop.
- `series.js` — Series controller, scope/catalog/pin/refresh orchestration.
- `series-renderers.js` — hero/banner, tags, primary CTA, volume cards/covers/status metadata.
- `public/volume-actions.js` — shared Read / Continue / Read Again model and Finished-reset confirmation flow.
- `library-mobile-filter.js` — mobile filter panel placement/collapse (single focused owner retained).
- `nav-pinned.js` — pinned navigation (shared navigation owner retained).
- `library-footer-version.js` — Library deployed-version component.

See [`../architecture/PUBLIC_UI_LAYER.md`](../architecture/PUBLIC_UI_LAYER.md).

### Removed ownership layers

- `library-series-polish.js`
- `library-finished-polish.js`
- `series-read-again.js`
- `series-cover-links.js`
- `series-read-again.css` (replaced by shared `volume-actions.css`)

### Relevant flaws caught during decomposition

- **Recently Added bypassed Finished state.** A Finished volume card used a direct Reader URL, so it skipped the Read Again warning/reset. All Library/Series volume entry points now carry the same canonical action metadata and use one delegated controller.
- **Series covers depended on post-render mirroring.** Cover and button are now rendered from the same action object, eliminating timing/staleness differences.
- **Returned pages could display stale state.** Library and Series now refresh on `pageshow` as well as reading/storage events, covering browser history/bfcache returns from the Reader.
- **Reading-state refresh collapsed incremental Library results.** R3 preserves the number of already-rendered cards when refreshing badges/actions.
- **Read Again could navigate after an incomplete local reset.** The shared controller verifies Finished + progress were cleared and the volume is Unread before opening `restart=1`; otherwise it leaves the current place unchanged and reports the failure.
- **Series banner selection was a later DOM repair.** `bannerBookId` now participates in the initial Series render.

### Acceptance

- [x] Each Library/Series behavior has one renderer/controller owner.
- [x] Grid/Compact share model/state without a post-render compact badge observer.
- [x] Read / Continue / Read Again is identical for Series button, Series cover, Series primary CTA, Recently Added, and reading-banner volume entry points.
- [x] Main and Adult Libraries use the same controller/model/renderers with explicit scope.
- [x] Public R3 controllers do not use MutationObserver to repair owned DOM.
- [x] `tools/check-r3.mjs` guards the ownership and volume-action contracts.

---

## R4 — Reader architecture refactor

**Status:** ✅ Done — accepted 2026-08-24  
**Release:** v1.18.0  
**Goal:** replace overlapping Reader ownership with one explicit application/session architecture while preserving EPUB, security and reading-state behavior.

See [`../architecture/READER_LAYER.md`](../architecture/READER_LAYER.md).

### Final ownership

- `reader-bootstrap.js` — minimal protected startup only.
- `reader/book-session.js` — authorized public/private book session, Adult gate, Read Again reset and final public URL cleanup.
- `reader/app.js` — Reader orchestration only.
- `reader/rendition.js` — EPUB.js rendition creation/destruction, spread configuration and flow-position capture.
- `reader/paginated.js` — Page-mode turns.
- `reader/continuous.js` — application-level Continuous navigation and exact target resolution.
- `reader/page-map.js` — canonical device Page Map.
- `reader/progress-controller.js` — progress persistence/UI/seeking over R2 state.
- `reader/bookmarks-controller.js` — bookmark UI/navigation over R2 bookmark persistence.
- `reader/completion.js` — Finished toggle, end-page context and next-volume completion.
- `reader/settings.js` / `reader/theme.js` — Reader preferences and presentation.
- `reader/gestures.js` — single swipe/wheel/pinch/pan/double-tap/zoom owner.
- `reader-visual-cache.js`, `reader-paginated-visual-fit.js`, `reader-continuous-core.js`, `reader-epub-adapter.js`, and `reader-continuous-rail.js` remain low-level EPUB.js compatibility boundaries rather than application-state owners.

### Zoom added during R4

R4 adds Reader viewport zoom without making zoom part of EPUB layout:

- pinch to zoom;
- one-finger pan above 1x;
- double-tap to zoom/reset;
- desktop Ctrl/Cmd + wheel zoom;
- Ctrl/Cmd `+`, `-`, `0` keyboard equivalents;
- settings-drawer Zoom In / Reset / Zoom Out controls;
- ordinary content up to 3x;
- synthetic cover/map/illustration pages from Visual Page Cache up to 4x.

Zoom transforms an outer `#zoomLayer`, so font size, EPUB pagination, canonical Page Map geometry and saved progress remain unchanged. Page turns, explicit navigation/seeking, flow switches and layout changes reset zoom before navigation.

### Architectural debt removed

- Removed the temporary `URLSearchParams` source interception used to disguise the public `bk_...` Reader URL as a private EPUB path for the old monolith.
- Removed `window.__sgReaderPublicBookId` and `window.__sgReaderSourcePath` state handoffs.
- Reader storage now receives the public/private identities explicitly from the authorized session.
- Page Map/cache ownership keys use the public opaque book identity while EPUB.js opens the authorized private source path.
- Merged swipe, iframe gesture hooking and desktop wheel-turn behavior into `reader/gestures.js`.
- Merged Finished/end-page/next-volume behavior into `reader/completion.js`.
- Moved Continuous-only text-width visibility into `reader/settings.js` rather than observing body classes from a version patch.

### Retired Reader scripts

- `reader.js`
- `reader-polish.js`
- `reader-v1.10.1.js`
- `reader-gesture-hook.js`
- `reader-wheel-pages.js`
- `reader-finished.js`

Reader CSS patch files are intentionally deferred to R7 so this high-risk behavioral refactor does not also become a design-system rewrite.

### Relevant flaws caught during decomposition

- **Gesture ownership was split across three controllers.** Swipe, forwarded iframe touch handling and desktop wheel paging could compete. They now share one gesture state machine, and pan takes precedence while zoomed.
- **Legacy completion-dialog code no longer matched the live end-page architecture.** Completion is now owned only by the real Page/Continuous end page controller.
- **Reader settings were split across two persistence/DOM owners.** R4 has one settings controller while retaining compatibility with the old swipe preference key.
- **Public/private progress identity depended on global bootstrap variables.** The Reader session/storage contract now supplies identities explicitly.
- **Reader startup depended on monkey-patching `URLSearchParams`.** EPUB.js receives the authorized `sourcePath` directly instead.
- **Page Map identity could follow the private source path through that interception.** R4 keys Page Map/Reader browser state to the public opaque identity where available.
- **Read Again reset was still defensively duplicated around startup.** The authorized book session is now the single pre-open reset boundary and fails closed if Finished/progress cannot actually be cleared.

### Acceptance

- [x] Pages and Continuous have explicit application adapters and share one orchestrator.
- [x] Cover/page 1 = Unread; page 2+ = In Progress; Finished overrides progress.
- [x] Read Again clears progress + Finished, preserves bookmarks and opens page 1 through the session boundary.
- [x] Signed `/media/*` source/Range behavior and ticket renewal stay outside Reader state ownership.
- [x] Page Map and Visual Page Cache remain the canonical layout/visual optimization boundaries.
- [x] Swipe, desktop wheel, pinch, pan, double-tap and zoom have one owner.
- [x] Zoom is excluded from Page Map/saved-progress geometry.
- [x] Dead/competing Reader controllers are removed and guarded by `tools/check-r4.mjs`.

---

## R5 — Garden Keeper decomposition

**Goal:** replace the large Keeper bootstrap/enhancement stack with an app shell, authentication/session client, shared admin API client, isolated Library/Series/Upload/Maintenance/History/Trash/Abuse workflows, version component, and reusable dialog/toast/form primitives.

### Acceptance

- [ ] Workflows initialize independently through the shell.
- [ ] One admin API client owns bearer/session/error behavior.
- [ ] Lock/unlock cannot be bypassed through UI state.
- [ ] Upload/edit/backup/trash/abuse regression flows pass.

---

## R6 — Cloudflare Pages Functions service layer

**Goal:** make endpoint files thin and move reusable backend logic into explicit `auth`, `media`, `catalog`, `storage`, `abuse`, `validation`, and `http` services.

Security acceptance remains strict: `/media/*` keeps Range + signed authorization; M8 cooldown stays outside `/media/*`; admin APIs retain token + signed session; raw IPs remain unpersisted; direct B2 credentials/URLs stay private.

---

## R7 — CSS and design-system consolidation

**Goal:** replace versioned/override stacks with tokens, primitives, layouts, and feature-owned styles. Preserve Main/Adult/Reader variants and accessibility media queries. Remove version-specific CSS only after visual parity is proven.

---

## R8 — Test architecture and fixtures

**Goal:** add dedicated unit, service/integration, DOM and browser smoke layers. Required fixtures cover Main/Adult, single/multi-volume, long metadata, visual EPUB pages, progress state variants, and expired/tampered ticket scenarios.

Priority browser flow remains **Read → Continue → Finished → Read Again**, alongside Page/Continuous parity, Reader zoom/gesture interactions, and Keeper security/workflow smoke tests.

---

## R9 — Build and deployment cleanup

**Goal:** audit/remove unused dependencies, commit a lockfile after choices settle, centralize deployment metadata/assets, keep `dist/` generated, and make a deliberate bundler/no-bundler decision based on measurable benefits rather than fashion.

---

## R10 — Final cutover and v2 baseline

**Goal:** remove obsolete compatibility/migration/version layers, regenerate architecture docs, run the full security + Reader + Library + Keeper production matrix, and establish the refactored major-version baseline.

### Completion criteria

- [ ] Every behavior has a documented owner.
- [ ] No duplicate runtime owners independently modify the same state/UI.
- [ ] Full CI/browser regression suite passes.
- [ ] Production smoke test passes on `pages.dev`.
- [ ] Security Milestones 1–9 remain intact.
- [ ] No known obsolete compatibility/patch layer remains.
- [ ] Refactored architecture becomes the next major-version baseline.

---

## Recommended execution order

With **R0–R4 complete**, proceed to **R5 Garden Keeper decomposition**. The public browsing and Reader sides now have explicit application/domain boundaries, so Keeper can be decomposed without also changing reading behavior. Follow with Functions (R6), CSS/design system (R7), broader tests (R8), build cleanup (R9), and final cutover (R10).

Do not mix the Keeper rewrite, backend service rewrite, and design-system consolidation in one PR.
