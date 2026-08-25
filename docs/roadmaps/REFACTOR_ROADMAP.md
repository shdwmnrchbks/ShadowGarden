# Shadow Garden Full Refactor Roadmap

**Status:** 🟨 Active — R0–R9 complete; R10 next  
**Starting baseline:** v1.15.14  
**Current refactor release:** v1.24.0  
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
| R5. Garden Keeper decomposition | ✅ Done | Thin Keeper shell, single admin client/session boundary, isolated workflows, explicit lifecycle events |
| R6. Pages Functions service layer | ✅ Done | Thin routes over explicit auth, catalog, storage, validation, media, abuse, HTTP, and admin services |
| R7. CSS and design-system consolidation | ✅ Done | Semantic feature/layout/component owners replace historical current/polish/version CSS stacks |
| R8. Test architecture and fixtures | ✅ Done | Layered deterministic unit/service/DOM/browser-smoke coverage and reusable high-risk fixtures |
| R9. Build and deployment cleanup | ✅ Done | Locked dependency tree, deterministic build/deployment metadata, read-only `npm ci` CI, dependency-free preview, explicit no-bundler decision |
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

Completed work includes `MODULE_CONVENTIONS.md`, `BUILD_CONTRACT.md`, the legacy-source exception manifest, Node 22 pinning, immutable Actions pins, centralized build-time asset versioning, dead-file enforcement, and production-build verification in CI. R9 later finalized the deferred dependency boundary with a committed npm v3 lockfile, `npm ci`, and deterministic deployment metadata.

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

**Status:** ✅ Done — accepted 2026-08-24  
**Release:** v1.20.0  
**Goal:** replace the large Keeper bootstrap/enhancement stack with an app shell, authentication/session client, shared admin API client, isolated Library/Series/Upload/Maintenance/History/Trash/Abuse workflows, version component, and reusable UI primitives.

See [`../architecture/KEEPER_LAYER.md`](../architecture/KEEPER_LAYER.md).

### Final ownership

- `admin/core.js` — Garden Keeper runtime, state/events, reusable UI primitives, cover utilities, and the sole `AdminClient`.
- `admin/app.js` — composition root and explicit workflow startup.
- `admin/auth-session.js` — Turnstile Gate, signed-session establishment, client authorization latch, and Lock.
- `admin/shell.js` — New Books/Maintenance dialogs and targeted-upload context.
- `admin/library-workflow.js` — Library cards, Series Editor, canonical status/audio/banner editing, and soft-delete entry points.
- Upload internal stack — batch validation/queue engine, replacement guard, editor selector, stateful progress/completion presentation, and lifecycle event bridge, contained to the Upload workflow.
- `admin/maintenance-workflow.js` — Garden Health, deep B2 verification, and cover optimization.
- `admin/history-workflow.js` — Catalog History create/restore/delete.
- `admin/trash-workflow.js` — Trash restore/purge.
- `admin/abuse-workflow.js` — Abuse Watch and cooldown release.
- `admin/version.js` — deployed version component.

### Relevant flaws eliminated during decomposition

- **UI unlock used to re-enter the legacy button handler after Turnstile.** R5 performs server session establishment and protected `/admin-api/status` verification directly before opening the private client latch.
- **Bearer/API behavior was repeatedly wrapped by later scripts.** One `AdminClient` now owns bearer headers, same-origin session cookies, timeouts, normalized errors, and opaque cover upload mapping.
- **Series editing had competing owners.** Status normalization, audio URL, banner choice, Adult scope, save flow, and Move to Trash now live in the Library/Series workflow.
- **Maintenance modified Library deletion handlers.** Library owns the move-to-Trash action; Trash owns recovery/purge; Maintenance owns health/cover work only.
- **Bootstrap dynamically accumulated unrelated enhancements.** `admin/app.js` now declares the complete runtime composition and workflows register explicitly.

### Acceptance

- [x] Workflows initialize independently through the shell.
- [x] One admin API client owns bearer/session/error behavior.
- [x] Lock/unlock cannot be bypassed through UI state.
- [x] Upload/edit/backup/trash/abuse regression ownership is guarded by `tools/check-r5.mjs`.
- [x] R5 does not refactor Pages Functions or weaken the Milestone 7 server authorization boundary.

---

## R6 — Cloudflare Pages Functions service layer

**Status:** ✅ Done — accepted 2026-08-25  
**Release:** v1.21.0  
**Goal:** make endpoint files thin and move reusable backend logic into explicit `auth`, `media`, `catalog`, `storage`, `abuse`, `validation`, and `http` services.

See [`../architecture/FUNCTIONS_LAYER.md`](../architecture/FUNCTIONS_LAYER.md).

### Final ownership

- `functions/services/http.js` — JSON/cookie responses, same-origin request checks, method errors, parsing, and deferred `waitUntil` work.
- `functions/services/storage.js` — Backblaze B2 clients, object URLs/key validation, GET/HEAD/PUT/DELETE, and storage configuration.
- `functions/services/auth.js` — Garden Keeper bearer + signed-session authorization, Turnstile/session establishment, admin cooldown orchestration, and public human verification.
- `functions/services/media.js` — book acquisition authorization plus signed `/media/*` proxy/Range/cache/catalog-redaction behavior.
- `functions/services/catalog.js` — Main/Adult catalogs, upload mutation, Series/Library editing, banner choice, backups, Trash/recovery/purge, and Maintenance orchestration.
- `functions/services/validation.js` — upload namespace/type/size checks, opaque cover enforcement, catalog input normalization, Garden Health, and bounded object checks.
- `functions/services/abuse.js` — M8 cooldown response/telemetry orchestration and authenticated Abuse Watch review/release.
- `functions/services/admin.js` — small authenticated status/upload composition over auth/storage/validation.
- `_lib/admin-session.js`, `_lib/human-session.js`, `_lib/media-ticket.js`, `_lib/admin-throttle.js`, `_lib/abuse-telemetry.js`, crawler policy, acquisition limiter, and book identity/resolution remain low-level accepted primitives.

### Relevant flaws eliminated during decomposition

- **Catalog persistence existed in several routes.** Main/Adult load/save/sort/cache invalidation now have one Catalog service owner.
- **`b2.js` mixed storage transport, admin authentication and HTTP responses.** Those responsibilities now live in Storage, Authentication and HTTP services; `b2.js` is only a compatibility facade.
- **Maintenance was both a route and a persistence utility.** `garden-maintenance.js` is now a compatibility facade over Catalog/Validation rather than a second implementation.
- **Security tests were coupled to route-file internals.** M5–M9 and R0 now assert the same contracts at the service owners while route thinness is separately guarded by R6.
- **Service extraction risked changing M8 persistent state.** The accepted HMAC abuse-state/ledger implementation was retained exactly apart from its Storage-service dependency.

### Security acceptance

- [x] `/media/*` keeps signed ticket authorization, HTTP Range forwarding, same-origin protected-media headers, and public catalog redaction.
- [x] M8 public cooldown enforcement stays outside `/media/*`; stale Range invalid-ticket retries remain excluded from persistent scoring.
- [x] `/admin-api/*` still requires both the Keeper bearer token and signed admin session.
- [x] Server-side Keeper cooldown and HMAC-derived abuse identities retain their accepted formats and behavior; raw IPs are not persisted.
- [x] Opaque `cv_...` cover object names remain server-enforced and private B2 transport remains server-only.
- [x] Every endpoint is a thin service adapter and `tools/check-r6.mjs` protects the boundary.

---

## R7 — CSS and design-system consolidation

**Status:** ✅ Done — accepted 2026-08-25  
**Release:** v1.22.0  
**Goal:** replace versioned/override stacks with semantic tokens, primitives, layouts, components, and feature-owned styles while preserving Main/Adult/Reader/Keeper behavior and accessibility variants.

See [`../architecture/DESIGN_SYSTEM.md`](../architecture/DESIGN_SYSTEM.md).

### Final ownership

- `site.css` — public/Garden Keeper foundation tokens and base Library/Series structure.
- `library-features.css` — Recently Added, advanced filters, exact-tag chips, load-more behavior, and responsive Library feature layout.
- `public-components.css` — skip/focus treatment, archive/header components, pinned UI, mobile filter collapse, Adult chrome parity, and public accessibility media queries.
- `public-artwork.css` — Library/Series artwork, compact badges, Continue cover, Series primary actions, and navigable Series tags.
- `library-layout.css` — final compact-card column and badge-rail geometry.
- `reader.css` — Reader-scoped token/chrome foundation and core flow geometry.
- `reader-completion.css` — settings toggle and volume-completion presentation.
- `reader-presentation.css` — Paper reading surface, loading motion, and flow-specific control visibility.
- feature-owned Reader sheets remain separate for Continuous rail, Page Map, end page, image focus, accessibility, and interface themes.
- `admin-series-editor.css` — Keeper Series Editor dialog/accessibility/toast presentation.
- `admin-layout.css` — Keeper Manage Library/workspace/dialog geometry.
- `admin-components.css` — Upload/preflight/completion/Catalog History components.
- `admin-presentation.css` — Series banner chooser/preview presentation.

### Relevant cleanup completed

- **Public styling depended on `site-current.css` + `site-v1.9.4.css`.** Their rules now have semantic component/artwork owners and the historical files are deleted.
- **Library layout fixes accumulated in scale/alignment filenames.** Recently Added/filter features and compact-card geometry are now separate `library-features.css` and `library-layout.css` owners.
- **Reader presentation still had generic polish/version sheets.** `reader-completion.css` and `reader-presentation.css` replace them without touching Reader runtime/input/layout ownership.
- **Garden Keeper runtime loaded `admin-current.css` and `admin-v1.9.4.css`.** The composition root now loads `admin-components.css` and `admin-presentation.css` instead.
- **Two R0-frozen Keeper direct CSS paths remain in `admin.html`.** They are now selector-free `@import` aliases to `admin-series-editor.css` and `admin-layout.css`; they cannot act as patch owners and are reserved for final R10 legacy-entrypoint removal.
- **Surface palettes are intentionally not flattened.** Public/Keeper foundation variables stay in `site.css`, while Reader-specific chrome/theme tokens stay in `reader.css` and `reader-interface-themes.css`.

### Acceptance

- [x] Main, Adult, Series, and Reader direct stylesheet order is semantic and matches the architecture manifest.
- [x] `site-current.css`, `site-v1.9.4.css`, `library-scale.css`, `library-compact-alignment.css`, `reader-polish.css`, `reader-v1.10.1.css`, `admin-current.css`, and `admin-v1.9.4.css` are deleted and guarded from returning.
- [x] Public reduced-motion, increased-contrast, forced-colors, focus-visible, and Adult variants remain under explicit owners.
- [x] Reader Garden/Night/Black/Paper, Adult Reader, and accessibility variants remain intact.
- [x] Garden Keeper semantic runtime CSS is declared by `admin/app.js`; the two legacy direct aliases contain no selectors.
- [x] `tools/check-r7.mjs` protects cascade order, semantic ownership, variants, accessibility, cache headers, and retired patch layers.

---

## R8 — Test architecture and fixtures

**Status:** ✅ Done — accepted 2026-08-25  
**Release:** v1.23.0  
**Goal:** add dedicated unit, service/integration, DOM and browser-smoke layers with reusable deterministic fixtures around Shadow Garden's highest-risk contracts.

See [`../architecture/TEST_ARCHITECTURE.md`](../architecture/TEST_ARCHITECTURE.md).

### Final test architecture

- `tests/unit/` — catalog/Library model behavior, browser-local reading state, Reader swipe classification, and image-focus geometry.
- `tests/service/` — signed media tickets, Garden Keeper bearer + signed-session authorization, upload/catalog validation, and Garden Health using real server modules without external network calls.
- `tests/dom/` — public renderer ownership with narrow deterministic DOM doubles rather than a second DOM framework.
- `tests/browser/` — browser-contract smoke tests for Main/Adult/Series/Reader/Keeper entrypoints, visual EPUB pages, Reader Pages/Continuous input ownership, image-focus isolation, Keeper composition, and the priority reading lifecycle.
- `tools/run-tests.mjs` — one Node 22 layered runner behind `npm test` plus `test:unit`, `test:service`, `test:dom`, and `test:browser`.
- `tools/check-r8.mjs` — permanent fixture/layer/package/docs/coverage guard.

### Canonical fixture coverage

- Main and Adult catalogs with explicit shelf isolation.
- single-volume and multi-volume series.
- deliberately long title/author/description/search metadata.
- Unread / In Progress / Finished / Read Again state cases.
- concrete cover, Western Continent map, illustration, and normal reflowable XHTML spine documents.
- valid, tampered-signature, tampered-path, and expired signed-media-ticket scenarios.
- deterministic browser-local storage/location/event helpers plus narrow DOM test doubles.

### Audit correction caught by R8

- **Signed EPUB path normalization was broader than the canonical book namespace.** `normalizeBookPath()` accepted any `.epub` below `/media/shadow-garden/`; after URL normalization, a traversal-like `/media/shadow-garden/books/../secret.epub` could become `/media/shadow-garden/secret.epub` and still satisfy that broad prefix. R8 tightened the primitive to require `/media/shadow-garden/books/`, and the service suite permanently covers this case together with valid/tampered/expired tickets.

### Acceptance

- [x] Unit, service/integration, DOM, and browser-smoke layers execute independently through Node 22's built-in test runner.
- [x] Main/Adult, single/multi-volume, long-metadata, visual EPUB, reading-state, and ticket-security fixture families are reusable under `tests/fixtures/`.
- [x] Priority browser flow **Read → Continue → Finished → Read Again** clears progress/Finished, preserves bookmarks, and retains `restart=1` semantics.
- [x] Reader tests preserve Pages horizontal swipe ownership, native Continuous touch scrolling, and viewport-only image-focus pinch/pan.
- [x] Keeper tests cover both bearer + signed-session authorization and the R5 composition/unlock boundary.
- [x] `npm run check` runs the complete R0–R8/security guards plus all four behavioral test layers; `prebuild` repeats the same gate before production output.
- [x] R8 adds no test framework/headless-browser dependency; the dependency/browser-runner decision remains R9/R10 work.

---

## R9 — Build and deployment cleanup

**Status:** ✅ Done — accepted 2026-08-25  
**Release:** v1.24.0  
**Goal:** finalize dependency/install ownership, deterministic build/deployment metadata, CI runtime pins, local preview, and the bundler decision while keeping `dist/` generated.

See [`../architecture/BUILD_DEPLOYMENT.md`](../architecture/BUILD_DEPLOYMENT.md).

### Final ownership

- `package-lock.json` — committed npm lockfile version 3; exact transitive dependency tree for Node 22 verification.
- `package.json#engines.node` + `.nvmrc` + CI — one Node 22 project-runtime boundary.
- `tools/lib/build-context.mjs` — package version, deployment commit/branch and deterministic build timestamp owner.
- `tools/build.mjs` — generated `dist/`, asset stamping, locked EPUB.js/JSZip vendor copies, local EPUB indexing and catalog generation.
- `tools/write-source.mjs` — generated catalog-source and deployment-version descriptors using the same build context.
- `tools/preview.mjs` — dependency-free Node static preview for generated `dist/`, replacing unpinned `npx serve`.
- `.github/workflows/verify.yml` — read-only CI using current immutable checkout/setup-node pins, Node 22, `npm ci`, the complete check suite and production build.
- `tools/check-r9.mjs` — permanent build/deployment boundary guard.

### Dependency audit

All five direct dependencies remain because each has an explicit owner: `@aws-sdk/client-s3` for local B2 utilities, `aws4fetch` for Pages/B2 signing, `epubjs` for the Reader vendor runtime, `fast-xml-parser` for EPUB package metadata, and `jszip` for EPUB parsing plus the browser vendor runtime. R9 removes no live package merely to reduce the dependency count.

### Bundler decision

R9 deliberately keeps Shadow Garden as a native static/module application. No Vite/Rollup/webpack/esbuild/Parcel layer is added because the current module count, asset-versioning strategy, Pages Functions deployment, and vendor-copy boundary do not show a measured problem that bundling would solve. R10 may revisit only with production evidence and equivalent regression coverage.

### Determinism and CI corrections

- A committed lockfile plus `npm ci` replaces floating transitive resolution during verification.
- Asset cache-busting and deployment metadata share `package.json#version`.
- Local catalog `generatedAt` and deployment `builtAt` share one build timestamp resolved from `SOURCE_DATE_EPOCH` or Git commit time before wall-clock fallback.
- Old Actions revisions that emitted Node-20-runtime deprecation warnings are replaced by current immutable action SHAs while project commands remain on Node 22.
- The Verify workflow remains `contents: read`.

### Acceptance

- [x] Direct dependencies are audited and every retained package has a documented owner.
- [x] `package-lock.json` is committed and synchronized with the v1.24.0 manifest; CI uses `npm ci`.
- [x] Node 22 is explicit in local, package, and CI contracts.
- [x] Build/version/catalog metadata use one deterministic build-context owner.
- [x] Local preview uses committed Node tooling rather than an undeclared `npx` package.
- [x] The no-bundler decision is explicit and measured-risk based.
- [x] `dist/` remains generated/ignored and production build verification remains mandatory.
- [x] `tools/check-r9.mjs` permanently guards the finalized boundary.

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

With **R0–R9 complete**, proceed to **R10 final cutover and v2 baseline**. Public browsing, Reader, Garden Keeper, Pages Functions, CSS/design-system ownership, deterministic regression layers, and the locked build/deployment pipeline are now explicit. R10 may remove the remaining documented compatibility entrypoints and must finish with the full production/browser/security matrix.

Do not reopen completed milestones merely to perform R10 legacy removal; preserve their contracts or replace them intentionally with equal or stronger coverage.
