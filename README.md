# Shadow Garden v1.18.0

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
- One gesture controller for swipe paging, desktop wheel turns, pinch zoom, one-finger pan while zoomed, double-tap zoom/reset, Ctrl/Cmd-wheel zoom, and keyboard/settings zoom controls.
- Ordinary content zooms to 3×; synthetic Visual Page Cache pages can zoom to 4×.
- Zoom is a session-only visual viewport transform and does **not** change typography, EPUB pagination, Page Map geometry, or saved reading position.
- Continuous seek rail, TOC, fullscreen, end-of-volume navigation, next-volume completion, and Finished toggle.
- Accessibility support for keyboard navigation, reduced motion, increased contrast, and forced colors.

### Series

- Progress-aware primary CTA and per-volume actions.
- Volume cover and button are rendered from the same canonical action object.
- Finished marks, progress metadata, direct tag navigation, selected series banner artwork, pinning, and Main/Adult navigation.

### Garden Keeper

- Turnstile + Keeper-token protected `/admin.html` and signed server-side sessions for `/admin-api/*`.
- Manage Library, New Books, Maintenance, Series Editor, Catalog History, Trash, Garden Health, and Abuse Watch workflows.
- Multi-EPUB upload/preflight, duplicate policies, metadata/shelf/banner/status editing, Audio EPUB links, opaque random `cv_...` covers, restore/purge, and deployed version/commit information.

## Security baseline

Security Milestones **1–9 are complete**. The accepted v1.15.14 security baseline remains a permanent refactor contract: private B2 origin storage, signed EPUB tickets, opaque `bk_...` identifiers, Garden Pass/Turnstile, acquisition throttling, crawler screening, Reader anti-indexing, signed Garden Keeper sessions, server-side cooldowns, HMAC-derived abuse controls, private Abuse Watch telemetry, and opaque cover keys.

See [`docs/roadmaps/SECURITY_ROADMAP.md`](./docs/roadmaps/SECURITY_ROADMAP.md).

## Active refactor

The full codebase refactor is incremental: `main` remains deployable, completed security/persistence contracts remain protected by CI, and each milestone replaces duplicate ownership rather than layering another patch.

**R0–R4 are complete. R5 — Garden Keeper decomposition is next.**

- R2 domain/state contract: [`docs/architecture/DOMAIN_LAYER.md`](./docs/architecture/DOMAIN_LAYER.md)
- R3 Library/Series ownership: [`docs/architecture/PUBLIC_UI_LAYER.md`](./docs/architecture/PUBLIC_UI_LAYER.md)
- R4 Reader ownership and zoom: [`docs/architecture/READER_LAYER.md`](./docs/architecture/READER_LAYER.md)
- Full plan: [`docs/roadmaps/REFACTOR_ROADMAP.md`](./docs/roadmaps/REFACTOR_ROADMAP.md)

### Current browser architecture

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
  ├─ gestures/zoom
  └─ Page Map + retained EPUB.js compatibility layers
      |
      +--> shared domain/state
      +--> signed /media/* source

Garden Keeper
  -> /admin-access + /admin-api/* -> private B2
```

R4 retired the old Reader monolith/polish ownership scripts and removed the temporary URLSearchParams/private-source interception. Reader CSS consolidation is intentionally deferred to R7 so Reader behavioral architecture and design-system cleanup remain separate risk domains.

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
│  └─ assets/js/
│     ├─ domain/
│     ├─ public/
│     └─ reader/
├─ functions/
│  ├─ _lib/
│  ├─ media/[[path]].js
│  ├─ book-access.js
│  ├─ human-access.js
│  ├─ admin-access.js
│  └─ admin-api/*.js
└─ tools/
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
TURNSTILE_SECRET_KEY
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
