# Shadow Garden v1.8

Shadow Garden is a self-hosted EPUB library and browser reader built for Cloudflare Pages. EPUBs, covers, and catalogs live in a **private Backblaze B2 bucket** and are delivered through same-origin Cloudflare Pages Functions. Private administration is handled by the phone-friendly **Garden Keeper** console.

Production: `https://shadowgarden-bon.pages.dev/`

## Current feature set

### Library
- Separate Main and 18+ / Adult archives.
- Dark garden-library interface with a rose/wine Adult palette.
- Recently Added shelf and Continue Reading card.
- Search across series metadata and volume titles.
- Author, year, volume-count, pinned, and exact multi-tag filters.
- URL-persisted filter, sort, and view state with browser Back/Forward restoration.
- Grid and Compact catalog views with incremental rendering.
- Mobile-only collapsible filters while desktop/tablet filters stay expanded.
- Pinned series in the archive cards and navigation sidebar.
- Scope-aware Main/Adult navigation.
- Browser-local reading state; there are no reader accounts.

### EPUB reader
- EPUB.js-based browser reader with **Pages** and **Continuous** modes.
- Canonical device Page Map shared between both reading modes.
- Persistent progress, bookmarks, themes, typeface, font size, line height, and text width.
- First-run Visual Page Cache for standalone covers and illustration pages.
- WebP preparation for compatible visual-only pages with safe fallbacks.
- Dedicated paginated visual-page fitting.
- Single-owner Continuous controller with bounded neighboring spine buffering, idle trimming, location reporting, seek deduplication, and end-of-volume handling.
- Mobile swipe/tap navigation in Pages mode and desktop mouse-wheel page turns.
- Continuous vertical seek rail and page-aware progress display.
- Table of contents, bookmarks, fullscreen/distraction-free reading, and next-volume completion flow.
- Interface themes plus reduced-motion, increased-contrast, forced-colors, and keyboard accessibility support.

### Garden Keeper
- Token-protected administration console at `/admin.html`.
- Manage Library is the permanent post-unlock home.
- New Books, Maintenance, and Series Editor run as focused modal workflows.
- Direct **+ Add book** targeting an exact existing series and shelf.
- Multi-EPUB upload queue with local browser inspection before upload.
- Reader-focused EPUB preflight checks.
- Duplicate detection and **Skip / Replace / Add Separate** policies.
- Stateful upload progress and success/partial-completion screens.
- Multi-series completion chooser with cover cards.
- Metadata editing and Main/18+ shelf movement.
- Cover extraction and WebP derivatives.
- Series-level Audio EPUB link support.
- Maintenance tools for Garden Health, deep B2 checks, legacy-cover optimization, Catalog History, Trash, restore, backup deletion, and protected permanent purge.

The previously planned PWA/offline-books milestone was intentionally scrapped and is not part of Shadow Garden.

## Architecture

```text
GitHub repository
  static source + Pages Functions + non-secret B2 configuration
        |
        v
Cloudflare Pages
  dist/ static library, reader, Garden Keeper
        |
        +--> /media/*
        |      read-only Pages Function
        |          |
        |          v
        |    private Backblaze B2
        |
        +--> /admin-api/*
               SG_ADMIN_TOKEN protected Functions
                    |
                    v
          B2 writes + catalog maintenance
```

Storage configuration has one backend source of truth in `functions/_lib/b2.js`. Public media delivery and all admin routes use the same bucket/endpoint/key conventions.

## Source layout

```text
src/
├─ index.html                 Main archive
├─ nsfw.html                  Adult archive
├─ series.html                Series page
├─ reader.html                EPUB reader shell
├─ admin.html                 Garden Keeper shell
└─ assets/
   ├─ css/
   │  ├─ site.css             Base public UI
   │  ├─ site-current.css     Current public polish layer
   │  ├─ reader*.css          Reader UI/layout modules
   │  ├─ admin*.css           Garden Keeper modules
   │  └─ admin-current.css    Current Keeper workflow polish
   └─ js/
      ├─ library*.js          Archive behavior
      ├─ series*.js           Series behavior
      ├─ reader.js            Reader application
      ├─ reader/              Page Map, storage, theme, TOC
      ├─ reader-continuous-core.js
      ├─ reader-visual-cache.js
      ├─ reader-paginated-visual-fit.js
      ├─ admin*.js            Base Keeper controllers
      ├─ admin-upload-workflow.js
      ├─ admin-upload-completion.js
      ├─ admin-upload-polish.js
      └─ admin-backup-history.js

functions/
├─ _lib/
│  ├─ b2.js
│  └─ garden-maintenance.js
├─ media/[[path]].js
└─ admin-api/*.js

tools/
├─ build.mjs
├─ write-source.mjs
├─ check.mjs
└─ B2 desktop utilities
```

Historical Continuous-mode patch controllers from v1.1-v1.3 are intentionally removed. `reader-continuous-core.js` is the sole Continuous manager owner.

## Backblaze B2

Current non-secret configuration:

```text
Bucket:   shadow-garden-books-01
Endpoint: https://s3.us-east-005.backblazeb2.com
Region:   us-east-005
Proxy:    /media
```

Catalog keys:

```text
shadow-garden/data/catalog.json
shadow-garden/data/adult-catalog.json
```

Maintenance data:

```text
shadow-garden/data/trash.json
shadow-garden/backups/catalog-index.json
shadow-garden/backups/catalogs/*.json
```

Typical object layout:

```text
shadow-garden/
├─ books/<series-id>/*.epub
├─ covers/*
├─ data/
│  ├─ catalog.json
│  ├─ adult-catalog.json
│  └─ trash.json
└─ backups/
   ├─ catalog-index.json
   └─ catalogs/*.json
```

The B2 bucket stays private. Cataloged objects become readable through the same-origin `/media/...` proxy; Backblaze credentials are never exposed to the browser.

## Required Cloudflare secrets

Configure these encrypted Production secrets in the Cloudflare Pages project:

```text
B2_READ_KEY_ID
B2_READ_APPLICATION_KEY
B2_WRITE_KEY_ID
B2_WRITE_APPLICATION_KEY
SG_ADMIN_TOKEN
```

Use separate read and write Backblaze keys where possible, restricted to `shadow-garden-books-01` and optionally the `shadow-garden/` prefix.

Never commit application keys or `SG_ADMIN_TOKEN`.

## Cloudflare Pages settings

```text
Framework preset:       None
Production branch:      main
Build command:          npm run build
Build output directory: dist
Root directory:         repository root
```

`npm run build` automatically runs the repository health check first.

## Development and validation

Requirements:
- Node.js 22 recommended
- npm

Install:

```bash
npm install
```

Run the repository audit without building:

```bash
npm run check
```

The checker currently validates:
- JavaScript/MJS syntax across `src`, `functions`, and `tools`;
- JSON syntax across source/configuration files;
- duplicate static HTML IDs;
- local HTML asset references;
- runtime `/assets/...` references used by JavaScript;
- asset paths declared in `_headers`;
- absence of retired compatibility files that must not return.

Build:

```bash
npm run build
```

Preview the generated `dist/` directory:

```bash
npm run preview
```

Pull requests and `main` also run `.github/workflows/verify.yml`, which executes the same repository check on Node 22.

Optional desktop B2 utilities:

```bash
npm run b2:setup
npm run b2:upload -- "path/to/book.epub"
```

Normal Garden Keeper administration does not require them.

## Browser-local data

Shadow Garden intentionally has no reader accounts. Reading/preferences state is stored locally, including keys such as:

```text
sg-progress:<bookUrl>
sg-reader-settings
sg-bookmarks:<bookUrl>
sg-pinned
sg-adult-ack
sg-view:<library>
sg-filters-collapsed:<library>
sg-reader-polish-settings
```

Clearing site data or changing browser/profile removes that local state.

## Security notes

- B2 stays private and uses separate read/write credentials.
- Garden Keeper mutations require `SG_ADMIN_TOKEN`.
- Admin routes validate managed object keys against the Shadow Garden namespace.
- `/admin.html` is `noindex` and is not linked as a normal public navigation destination.
- The concealed Garden Keeper shortcut is only a convenience; it is not authentication.
- The Adult Library acknowledgement is a client-side gate, not parental control or authentication.

## Release history

See [`CHANGELOG.md`](./CHANGELOG.md).
