# Shadow Garden v2.6.3

Shadow Garden is a self-hosted EPUB library and browser Reader built for Cloudflare Pages. EPUBs, covers, catalogs, security state, and maintenance data live in a **private Backblaze B2 bucket** and are delivered or managed through same-origin Cloudflare Pages Functions. Private administration is handled by the **Garden Keeper** console.

Production: `https://shadowgarden-bon.pages.dev/`

The accepted architecture baseline remains v2.0.0. The current product release is **v2.6.3 — Continuous Media Containment Hardening**, the follow-up patch to the v2.6.1/v2.6.2 hotfixes on the v2.6 Reliability & Real-Browser Testing baseline. It closes the remaining Continuous artwork right-edge clipping from publication min-width rules, absolute/fixed media positioning, and rightward transforms reported in reopened issue #160, without changing the established security or browser-local reading-data boundaries.

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
- Manage Library, New Books, Maintenance, Series Editor, translation metadata, Catalog History, Trash, Garden Health, and Abuse Watch workflows.
- Multi-EPUB upload/preflight, duplicate policies, metadata/shelf/banner/status editing, Audio EPUB links, opaque random `cv_...` covers, restore/purge, and deployed version/commit information.
- Busy-state guards prevent duplicate Series, translation, upload, History, Trash, and Abuse mutations while requests are pending.
- Native dialogs are keyboard-contained and restore focus after dismissal, including after manager rerenders replace the original opener node.

### Pages Functions

- Thin route adapters over explicit `auth`, `media`, `catalog`, `storage`, `validation`, `abuse`, `http`, and small `admin` services.
- One B2 transport owner for private object reads/writes, object-key validation, and storage configuration.
- One server catalog owner for Main/Adult persistence, upload mutations, Library/Series edits, banners, backups, Trash, recovery, purge, and Maintenance commits.
- Signed EPUB authorization and HTTP Range delivery remain together in the Media service, while public cooldown enforcement deliberately stays outside `/media/*`.
- Signed EPUB tickets normalize only under `/media/shadow-garden/books/`.
- Existing `/media/*`, `/book-access`, `/human-access`, `/admin-access`, and `/admin-api/*` URLs and security contracts remain unchanged.

### Accessibility and motion

- Keyboard focus treatment, drawer/dialog focus restoration, reduced motion, increased contrast, forced colors, and visible focus are permanent application contracts.
- v2.6 adds bounded automated accessibility checks for Library, Series, Reader chrome, and Garden Keeper, plus 200%/400% equivalent reflow checks and mobile touch-target verification.
- Browser zoom is not disabled by the Reader viewport.
- Publication-owned EPUB accessibility is tested/documented separately from Shadow Garden-owned application chrome. See [`docs/architecture/ACCESSIBILITY_TESTING.md`](./docs/architecture/ACCESSIBILITY_TESTING.md).
- v2.5 motion remains progressive enhancement and observer-only: application state, requests, reading state, persistence, and navigation retain their canonical owners.

## Test architecture

Shadow Garden now has complementary deterministic and real-browser layers.

### Deterministic layers

- `tests/unit/` — domain/model/input helpers.
- `tests/service/` — auth, media, validation, catalog/administrative service boundaries.
- `tests/dom/` — renderer ownership against narrow DOM doubles.
- `tests/browser/` — deterministic browser-facing source/interaction contracts and fixtures.

These use Node 22's built-in test runner and remain fast/offline. `npm test` runs the complete deterministic behavioral suite.

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
- Reader Pages/Continuous startup, persistence, controls, TOC, keyboard, wheel/swipe policy, flow switching, image focus, resize, resume/ticket renewal, fullscreen, and EPUB resilience;
- Garden Keeper authentication, dialogs, Series/translation editing, upload, Maintenance, History, Trash, and Abuse Watch;
- accessibility scans, keyboard/focus restoration, zoom/reflow, contrast/forced-colors/reduced-motion, and mobile targets.

WebKit limitations are represented honestly: where Playwright cannot generate a trusted cross-frame gesture, the suite combines live canonical navigation acceptance with source-level ownership contracts rather than treating synthetic events as trusted browser input.

Failure runs retain Playwright traces, screenshots, video, HTML reports, and browser diagnostics.

See [`docs/architecture/TEST_ARCHITECTURE.md`](./docs/architecture/TEST_ARCHITECTURE.md).

## Security baseline

Security Milestones **1–9 are complete** and remain permanent contracts: private B2 origin storage, signed EPUB tickets, opaque `bk_...` identifiers, Garden Pass/Turnstile, acquisition throttling, crawler screening, Reader anti-indexing, signed Garden Keeper sessions, server-side cooldowns, HMAC-derived abuse controls, private Abuse Watch telemetry, and opaque cover keys.

Browser-local progress, bookmarks, Finished state, pinned state, Reader settings, Library preferences, and Adult acknowledgement remain local to the browser/profile. v2.6 requires no reading-data migration and introduces no server-side Reader account/history.

See [`docs/roadmaps/SECURITY_ROADMAP.md`](./docs/roadmaps/SECURITY_ROADMAP.md).

## v2 architecture baseline

The R0–R10 full-codebase refactor is complete. `main` remains deployable, Security Milestones 1–9 and browser-local persistence contracts remain protected by CI, and the v2 source tree has explicit owners instead of accumulated patch layers.

**R0–R10 are complete. Shadow Garden v2.0.0 remains the accepted architecture baseline; v2.6.3 is the current release baseline.**

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
- v2.5 motion contract: [`docs/architecture/MOTION_SYSTEM.md`](./docs/architecture/MOTION_SYSTEM.md)
- v2.6 accessibility contract: [`docs/architecture/ACCESSIBILITY_TESTING.md`](./docs/architecture/ACCESSIBILITY_TESTING.md)
- Current roadmap: [`docs/roadmaps/CURRENT_ROADMAP.md`](./docs/roadmaps/CURRENT_ROADMAP.md)
- v2.6.0 release notes: [`docs/releases/v2.6.0.md`](./docs/releases/v2.6.0.md)
- v2.6.1 hotfix notes: [`docs/releases/v2.6.1.md`](./docs/releases/v2.6.1.md)
- v2.6.2 hotfix notes: [`docs/releases/v2.6.2.md`](./docs/releases/v2.6.2.md)
- v2.6.3 hotfix notes: [`docs/releases/v2.6.3.md`](./docs/releases/v2.6.3.md)

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

Pull requests and `main` run both `.github/workflows/verify.yml` and `.github/workflows/e2e.yml`. Verify executes the complete repository/security/deterministic regression suite and production build; Real Browser E2E runs the five-project Playwright matrix against production output.

For v2 releases, `.github/workflows/release-v2.yml` publishes only after the exact `main` commit has successful Verify **and** Real Browser E2E results, Cloudflare production reports the matching version + commit, and the Main Library, Adult Library, Series, Reader, and robots smoke checks pass.

Optional desktop B2 utilities:

```bash
npm run b2:setup
npm run b2:upload -- "path/to/book.epub"
```

## Documentation

Start with [`docs/README.md`](./docs/README.md). See [`CHANGELOG.md`](./CHANGELOG.md) for release history, [`docs/releases/v2.6.0.md`](./docs/releases/v2.6.0.md) for the v2.6 reliability baseline, and [`docs/releases/v2.6.3.md`](./docs/releases/v2.6.3.md) for the current hotfix record.
