# Shadow Garden v1.17.0

Shadow Garden is a self-hosted EPUB library and browser reader built for Cloudflare Pages. EPUBs, covers, catalogs, security state, and maintenance data live in a **private Backblaze B2 bucket** and are delivered or managed through same-origin Cloudflare Pages Functions. Private administration is handled by the **Garden Keeper** console.

Production: `https://shadowgarden-bon.pages.dev/`

## Current feature set

### Library

- Separate Main and 18+ / Adult archives using the same Library controller/model/renderers with an explicit scope.
- Recently Added shelf and progress-aware reading banner.
- Search, author/year/volume-count/reading-status/pinned/exact-tag filters, sorting, URL persistence, Back/Forward restoration, and incremental Grid/Compact rendering.
- Canonical browser-local volume states:
  - **Unread** → Read
  - **In Progress** → Continue
  - **Finished** → Read Again
- Recently Added and the reading banner use the same volume-action pipeline as Series, so Finished shortcuts cannot silently bypass Read Again confirmation.
- No Reader accounts; reading state remains local to the browser/profile.

### Series

- Progress-aware primary CTA and per-volume actions.
- Volume cover and action button are rendered from the same state/action object.
- Finished marks, progress metadata, direct tag navigation, selected series banner artwork, pinning, and Main/Adult navigation.
- Read Again confirms the reset, clears Finished + progress, preserves bookmarks, verifies the volume returned to Unread, and then opens page 1.

### EPUB Reader

- EPUB.js-based **Pages** and **Continuous** modes.
- Canonical device Page Map shared by both modes.
- Persistent progress, bookmarks, themes, typography, and layout preferences.
- Visual Page Cache and fitting for standalone covers/illustrations.
- Mobile swipe/tap navigation, desktop wheel page turns, Continuous seek rail, TOC, fullscreen, end-of-volume navigation, and next-volume flow.
- Finished toggle on the end page.
- Accessibility support for keyboard navigation, reduced motion, increased contrast, and forced colors.

### Garden Keeper

- Turnstile + Keeper-token protected `/admin.html` and signed server-side sessions for `/admin-api/*`.
- Manage Library, New Books, Maintenance, Series Editor, Catalog History, Trash, Garden Health, and Abuse Watch workflows.
- Multi-EPUB upload/preflight, duplicate policies, metadata/shelf/banner/status editing, Audio EPUB links, opaque random `cv_...` covers, restore/purge, and deployed version/commit information.

## Security baseline

Security Milestones **1–9 are complete**. The accepted v1.15.14 security baseline remains a permanent refactor contract and includes private B2 origin storage, signed EPUB tickets, opaque `bk_...` identifiers, Garden Pass/Turnstile, acquisition throttling, crawler screening, Reader anti-indexing, signed Garden Keeper sessions, server-side cooldowns, HMAC-derived abuse controls, private Abuse Watch telemetry, and opaque cover keys.

See [`docs/roadmaps/SECURITY_ROADMAP.md`](./docs/roadmaps/SECURITY_ROADMAP.md).

## Active refactor

The full codebase refactor is incremental: `main` remains deployable, Reader behavior stays stable, and completed security/persistence contracts remain protected by CI.

**R0–R3 are complete. R4 — Reader architecture refactor is next.**

- R2 domain/state contract: [`docs/architecture/DOMAIN_LAYER.md`](./docs/architecture/DOMAIN_LAYER.md)
- R3 Library/Series ownership: [`docs/architecture/PUBLIC_UI_LAYER.md`](./docs/architecture/PUBLIC_UI_LAYER.md)
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
                  |
                  v
        browser-local persistence

Reader
  -> R2 domain/state + protected book-access/media boundary

Garden Keeper
  -> /admin-access + /admin-api/* -> private B2
```

R3 removed the public `library-series-polish.js`, `library-finished-polish.js`, `series-read-again.js`, and `series-cover-links.js` repair layers. Owned Library/Series DOM is now rendered directly instead of corrected afterward with MutationObservers.

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
│     └─ page/Reader/Keeper modules
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

Remaining grandfathered Reader/Keeper/CSS patch layers are intentionally removed only in their owning milestones.

## Backblaze B2

```text
Bucket:   shadow-garden-books-01
Endpoint: https://s3.us-east-005.backblazeb2.com
Region:   us-east-005
Proxy:    /media
```

Primary namespaces: `shadow-garden/books/`, `covers/`, `data/`, `backups/`, and `security/`. The bucket remains private; direct B2 URLs and credentials are not the public delivery mechanism.

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

Pull requests and `main` run `.github/workflows/verify.yml`, which executes the full repository/security/refactor checks and a production build before changes are accepted.

Optional desktop B2 utilities:

```bash
npm run b2:setup
npm run b2:upload -- "path/to/book.epub"
```

## Browser-local data

Progress, bookmarks, Finished state, pinned state, Reader settings, Library view/filter preferences, and Adult acknowledgement remain local to the browser/profile. Clearing site data or changing browser/profile removes that state.

## Documentation

Start with [`docs/README.md`](./docs/README.md). See [`CHANGELOG.md`](./CHANGELOG.md) for historical releases.
