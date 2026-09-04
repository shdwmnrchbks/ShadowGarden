# Shadow Garden v2.11.0 Development

Shadow Garden is a self-hosted EPUB library and browser Reader built for Cloudflare Pages. EPUBs, covers, catalogs, security state, and maintenance data live in a **private Backblaze B2 bucket** and are delivered or managed through same-origin Cloudflare Pages Functions. Private administration is handled by the **Garden Keeper** console.

Production: `https://shadowgarden-bon.pages.dev/`

The accepted architecture baseline remains v2.0.0. The active deployment/product line is **v2.11.0 — Engineering Audit, Refactor & Optimization**; the latest formal release remains **v2.10.0 — Maintenance & Supply Chain**. The website feature set is intentionally considered sufficient for now, so current work is an **audit-first engineering-health phase**. Shadow Garden will inspect architecture, ownership, dead/compatibility code, runtime behavior, realistic-scale performance, tests/tooling, security/recovery boundaries, CSS/accessibility, and documentation before deciding whether any further refactor or optimization is actually needed. Stable subsystems should be left alone.

The active v2.11 roadmap is [`docs/roadmaps/CURRENT_ROADMAP.md`](./docs/roadmaps/CURRENT_ROADMAP.md), with evidence and decisions recorded under [`docs/audits/`](./docs/audits/). Completed roadmap history is archived under [`docs/archive/`](./docs/archive/).

## Current feature set

### Library

- Separate Main and 18+ / Adult archives using the same Library controller/model/renderers with explicit scope.
- Recently Added shelf and progress-aware reading banner.
- Search, author, fan-translator, genre, year, volume-count, reading-status, pinned, exact-tag filters, sorting, URL persistence, Back/Forward restoration, and Grid/Compact rendering.
- Canonical browser-local states: **Unread → Read**, **In Progress → Continue**, **Finished → Read Again**.
- Every public volume entry point uses the same state/action pipeline, including Series covers, Series buttons, Recently Added, and the reading banner.
- Read Again confirms the reset, clears Finished + progress, preserves bookmarks, verifies the volume returned to Unread, and opens page 1.
- Reading suggestions can be rerolled, remain motion/reduced-motion aware, and expose accessible feedback when no alternate suggestion is available.
- Pinned Series remain available from the canonical responsive navigation drawer.

### EPUB Reader

- EPUB.js-based **Pages** and **Continuous** modes behind one Reader application layer.
- Explicit authorized book-session boundary for opaque public `bk_...` identity and private EPUB source identity.
- Canonical device Page Map shared by both reading modes.
- v2.8 typeface choices are intentionally focused: **Default** preserves the publication's typography, while Sans, Serif, and Sans-Serif map to the supported Reader font families with legacy preferences migrated forward.
- v2.8 progress presentation keeps the canonical Page Map/progress owner: Pages can show device page, volume percentage, and chapter context together; Continuous mirrors the same canonical progress through its dedicated rail with compact visual text and richer accessible context.
- Contents filtering, Current-location recovery, bounded whole-book CFI-backed text search, Reader-owned footnote/endnote popups, and hardened resume/error recovery remain covered by the permanent browser matrix.
- Persistent progress, bookmarks, Finished state, themes, typography, flow, and layout preferences through the shared browser domain layer.
- Visual Page Cache and fitting for standalone covers, maps, and illustration pages.
- Pages-only navigation ownership for horizontal swipe turns and desktop wheel page turns; Pointer Events are preferred with Touch Events fallback.
- Continuous mode receives no Reader-owned EPUB-document `touchmove` interception. Its rendition keeps native vertical scrolling and an unclaimed `touch-action` policy.
- EPUB images open in an isolated focused-image overlay with pinch zoom and one-finger pan while magnified; the live EPUB viewport and saved reading position remain unchanged.
- WebKit can use parent-owned image hit targets without enabling scripts inside publication content.
- Continuous seek rail, TOC, fullscreen, end-of-volume navigation, next-volume completion, and Finished toggle.
- Protected media tickets renew after sleep/background-style visibility restoration without moving the current Reader location.
- Mobile Reader chrome auto-hides without reserving blank layout space in Continuous mode; downward reading scroll stays hidden while tap/upward interaction reveals controls.
- Continuous publication content reserves only the fixed seek-rail interaction strip, keeping artwork out from under the rail while the outer Reader viewport remains full-width.
- Split-XHTML chapters inherit their chapter title/active TOC identity from the canonical navigation + spine relationship rather than a filename/global heuristic.
- Reader controls allow normal browser zoom and meet the v2.6 mobile touch-target contract.

### Series

- Progress-aware primary CTA and per-volume actions.
- Volume cover and button are rendered from the same canonical action object.
- Finished marks, progress metadata, direct tag navigation, selected/random series banner artwork, pinning, and Main/Adult navigation.
- Fan-translation provenance supports series defaults plus per-volume overrides.

### Garden Keeper

- One admin client and explicit Authentication/session, Library/Series, Upload, Maintenance, Catalog History, Trash, Abuse Watch, and version owners.
- Turnstile + Keeper-token protected `/admin.html` and signed server-side sessions for `/admin-api/*`; the browser client opens only after protected status verifies the session.
- Manage Library, New Books, Maintenance, Series Editor, translation metadata, Catalog History, Trash, Garden Health, Abuse Watch, and Recovery Readiness workflows.
- Multi-EPUB upload/preflight, duplicate/similar-volume warnings, normal single-series metadata/banner editing, deterministic Maintenance fixes, Audio EPUB links, opaque random `cv_...` covers, restore/purge, and deployed version/commit information.
- Catalog snapshots/checksums, object-complete recovery anchors, last-recoverable-state protection, and deterministic recovery drills make recovery readiness explicit without performing destructive production recovery in normal CI.
- Catalog History retains the newest 15 snapshots; older snapshots are pruned by the canonical snapshot flow.
- Batch Edit and Batch Artwork are intentionally retired and are protected by source/backend tombstones.
- Busy-state guards prevent duplicate Series, translation, upload, History, Trash, and Abuse mutations while requests are pending.
- Native dialogs are keyboard-contained and restore focus after dismissal, including after manager rerenders replace the original opener node.

### Pages Functions

- Thin route adapters over explicit `auth`, `media`, `catalog`, `storage`, `validation`, `abuse`, `http`, and small `admin` services.
- One B2 transport owner for private object reads/writes, object-key validation, and storage configuration.
- One server catalog owner for Main/Adult persistence, upload mutations, Library/Series edits, banners, backups, Trash, recovery, purge, and Maintenance commits.
- Signed EPUB authorization and HTTP Range delivery remain together in the Media service, while public cooldown enforcement deliberately stays outside `/media/*`.
- Signed EPUB tickets normalize only under `/media/shadow-garden/books/`.
- Existing `/media/*`, `/book-access`, `/human-access`, `/admin-access`, and retained `/admin-api/*` URLs and security contracts remain unchanged.

### Accessibility and motion

- Keyboard focus treatment, drawer/dialog focus restoration, reduced motion, increased contrast, forced colors, and visible focus are permanent application contracts.
- v2.6 adds bounded automated accessibility checks for Library, Series, Reader chrome, and Garden Keeper, plus 200%/400% equivalent reflow checks and mobile touch-target verification.
- Browser zoom is not disabled by the Reader viewport.
- Publication-owned EPUB accessibility is tested/documented separately from Shadow Garden-owned application chrome. See [`docs/architecture/ACCESSIBILITY_TESTING.md`](./docs/architecture/ACCESSIBILITY_TESTING.md).
- v2.5 motion remains progressive enhancement and observer-only: application state, requests, reading state, persistence, and navigation retain their canonical owners.

## v2.11 engineering audit

v2.11 is not a feature roadmap or a pre-approved rewrite. Every material finding is classified as **No change needed**, **Cleanup**, **Targeted refactor**, **Measured optimization**, or **Deferred**.

The first accepted v2.11 cleanup restores one existing build contract: authored Reader imports no longer carry hand-maintained local `?v=` cache-history strings. Build-time deployment stamping is the single cache-version owner, and a permanent repository check now guards that boundary.

See [`docs/roadmaps/CURRENT_ROADMAP.md`](./docs/roadmaps/CURRENT_ROADMAP.md) and [`docs/audits/POST_V2_10_AUDIT.md`](./docs/audits/POST_V2_10_AUDIT.md).

## Test architecture

Shadow Garden combines deterministic, real-browser, and recurring maintenance-health layers.

### Deterministic layers

- `tests/unit/` — domain/model/input helpers.
- `tests/service/` — auth, media, validation, catalog/administrative service boundaries.
- `tests/dom/` — renderer ownership against narrow DOM doubles.
- `tests/browser/` — deterministic browser-facing source/interaction contracts and fixtures.

These use Node 22's built-in test runner and remain fast/offline. `npm test` runs the complete deterministic behavioral suite. `npm run check` additionally enforces dependency/runtime, documentation, release-metadata, baseline-maintenance, authored cache-version ownership, and realistic-scale contracts.

### Real Browser E2E

`tests/e2e/` is an isolated Playwright workspace pinned to **1.62.1** with its own committed lockfile. CI runs five projects:

- Chromium desktop
- Firefox desktop
- WebKit desktop
- Chromium Mobile
- WebKit Mobile

The suite builds and serves real production `dist/`, while deterministic fixture routes replace production catalog/B2/service dependencies. A generated EPUB3 fixture exercises protected acquisition and Range delivery, ordinary chapters, illustrations, visual-only content, large chapters, legacy-readable structures, and split-XHTML chapters.

Real-browser coverage includes:

- Main/Adult isolation, Library search/view/history/navigation, pinned state and suggestion rerolls;
- canonical first-paint shells;
- Series → Reader → Series/Library and **Read → Continue → Finished → Read Again** lifecycle;
- Reader Pages/Continuous startup, persistence, controls, TOC, search, keyboard, wheel/swipe policy, flow switching, image focus, resize, resume/ticket renewal, fullscreen, and EPUB resilience;
- Garden Keeper authentication, dialogs, Series/translation editing, upload/preflight behavior, Maintenance, History, Trash, recovery readiness, and Abuse Watch;
- accessibility scans, keyboard/focus restoration, zoom/reflow, contrast/forced-colors/reduced-motion, and mobile targets.

WebKit limitations are represented honestly: where Playwright cannot generate a trusted cross-frame gesture, the suite combines live canonical navigation acceptance with source-level ownership contracts rather than treating synthetic events as trusted browser input.

Failure runs retain Playwright traces, screenshots, video, HTML reports, and browser diagnostics. v2.10 added the monthly complete real-browser rerun and the separate deterministic Baseline Health workflow covering security, recovery, production build, and the 300-series Library sanity tripwire; those remain active in v2.11.

See [`docs/architecture/TEST_ARCHITECTURE.md`](./docs/architecture/TEST_ARCHITECTURE.md) and [`docs/architecture/MAINTENANCE_BASELINE.md`](./docs/architecture/MAINTENANCE_BASELINE.md).

## Security baseline

Security Milestones **1–9 are complete** and remain permanent contracts: private B2 origin storage, signed EPUB tickets, opaque `bk_...` identifiers, Garden Pass/Turnstile, acquisition throttling, crawler screening, Reader anti-indexing, signed Garden Keeper sessions, server-side cooldowns, HMAC-derived abuse controls, private Abuse Watch telemetry, and opaque cover keys.

Browser-local progress, bookmarks, Finished state, pinned state, Reader settings, Library preferences, and Adult acknowledgement remain local to the browser/profile. v2.11 introduces no server-side Reader account/history and grants no scheduled maintenance process authority to mutate production security, storage, catalog, or release state.

The completed security plan is archived at [`docs/archive/SECURITY_ROADMAP.md`](./docs/archive/SECURITY_ROADMAP.md).

## v2 architecture baseline

The R0–R10 full-codebase refactor is complete. `main` remains deployable, Security Milestones 1–9 and browser-local persistence contracts remain protected by CI, and the v2 source tree has explicit owners instead of accumulated patch layers.

**R0–R10 are complete. Shadow Garden v2.0.0 remains the accepted architecture baseline; v2.11.0 is the active audit/refactor/optimization development line and v2.10.0 remains the latest formal release. v2.11 tests whether any part of the accepted architecture now needs simplification or optimization; it does not presume another broad refactor is required.**

- R2 domain/state contract: [`docs/architecture/DOMAIN_LAYER.md`](./docs/architecture/DOMAIN_LAYER.md)
- R3 Library/Series ownership: [`docs/architecture/PUBLIC_UI_LAYER.md`](./docs/architecture/PUBLIC_UI_LAYER.md)
- R4/R4.1 Reader ownership: [`docs/architecture/READER_LAYER.md`](./docs/architecture/READER_LAYER.md)
- R5 Garden Keeper ownership: [`docs/architecture/KEEPER_LAYER.md`](./docs/architecture/KEEPER_LAYER.md)
- R6 Pages Functions service ownership: [`docs/architecture/FUNCTIONS_LAYER.md`](./docs/architecture/FUNCTIONS_LAYER.md)
- R7 CSS/design-system ownership: [`docs/architecture/DESIGN_SYSTEM.md`](./docs/architecture/DESIGN_SYSTEM.md)
- R8 deterministic tests/fixtures + v2.6 real-browser extension: [`docs/architecture/TEST_ARCHITECTURE.md`](./docs/architecture/TEST_ARCHITECTURE.md)
- Reconciled mobile navigation: [`docs/architecture/MOBILE_NAVIGATION.md`](./docs/architecture/MOBILE_NAVIGATION.md)
- R9 build/deployment ownership: [`docs/architecture/BUILD_DEPLOYMENT.md`](./docs/architecture/BUILD_DEPLOYMENT.md)
- R10/v2 baseline: [`docs/architecture/V2_BASELINE.md`](./docs/architecture/V2_BASELINE.md)
- Completed refactor roadmap: [`docs/archive/REFACTOR_ROADMAP.md`](./docs/archive/REFACTOR_ROADMAP.md)
- Current v2.11 roadmap: [`docs/roadmaps/CURRENT_ROADMAP.md`](./docs/roadmaps/CURRENT_ROADMAP.md)
- Current audit evidence: [`docs/audits/POST_V2_10_AUDIT.md`](./docs/audits/POST_V2_10_AUDIT.md)
- v2.5 motion contract: [`docs/architecture/MOTION_SYSTEM.md`](./docs/architecture/MOTION_SYSTEM.md)
- v2.6 accessibility contract: [`docs/architecture/ACCESSIBILITY_TESTING.md`](./docs/architecture/ACCESSIBILITY_TESTING.md)
- v2.10 maintenance baseline: [`docs/architecture/MAINTENANCE_BASELINE.md`](./docs/architecture/MAINTENANCE_BASELINE.md)
- v2.10.0 release notes: [`docs/releases/v2.10.0.md`](./docs/releases/v2.10.0.md)

## Current architecture

```text
Main / Adult Library                 Series
        |                              |
        v                              v
 library.js                       series.js
      |                               |
      +--> library-model.js           +--> series-renderers.js
      +--> library-renderers.js       |
      +-----------+-------------------+
                  |
                  v
        public/volume-actions.js
                  |
                  v
              domain/
  catalog · identity · reading-state
  progress · bookmarks · preferences
  storage · urls · format

Reader bootstrap
      |
      v
reader/book-session.js
      |
      v
reader/app.js
  ├─ rendition + paginated + continuous
  ├─ progress + bookmarks + completion
  ├─ settings + theme
  ├─ page-navigation-input
  ├─ image-focus
  └─ Page Map + retained EPUB.js compatibility layers
      |
      +--> shared domain/state
      +--> signed /media/* source

Garden Keeper
      |
      v
admin/core.js + admin/app.js
  ├─ Authentication/session
  ├─ Library/Series + translation metadata
  ├─ Upload workflow internals
  ├─ Maintenance
  ├─ Catalog History
  ├─ Trash & Recovery
  ├─ Abuse Watch
  └─ version + shell UI
      |
      v
single AdminClient
      |
      v
Cloudflare Pages Function routes
      |
      v
functions/services/
  ├─ auth + media + abuse
  ├─ catalog + validation + admin
  └─ storage + http
      |
      +--> signed session/ticket/throttle primitives
      +--> private Backblaze B2

Regression architecture
      |
      +--> tests/unit + service + dom + browser
      |       └─ deterministic Node 22 suite
      |
      +--> tests/e2e
              └─ Playwright: Chromium / Firefox / WebKit
                 desktop + Chromium/WebKit mobile

Build/deployment architecture
      |
      v
package.json + package-lock.json
      |
      +--> npm ci / Node 22
      +--> tools/lib/build-context.mjs
      |
      v
 tools/build.mjs + tools/write-source.mjs
      |
      v
    generated dist/
      |
      +--> Verify + Real Browser E2E
      +--> monthly Baseline Health + browser reruns
      +--> matching Cloudflare deployment + smoke
      └--> verified GitHub v2 release
```

## Repository layout

```text
.
├─ README.md
├─ CHANGELOG.md
├─ package.json
├─ package-lock.json
├─ docs/
│  ├─ architecture/
│  ├─ audits/
│  ├─ releases/
│  ├─ roadmaps/
│  ├─ archive/
│  ├─ security/
│  └─ style/
├─ src/
├─ functions/
├─ tests/
│  ├─ unit/
│  ├─ service/
│  ├─ dom/
│  ├─ browser/
│  ├─ e2e/
│  ├─ fixtures/
│  └─ helpers/
└─ tools/
   ├─ lib/
   ├─ run-tests.mjs
   ├─ build.mjs
   ├─ write-source.mjs
   ├─ preview.mjs
   └─ check*.mjs
```

## Backblaze B2

```text
Bucket:   shadow-garden-books-01
Endpoint: https://s3.us-east-005.backblazeb2.com
Region:   us-east-005
Proxy:    /media
```

Primary namespaces are under `shadow-garden/books/`, `covers/`, `data/`, `backups/`, and `security/`. The bucket remains private; direct B2 URLs and credentials are not the public delivery mechanism.

## Required Cloudflare secrets

```text
B2_READ_KEY_ID
B2_READ_APPLICATION_KEY
B2_WRITE_KEY_ID
B2_WRITE_APPLICATION_KEY
SG_ADMIN_TOKEN
SG_MEDIA_SIGNING_SECRET
SG_TURNSTILE_SITE_KEY
SG_TURNSTILE_SECRET_KEY
```

Never commit application keys, signing secrets, Turnstile secrets, or `SG_ADMIN_TOKEN`.

## Cloudflare Pages settings

```text
Framework preset:       None
Production branch:      main
Build command:          npm run build
Build output directory: dist
Root directory:         repository root
```

Shadow Garden remains compatible with the free `pages.dev` deployment; a custom domain is not required.

## Development and validation

Use Node.js 22 and the committed lockfile.

```bash
npm ci
npm test
npm run test:unit
npm run test:service
npm run test:dom
npm run test:browser
npm run check
npm run build
npm run test:e2e
npm run preview
```

Pull requests and `main` run both `.github/workflows/verify.yml` and `.github/workflows/e2e.yml`. Verify executes the complete repository/security/deterministic regression suite and production build; Real Browser E2E runs the five-project Playwright matrix against production output. The monthly deterministic Baseline Health run and complete monthly real-browser rerun remain part of the v2.11 maintenance baseline.

For v2 releases, `.github/workflows/release-v2.yml` publishes only after the exact `main` commit has successful Verify **and** Real Browser E2E results, Cloudflare production reports the matching version + commit, and the Main Library, Adult Library, Series, Reader, and robots smoke checks pass.

Optional desktop B2 utilities:

```bash
npm run b2:setup
npm run b2:upload -- "path/to/book.epub"
```

## Documentation

Start with [`docs/README.md`](./docs/README.md). See [`CHANGELOG.md`](./CHANGELOG.md) for formal release history, [`docs/roadmaps/CURRENT_ROADMAP.md`](./docs/roadmaps/CURRENT_ROADMAP.md) for the active v2.11 audit/refactor/optimization roadmap, [`docs/audits/POST_V2_10_AUDIT.md`](./docs/audits/POST_V2_10_AUDIT.md) for findings and measurements, [`docs/archive/README.md`](./docs/archive/README.md) for completed planning history, and [`docs/releases/v2.10.0.md`](./docs/releases/v2.10.0.md) for the latest formal release record.
