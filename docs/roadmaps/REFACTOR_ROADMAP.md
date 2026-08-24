# Shadow Garden Full Refactor Roadmap

**Status:** 🟨 Active — R0–R4.1 complete; R5 next  
**Starting baseline:** v1.15.14  
**Current refactor release:** v1.19.0  
**Security baseline:** Milestones 1–9 complete  
**Hosting constraint:** remain compatible with `shadowgarden-bon.pages.dev` and private Backblaze B2.

This is an incremental structural refactor toward a clean v2 architecture. `main` must remain deployable after every slice, security contracts must remain intact, and browser-local reading data must stay browser-local.

## Refactor rules

1. **Behavior before beauty.** Refactors preserve user-visible behavior unless a correction is explicitly included and tested.
2. **Security invariants are contracts.** Signed media tickets, opaque IDs, Turnstile sessions, admin sessions, throttles, Range behavior, and private B2 boundaries cannot weaken during cleanup.
3. **Reader stability is highest risk.** Page/Continuous, Page Map, Visual Page Cache, ticket renewal, progress, bookmarks, completion and input handling require regression coverage around every Reader slice.
4. **One owner per responsibility.** Replace v1's base + polish + patch ownership with controllers, models, renderers, and services.
5. **Small mergeable slices.** Do not combine unrelated subsystem rewrites.
6. **Delete dead compatibility code when proven safe.**
7. **No framework rewrite by default.** Native modules remain preferred until a later decision demonstrates a measurable benefit.
8. **No Reader accounts or server-side reading history.**
9. **Refactoring is also an audit.** When duplicated ownership exposes a closely related behavioral flaw, correct it in the owning milestone and add a regression check rather than preserving a known defect.
10. **Real-device regressions feed back into architecture.** A corrective hotfix may restore service, but the next stabilization slice must fold the lesson into explicit ownership and permanent checks.

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
| R4. Reader architecture refactor | ✅ Done | Explicit Reader session/orchestrator/controllers and removal of the old monolith |
| R4.1. Reader stabilization and consolidation | ✅ Done | Split Pages input from image focus, restore native Continuous touch, fold v1.18.x hotfix lessons into permanent architecture |
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
- `library-mobile-filter.js` — mobile filter panel placement/collapse.
- `nav-pinned.js` — pinned navigation.
- `library-footer-version.js` — Library deployed-version component.

See [`../architecture/PUBLIC_UI_LAYER.md`](../architecture/PUBLIC_UI_LAYER.md).

### Relevant flaws caught during decomposition

- **Recently Added bypassed Finished state.** All Library/Series volume entry points now use one canonical action model.
- **Series covers depended on post-render mirroring.** Cover and button are rendered from the same action object.
- **Returned pages could display stale state.** Library and Series refresh on `pageshow` plus reading/storage events.
- **Reading-state refresh collapsed incremental Library results.** R3 preserves rendered depth.
- **Read Again could navigate after an incomplete local reset.** Reset is verified before `restart=1` navigation.
- **Series banner selection was a later DOM repair.** `bannerBookId` now participates in initial render.

### Acceptance

- [x] Each Library/Series behavior has one renderer/controller owner.
- [x] Grid/Compact share model/state without post-render compact badge repair.
- [x] Read / Continue / Read Again is identical across all public volume entry points.
- [x] Main and Adult Libraries use the same controller/model/renderers with explicit scope.
- [x] Public R3 controllers do not use MutationObserver to repair owned DOM.
- [x] `tools/check-r3.mjs` guards ownership and volume-action contracts.

---

## R4 — Reader architecture refactor

**Status:** ✅ Done — accepted 2026-08-24  
**Release:** v1.18.0  
**Goal:** replace overlapping Reader ownership with one explicit application/session architecture while preserving EPUB, security and reading-state behavior.

See [`../architecture/READER_LAYER.md`](../architecture/READER_LAYER.md).

### Core ownership established

- `reader-bootstrap.js` — minimal protected startup.
- `reader/book-session.js` — authorized public/private book session and Read Again startup boundary.
- `reader/app.js` — Reader orchestration.
- `reader/rendition.js` — rendition lifecycle/spread/flow-position capture.
- `reader/paginated.js` / `reader/continuous.js` — application flow adapters.
- `reader/page-map.js` — canonical device Page Map.
- `reader/progress-controller.js` / `reader/bookmarks-controller.js` / `reader/completion.js` — canonical reading state UI owners.
- `reader/settings.js` / `reader/theme.js` — Reader preferences/presentation.
- retained low-level compatibility boundaries: Visual Page Cache, paginated visual fit, Continuous core, EPUB adapter, Continuous rail.

R4 also removed the temporary `URLSearchParams` source interception, global public/private Reader identity handoffs, and the old `reader.js` / polish / gesture-hook / wheel / Finished controllers.

### Original R4 zoom decision

v1.18.0 introduced Reader-wide viewport pinch/pan/zoom. The layout-isolation idea was sound, but real-device use showed that EPUB-document gesture interception could still interfere with Continuous vertical touch scrolling. That feature was therefore corrected in v1.18.2 and permanently re-architected by R4.1 rather than preserved as the final contract.

### Acceptance

- [x] Pages and Continuous have explicit application adapters and share one orchestrator.
- [x] Cover/page 1 = Unread; page 2+ = In Progress; Finished overrides progress.
- [x] Read Again clears progress + Finished, preserves bookmarks and opens page 1 through the session boundary.
- [x] Signed `/media/*` source/Range behavior and ticket renewal stay outside Reader state ownership.
- [x] Page Map and Visual Page Cache remain canonical layout/visual boundaries.
- [x] Dead/competing Reader controllers are removed and guarded by `tools/check-r4.mjs`.

---

## R4.1 — Reader stabilization and consolidation

**Status:** ✅ Done — accepted 2026-08-24  
**Release:** v1.19.0  
**Goal:** fold v1.18.1–v1.18.3 Reader corrections back into clean architecture before leaving the Reader for later milestones.

### Final input ownership

- `reader/page-navigation-input.js` — Pages-only horizontal swipe recognition and desktop wheel page turns.
- `reader/image-focus.js` — EPUB image selection plus the top-level focused-image overlay, pinch zoom and pan.
- `reader-image-focus.css` — focused-image presentation only.

The combined `reader/gestures.js` and misleading `reader-zoom.css` names are retired.

### Stabilization corrections

- **Reader startup regression:** the `createRendition()` boundary permanently requires `wire: wireRendition`, preventing the v1.18.0 undeclared `wire` failure from returning.
- **Continuous touch regression:** EPUB documents receive no Reader-owned `touchmove` handler or `touch-action` override. Native vertical touch scrolling stays browser/Continuous-owned.
- **Input coupling:** Pages navigation and image focus no longer share a state machine.
- **Image-only zoom:** pinch/pan exists only inside the focused-image overlay, never on the live EPUB viewport.
- **Image pan geometry:** transform is applied directly to the focused image and bounded using its rendered dimensions against the overlay viewport.
- **Hotfix CSS cleanup:** explicit `reader-image-focus-zoomed` state replaces `:has()` plus inline-style substring detection.
- **Hidden-control focus flaw:** if magnification hides the close button while it owns keyboard focus, focus moves to the dialog rather than remaining on invisible chrome.
- **Navigation safety:** page turns, seeks, flow switches, relayout and resize dismiss the temporary image overlay without changing reading position.

### Acceptance

- [x] Reader opens through explicit `wire: wireRendition` wiring.
- [x] Continuous EPUB documents have no Reader-owned `touchmove` or `touch-action` override.
- [x] Pages horizontal swipe and desktop wheel turns remain isolated to Pages mode.
- [x] Tapping/clicking an EPUB image opens image focus; pinch/pan is confined to the overlay.
- [x] Closing image focus preserves the live EPUB position and canonical Page Map state.
- [x] Image-focus chrome hides above 1x without leaving focus on an invisible close button.
- [x] `gestures.js` / `reader-zoom.css` are removed and guarded from returning.
- [x] `tools/check-r4-1.mjs` protects these stabilization contracts.

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

Priority browser flow remains **Read → Continue → Finished → Read Again**, alongside Page/Continuous parity, native Continuous touch scrolling, Pages swipe/wheel input, focused-image zoom, and Keeper security/workflow smoke tests.

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

With **R0–R4.1 complete**, proceed to **R5 Garden Keeper decomposition**. The public browsing and Reader sides now have explicit application/domain boundaries and the post-R4 Reader corrections have been consolidated before moving on. Follow with Functions (R6), CSS/design system (R7), broader tests (R8), build cleanup (R9), and final cutover (R10).

Do not mix the Keeper rewrite, backend service rewrite, and design-system consolidation in one PR.
