# Shadow Garden v1.1

Shadow Garden is a private-storage, public-facing EPUB library and browser reader hosted on Cloudflare Pages. EPUBs and covers live in a **private Backblaze B2 bucket** and are delivered through same-origin Cloudflare Pages Functions. Administration is handled through the phone-friendly **Garden Keeper** console.

Production site: https://shadowgarden-bon.pages.dev/

## What v1.1 includes

### Library
- Main and separate 18+ / Adult libraries.
- Dark Shadow Garden theme with a rose/wine Adult variant.
- Recently Added volume shelf.
- Search across series metadata and volume titles.
- Author, year, volume-count, pinned, and exact multi-tag filtering.
- URL-persisted filter/sort/view state with browser Back/Forward restoration.
- Grid and Compact views.
- Incremental catalog rendering for larger libraries.
- Collapsible filter panel; collapsed mode keeps only search visible.
- Continue Reading and pinned-series persistence in the browser.

### EPUB reader
- EPUB.js-based browser reader.
- Paginated and Continuous reading modes.
- Persistent progress, bookmarks, themes, typeface, font size, line height, and text width.
- Paginated mobile swipe and tap-zone controls.
- Distraction-free reader mode.
- Next-volume completion flow.
- Table of contents and bookmark drawer.
- Continuous-mode vertical progress rail and paginated bottom seek bar.
- Reader accessibility support for keyboard focus, drawer state, live status, reduced motion, increased contrast, and forced-colors environments.

### Garden Keeper
- Token-protected private administration console at `/admin.html`.
- **Manage Library is the permanent home screen** after unlock; the old dashboard has been removed.
- Add New Books and Garden Maintenance open as large modal windows instead of separate pages.
- Every series card includes **+ Add book** beside **Manage series** for direct-to-series uploads.
- Direct-to-series uploads target the exact existing catalog ID and shelf, including renamed series.
- Batch EPUB uploader with sequential phone-friendly processing.
- Browser-local EPUB preflight checks.
- Duplicate detection by hash, filename, volume identity, and title.
- Duplicate policies: **Skip**, **Replace**, or **Add Separate**.
- Metadata editing and Main/18+ shelf management.
- Series-level Audio EPUB link support.
- Cover extraction and WebP derivative generation.
- Garden Maintenance window with:
  - Garden Health diagnostics
  - batched deep B2 object checks
  - legacy-cover optimization
  - automatic catalog snapshots
  - catalog history and rollback
  - soft-delete Trash
  - restore and protected permanent purge

The previously planned PWA / offline-books milestone was intentionally skipped and is not part of Shadow Garden v1.1.

## Architecture

```text
GitHub repository
  site code + non-secret B2 configuration
        |
        v
Cloudflare Pages
  static library / reader / Garden Keeper
        |
        +--> /media/*
        |      read-only Pages Function
        |          |
        |          v
        |   private Backblaze B2
        |
        +--> /admin-api/*
               token-protected Pages Functions
                    |
                    v
          B2 uploads + catalog maintenance
```

The B2 bucket remains private. Backblaze credentials and the Garden Keeper admin token are stored only as encrypted Cloudflare secrets.

## Current B2 configuration

```text
Bucket:   shadow-garden-books-01
Endpoint: https://s3.us-east-005.backblazeb2.com
Region:   us-east-005
Proxy:    /media
```

`library/b2.json` contains only non-secret configuration and currently uses private-B2 mode. The public frontend reads the two catalogs through the same-origin `/media` proxy.

Current catalog keys:

```text
shadow-garden/data/catalog.json
shadow-garden/data/adult-catalog.json
```

## Cloudflare Pages settings

```text
Framework preset:       None
Production branch:      main
Build command:          npm run build
Build output directory: dist
Root directory:         repository root
```

Normal HTML, CSS, JavaScript, and bundled vendor assets are static Pages files. `/media/*` and `/admin-api/*` are handled by Pages Functions.

## Required Cloudflare secrets

In the Cloudflare Pages project, configure these encrypted Production secrets:

```text
B2_READ_KEY_ID
B2_READ_APPLICATION_KEY
B2_WRITE_KEY_ID
B2_WRITE_APPLICATION_KEY
SG_ADMIN_TOKEN
```

Recommended Backblaze application keys:

- `sgdelivery` — Read Only
- `sguploader` — Read and Write

Both may be restricted to `shadow-garden-books-01` and optionally the `shadow-garden/` prefix.

Never commit Backblaze application keys or `SG_ADMIN_TOKEN` to this repository.

## Garden Keeper

Open:

```text
https://shadowgarden-bon.pages.dev/admin.html
```

Garden Keeper is intentionally not linked from the public library and is marked `noindex`. The hidden URL is not considered authentication; access is protected by `SG_ADMIN_TOKEN`.

The token is kept only in the currently open Garden Keeper page and is not written into EPUBs or catalogs.

After unlock, Garden Keeper opens directly to **Manage Library**. The left-side action stack opens **Maintenance** and **+ New Books** in modal windows, while the series list remains visible behind them.

### Add New Books

The uploader can be opened globally with **+ New Books**, or from a series card with **+ Add book**. The per-series action locks the upload session to that exact series and Main/18+ shelf, while still allowing the book-level metadata to be edited.

The uploader can queue multiple EPUBs. For each book it can:

1. inspect the EPUB locally in the browser;
2. extract metadata and cover artwork;
3. run reader-focused preflight checks;
4. detect likely duplicates;
5. upload sequentially to private B2;
6. update the appropriate catalog;
7. generate optimized cover derivatives;
8. snapshot catalogs before mutation.

The web uploader currently enforces a 50 MB EPUB limit.

### Duplicate handling

- **Skip** — leave the existing catalog entry untouched.
- **Replace** — replace the matching existing volume while preserving the logical catalog identity where appropriate.
- **Add Separate** — upload the EPUB as a distinct item even when a likely duplicate is detected.

### Garden Maintenance

Garden Maintenance is the recovery/diagnostics window in Garden Keeper.

- **Garden Health** reports catalog and object-reference issues.
- **Deep B2 Check** verifies referenced EPUB/cover objects in small batches.
- **Optimize Existing Covers** creates current WebP derivatives for older entries.
- **Catalog History** stores versioned snapshots before mutations and allows rollback.
- **Trash** removes entries from the live public catalogs without immediately deleting their B2 files.
- **Restore** returns Trash items to their original shelf when no conflicting active entry exists.
- **Purge** is the explicit permanent-delete action and protects objects still referenced elsewhere.

## B2 storage layout

Current maintenance/catalog keys are organized like this:

```text
shadow-garden/
├─ books/
│  └─ <series-id>/
│     └─ <filename>-<hash>.epub
├─ covers/
├─ data/
│  ├─ catalog.json
│  ├─ adult-catalog.json
│  └─ trash.json
└─ backups/
   ├─ catalog-index.json
   └─ catalogs/
      └─ <timestamp>-<reason>-<id>.json
```

Trash stores catalog payloads and keeps the referenced EPUB/cover objects in place until an explicit purge. Backup filenames are generated by the maintenance backend and the newest 30 snapshots are retained.

## Browser-local data

Shadow Garden intentionally has no user accounts. These values stay in browser `localStorage`:

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

Changing browser/profile or clearing site data removes that local reading state.

## Security model

- Backblaze B2 remains private.
- Read and write B2 credentials are separate.
- B2 credentials are never sent to the public browser.
- Garden Keeper mutations require `SG_ADMIN_TOKEN`.
- Admin mutation routes restrict managed objects to the Shadow Garden namespace.
- Public `/media/...` URLs intentionally make cataloged books readable through Shadow Garden while keeping B2 origin credentials private.
- The Adult Library gate is a client-side acknowledgement, not authentication or parental control.

## Development

Requirements:

- Node.js
- npm

Install and build:

```bash
npm install
npm run build
```

Local static preview:

```bash
npm run preview
```

The generated Pages output is written to `dist/`.

Optional desktop B2 utilities remain available:

```bash
npm run b2:setup
npm run b2:upload -- "path/to/book.epub"
```

They are not required for normal phone-based administration.

## Release history

See [`CHANGELOG.md`](./CHANGELOG.md).
