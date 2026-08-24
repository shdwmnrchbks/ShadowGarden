# Shadow Garden v1.16.0

Shadow Garden is a self-hosted EPUB library and browser reader built for Cloudflare Pages. EPUBs, covers, catalogs, security state, and maintenance data live in a **private Backblaze B2 bucket** and are delivered or managed through same-origin Cloudflare Pages Functions. Private administration is handled by the **Garden Keeper** console.

Production: `https://shadowgarden-bon.pages.dev/`

## Current feature set

### Library

- Separate Main and 18+ / Adult archives.
- Dark moonlit garden-library interface with a distinct Adult palette.
- Recently Added shelf plus progress-aware Read/Continue banner.
- Search across series metadata and volume titles.
- Author, year, volume-count, reading-status, pinned, and exact multi-tag filters.
- URL-persisted filters, sort, and view state with browser Back/Forward restoration.
- Grid and Compact views with incremental rendering.
- Browser-local reading state; there are no reader accounts.
- Canonical volume states:
  - **Unread** → Read
  - **In Progress** → Continue
  - **Finished** → Read Again

### EPUB Reader

- EPUB.js-based Reader with **Pages** and **Continuous** modes.
- Canonical device Page Map shared between both reading modes.
- Persistent progress, bookmarks, themes, typography, and layout preferences.
- Visual Page Cache and fitting for standalone covers/illustration pages.
- Mobile swipe/tap navigation in Pages mode and desktop mouse-wheel page turns.
- Continuous vertical seek rail and page-aware progress display.
- Table of contents, bookmarks, fullscreen, end-of-volume navigation, and next-volume flow.
- Finished toggle on the volume end page.
- Read Again confirmation clears progress + Finished state, preserves bookmarks, and returns to page 1.
- Accessibility support for keyboard navigation, reduced motion, increased contrast, and forced colors.

### Garden Keeper

- Turnstile + Keeper-token protected administration console at `/admin.html`.
- Signed server-side admin sessions for `/admin-api/*`.
- Manage Library, New Books, Maintenance, Series Editor, and Abuse Watch workflows.
- Multi-EPUB upload queue with local browser inspection and Reader-focused preflight checks.
- Duplicate detection with Skip / Replace / Add Separate policies.
- Metadata editing, shelf movement, series status/banner management, and Audio EPUB links.
- Opaque random `cv_...` cover object names for new uploads.
- Catalog History, Garden Health/deep B2 checks, cover optimization, Trash, restore, backup deletion, and protected permanent purge.
- Centered deployed-version/commit information in the Keeper footer.

## Security baseline

Security Milestones **1–9 are complete** as of 2026-08-24. The accepted v1.15.14 security baseline remains intact in v1.16.0 and includes:

- private B2 origin storage;
- signed EPUB access tickets;
- opaque public `bk_...` book IDs;
- Turnstile-backed Garden Pass sessions;
- bulk-acquisition throttling;
- crawler/script screening on protected acquisition endpoints;
- Reader anti-indexing policy;
- signed Garden Keeper sessions and server-side cross-session cooldowns;
- HMAC-derived abuse tripwires and private Abuse Watch telemetry;
- opaque new cover identifiers;
- final Reader/Library/Garden Keeper regression audit.

The complete record is in [`docs/roadmaps/SECURITY_ROADMAP.md`](./docs/roadmaps/SECURITY_ROADMAP.md).

## Active refactor

The full codebase refactor is intentionally incremental: `main` remains deployable, Reader behavior stays stable, and the completed security baseline is treated as a contract.

**R0–R2 are complete. R3 — Library + Series decomposition is next.**

See [`docs/roadmaps/REFACTOR_ROADMAP.md`](./docs/roadmaps/REFACTOR_ROADMAP.md).

### Shared browser domain layer

v1.16.0 introduces `src/assets/js/domain/` as the canonical browser state/domain boundary:

```text
Library / Series / Reader
        |
        v
domain/
├─ catalog.js
├─ book-identity.js
├─ reading-state.js
├─ progress.js
├─ bookmarks.js
├─ preferences.js
├─ storage.js
├─ urls.js
└─ format.js
```

Library, Series, Reader progress/bookmark storage, pinned/view state, and Read Again now consume these shared services rather than independently interpreting the same localStorage keys. Existing persisted browser data formats are preserved.

See [`docs/architecture/DOMAIN_LAYER.md`](./docs/architecture/DOMAIN_LAYER.md).

## Architecture

```text
Browser UI
  Library / Series / Reader
        |
        +--> shared browser domain/state layer
        |      local progress, bookmarks, preferences
        |
        +--> /book-access + /human-access
        |      acquisition / Garden Pass boundary
        |
        +--> /media/*
               signed EPUB/media proxy
                    |
                    v
             private Backblaze B2

Garden Keeper
        |
        +--> /admin-access
        |      Keeper Gate
        |
        +--> /admin-api/*
               token + signed admin session
                    |
                    v
             private Backblaze B2
```

Storage configuration has one backend source of truth in `functions/_lib/b2.js`. Public media delivery and admin routes use the same bucket/endpoint/key conventions while preserving separate read/write credentials.

## Repository layout

```text
.
├─ README.md
├─ CHANGELOG.md
├─ docs/
│  ├─ README.md
│  ├─ architecture/
│  │  ├─ DOMAIN_LAYER.md
│  │  └─ refactor contracts
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
│     └─ existing page/Reader/Keeper modules
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

The v1.x source still contains several grandfathered `*-polish`, compatibility, and version-specific override modules. Removing those safely is a primary goal of R3–R7 rather than something to hide in the current layout documentation.

## Backblaze B2

Current non-secret configuration:

```text
Bucket:   shadow-garden-books-01
Endpoint: https://s3.us-east-005.backblazeb2.com
Region:   us-east-005
Proxy:    /media
```

Primary data namespaces include:

```text
shadow-garden/books/
shadow-garden/covers/
shadow-garden/data/
shadow-garden/backups/
shadow-garden/security/
```

The B2 bucket stays private. Backblaze credentials and direct private EPUB delivery URLs are never exposed as the normal public delivery mechanism.

## Required Cloudflare secrets

Configure these encrypted Production secrets in the Cloudflare Pages project:

```text
B2_READ_KEY_ID
B2_READ_APPLICATION_KEY
B2_WRITE_KEY_ID
B2_WRITE_APPLICATION_KEY
SG_ADMIN_TOKEN
SG_MEDIA_SIGNING_SECRET
TURNSTILE_SECRET_KEY
```

Use separate read and write Backblaze keys where possible and restrict them to the Shadow Garden bucket/prefix.

Never commit application keys, signing secrets, Turnstile secrets, or `SG_ADMIN_TOKEN`.

## Cloudflare Pages settings

```text
Framework preset:       None
Production branch:      main
Build command:          npm run build
Build output directory: dist
Root directory:         repository root
```

Shadow Garden intentionally remains compatible with the free `pages.dev` deployment. A custom domain is not required.

## Development and validation

Requirements:

- Node.js 22 recommended
- npm

Install:

```bash
npm install
```

Run the complete repository/security/refactor regression suite:

```bash
npm run check
```

Build:

```bash
npm run build
```

Preview the generated `dist/` directory:

```bash
npm run preview
```

Pull requests and `main` run `.github/workflows/verify.yml`, which executes repository checks and a production build on Node 22 before changes are accepted.

Optional desktop B2 utilities:

```bash
npm run b2:setup
npm run b2:upload -- "path/to/book.epub"
```

Normal Garden Keeper administration does not require the desktop utilities.

## Browser-local data

Shadow Garden intentionally has no Reader accounts. Progress, bookmarks, Finished state, pinned state, Reader settings, Library view/filter preferences, and Adult acknowledgement remain local to the browser/profile.

R2 centralizes the code that owns these values without moving them to a server. Clearing site data or changing browser/profile removes that local reading/preference state.

## Documentation

Start with [`docs/README.md`](./docs/README.md).

- Shared browser domain: [`docs/architecture/DOMAIN_LAYER.md`](./docs/architecture/DOMAIN_LAYER.md)
- Active refactor plan: [`docs/roadmaps/REFACTOR_ROADMAP.md`](./docs/roadmaps/REFACTOR_ROADMAP.md)
- Completed security plan: [`docs/roadmaps/SECURITY_ROADMAP.md`](./docs/roadmaps/SECURITY_ROADMAP.md)
- Final security audit: [`docs/security/MILESTONE_9_FINAL_AUDIT.md`](./docs/security/MILESTONE_9_FINAL_AUDIT.md)
- Site copy/tone rules: [`docs/style/SITE_VOICE.md`](./docs/style/SITE_VOICE.md)

## Release history

See [`CHANGELOG.md`](./CHANGELOG.md).
