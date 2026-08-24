# Shadow Garden v1.23.0

Shadow Garden is a self-hosted EPUB library and browser Reader built for Cloudflare Pages. EPUBs, covers, catalogs, security state, and maintenance data live in a **private Backblaze B2 bucket** and are delivered or managed through same-origin Cloudflare Pages Functions. Private administration is handled by the **Garden Keeper** console.

Production: `https://shadowgarden-bon.pages.dev/`

## Current feature set

### Library

- Separate Main and 18+ / Adult archives using the same Library controller/model/renderers with explicit scope.
- Recently Added shelf and progress-aware reading banner.
- Search, author/year/volume-count/reading-status/pinned/exact-tag filters, sorting, URL persistence, Back/Forward restoration, and incremental Grid/Compact rendering.
- Canonical browser-local states: **Unread → Read**, **In Progress → Continue**, **Finished → Read Again**.
- Every public volume entry point uses the same state/action pipeline, including Series covers, Series buttons, Recently Added, and the reading banner.
- Read Again confirms the reset, clears Finished + progress, preserves bookmarks, verifies the volume returned to Unread, and then opens page 1.

### EPUB Reader

- EPUB.js-based **Pages** and **Continuous** modes behind one Reader application layer.
- Explicit authorized book-session boundary for opaque public `bk_...` identity and private EPUB source identity.
- Canonical device Page Map shared by both reading modes.
- Persistent progress, bookmarks, Finished state, themes, typography, flow and layout preferences through the shared browser domain layer.
- Visual Page Cache and fitting for standalone covers, maps, and illustration pages.
- Pages-only input owner for horizontal swipe turns and desktop wheel page turns.
- Continuous mode receives no Reader-owned `touchmove` or `touch-action` override, so vertical touch scrolling remains native.
- EPUB images can be tapped/clicked into an isolated focused-image overlay with pinch zoom up to 4× and one-finger pan while magnified.
- Focused-image zoom transforms only the copied image, not the live EPUB viewport, so Page Map, CFI, pagination, Continuous scroll position, and saved progress remain unchanged.
- Focus overlay close/hint chrome fades while magnified and returns at 1×; tap again, Close, or Escape exits image focus.
- Continuous seek rail, TOC, fullscreen, end-of-volume navigation, next-volume completion, and Finished toggle.
- Accessibility support for keyboard navigation, reduced motion, increased contrast, and forced colors.

### Series

- Progress-aware primary CTA and per-volume actions.
- Volume cover and button are rendered from the same canonical action object.
- Finished marks, progress metadata, direct tag navigation, selected series banner artwork, pinning, and Main/Adult navigation.

### Garden Keeper

- Thin R5 application shell with one admin client and explicit Authentication/session, Library/Series, Upload, Maintenance, Catalog History, Trash, Abuse Watch, and version owners.
- Turnstile + Keeper-token protected `/admin.html` and signed server-side sessions for `/admin-api/*`; the browser client opens only after a protected status request verifies both credentials.
- Manage Library, New Books, Maintenance, Series Editor, Catalog History, Trash, Garden Health, and Abuse Watch workflows.
- Multi-EPUB upload/preflight, duplicate policies, metadata/shelf/banner/status editing, Audio EPUB links, opaque random `cv_...` covers, restore/purge, and deployed version/commit information.

### Pages Functions

- Thin route adapters over explicit `auth`, `media`, `catalog`, `storage`, `validation`, `abuse`, `http`, and small `admin` services.
- One B2 transport owner for private object reads/writes, object-key validation, and storage configuration.
- One server catalog owner for Main/Adult persistence, upload mutations, Library/Series edits, banners, backups, Trash, recovery, purge, and Maintenance commits.
- Signed EPUB authorization and HTTP Range delivery remain together in the Media service, while M8 public cooldown enforcement deliberately stays outside `/media/*`.
- Signed EPUB tickets normalize only under `/media/shadow-garden/books/`; R8 added a permanent traversal/namespace regression case.
- Existing `/media/*`, `/book-access`, `/human-access`, `/admin-access`, and `/admin-api/*` URLs and security contracts remain unchanged.

### CSS and design system

- Public Library/Series styling uses semantic `library-features`, `public-components`, `public-artwork`, and `library-layout` owners instead of release-history `current`/version/alignment sheets.
- Reader completion/settings and targeted presentation fixes live in `reader-completion.css` and `reader-presentation.css`; Page Map, Continuous rail, image focus, accessibility, themes, and end-page styles remain feature-owned.
- Garden Keeper runtime styling uses explicit Series Editor, workspace layout, components, version, and banner-presentation owners.
- Main/Adult palettes, Reader Garden/Night/Black/Paper themes, Adult Reader chrome, focus-visible, reduced motion, increased contrast, and forced-colors contracts remain intact.
- Historical public/Reader/runtime-Keeper patch/version CSS files are deleted and guarded from returning. Two R0-frozen Keeper direct paths remain selector-free import aliases until final R10 entrypoint cleanup.

### Test architecture

- Four deterministic layers: `tests/unit/`, `tests/service/`, `tests/dom/`, and `tests/browser/`.
- Node 22's built-in test runner powers all layers; R8 adds no test framework or headless-browser dependency.
- Shared fixtures cover Main/Adult shelves, single/multi-volume series, deliberately long metadata, visual cover/map/illustration XHTML pages, normal chapter XHTML, reading-state variants, and valid/tampered/expired media tickets.
- Priority browser-contract smoke covers **Read → Continue → Finished → Read Again**, bookmark preservation, Adult isolation, Pages vs Continuous input, image-focus isolation, and Garden Keeper composition/unlock boundaries.
- Service tests exercise real media-ticket, Keeper-session, validation, and Garden Health modules offline.
- `npm test` runs all behavioral layers; `npm run check` combines Security Milestones 1–9, R0–R8 guardrails, and the behavioral suite before every production build.

## Security baseline

Security Milestones **1–9 are complete**. The accepted v1.15.14 security baseline remains a permanent refactor contract: private B2 origin storage, signed EPUB tickets, opaque `bk_...` identifiers, Garden Pass/Turnstile, acquisition throttling, crawler screening, Reader anti-indexing, signed Garden Keeper sessions, server-side cooldowns, HMAC-derived abuse controls, private Abuse Watch telemetry, and opaque cover keys.

See [`docs/roadmaps/SECURITY_ROADMAP.md`](./docs/roadmaps/SECURITY_ROADMAP.md).

## Active refactor

The full codebase refactor is incremental: `main` remains deployable, completed security/persistence contracts remain protected by CI, and each milestone replaces duplicate ownership rather than layering another patch.

**R0–R8 are complete. R9 — build and deployment cleanup is next.**

- R2 domain/state contract: [`docs/architecture/DOMAIN_LAYER.md`](./docs/architecture/DOMAIN_LAYER.md)
- R3 Library/Series ownership: [`docs/architecture/PUBLIC_UI_LAYER.md`](./docs/architecture/PUBLIC_UI_LAYER.md)
- R4/R4.1 Reader ownership and stabilization: [`docs/architecture/READER_LAYER.md`](./docs/architecture/READER_LAYER.md)
- R5 Garden Keeper ownership: [`docs/architecture/KEEPER_LAYER.md`](./docs/architecture/KEEPER_LAYER.md)
- R6 Pages Functions service ownership: [`docs/architecture/FUNCTIONS_LAYER.md`](./docs/architecture/FUNCTIONS_LAYER.md)
- R7 CSS/design-system ownership: [`docs/architecture/DESIGN_SYSTEM.md`](./docs/architecture/DESIGN_SYSTEM.md)
- R8 layered tests/fixtures: [`docs/architecture/TEST_ARCHITECTURE.md`](./docs/architecture/TEST_ARCHITECTURE.md)
- Full plan: [`docs/roadmaps/REFACTOR_ROADMAP.md`](./docs/roadmaps/REFACTOR_ROADMAP.md)

### Current architecture

```text
Main / Adult Library                 Series
        |                              |
        v                              v
 library.js                       series.js
      |                               |
      +--> library-model.js           +--> series-renderers.js
      +--> library-renderers.js       |
      |                               |
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

Public CSS
  site + nav + adult/series feature layers
      |
      +--> library-features
      +--> public-components
      +--> public-artwork
      +--> library-layout
      +--> shared reading-status / volume-actions / symbols

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
      +--> Reader-scoped CSS/theme owners

Garden Keeper
      |
      v
admin/core.js + admin/app.js
  ├─ Authentication/session
  ├─ Library/Series
  ├─ Upload workflow internals
  ├─ Maintenance
  ├─ Catalog History
  ├─ Trash & Recovery
  ├─ Abuse Watch
  └─ version + shell UI
      |
      +--> semantic Keeper CSS owners
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
      v
    tests/
  ├─ unit      -> domain/model/input helpers
  ├─ service   -> auth/media/validation services
  ├─ dom       -> renderer contracts
  └─ browser   -> browser-facing smoke flows
      |
      +--> shared deterministic fixtures/helpers
      +--> tools/run-tests.mjs
      +--> tools/check-r8.mjs
```

R4/R4.1 established the Reader application and stabilized real-device input. R5 replaced the Garden Keeper browser patch stack with explicit workflow ownership. R6 made Pages Function routes thin over explicit services. R7 replaced historical CSS override/version ownership with semantic surface owners. R8 adds reusable deterministic behavioral coverage around those owners and caught/tightened the signed-EPUB books-namespace boundary.

## Repository layout

```text
.
├─ README.md
├─ CHANGELOG.md
├─ docs/
│  ├─ architecture/
│  ├─ roadmaps/
│  ├─ security/
│  └─ style/
├─ src/
│  ├─ index.html
│  ├─ nsfw.html
│  ├─ series.html
│  ├─ reader.html
│  ├─ admin.html
│  └─ assets/
│     ├─ css/
│     └─ js/
│        ├─ admin/
│        ├─ domain/
│        ├─ public/
│        └─ reader/
├─ functions/
│  ├─ services/
│  ├─ _lib/
│  ├─ media/[[path]].js
│  ├─ book-access.js
│  ├─ human-access.js
│  ├─ admin-access.js
│  └─ admin-api/*.js
├─ tests/
│  ├─ unit/
│  ├─ service/
│  ├─ dom/
│  ├─ browser/
│  ├─ fixtures/
│  └─ helpers/
└─ tools/
   ├─ run-tests.mjs
   ├─ build.mjs
   ├─ write-source.mjs
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

Use Node.js 22.

```bash
npm install
npm test
npm run test:unit
npm run test:service
npm run test:dom
npm run test:browser
npm run check
npm run build
npm run preview
```

Pull requests and `main` run `.github/workflows/verify.yml`, which executes the complete repository/security/refactor regression suite and a production build before changes are accepted.

Optional desktop B2 utilities:

```bash
npm run b2:setup
npm run b2:upload -- "path/to/book.epub"
```

## Browser-local data

Progress, bookmarks, Finished state, pinned state, Reader settings, Library view/filter preferences, and Adult acknowledgement remain local to the browser/profile. Clearing site data or changing browser/profile removes that state.

## Documentation

Start with [`docs/README.md`](./docs/README.md). See [`CHANGELOG.md`](./CHANGELOG.md) for historical releases.
