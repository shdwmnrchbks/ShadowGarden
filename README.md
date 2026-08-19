# Shadow Garden v0.3

A static EPUB library and browser reader designed for Cloudflare Pages.

## What changed in v0.3

- LNORI-inspired archive browsing structure.
- Search across series, author, description, tags and volume titles.
- Genre, year and sort filters.
- Grid and compact views.
- Series pages with volume shelves.
- Built-in EPUB.js reader.
- Table of contents.
- Reader bookmarks.
- Local reading progress.
- Continue Reading panel.
- Reader themes, typefaces, font size, line height, text width and page/scroll flow.
- Local "Pin to Garden" favorites.
- Automatic EPUB metadata and cover extraction at build time.
- No account system and no database.
- Separate Adult / NSFW Library with a local content warning.
- NSFW books never appear in the main catalog or its Continue Reading panel.
- Automatic NSFW classification from the `library/NSFW/` folder.
- Separate generated catalogs: the main page never loads the Adult Library metadata file.

## Cloudflare Pages settings

After uploading this version to GitHub, change the Pages build configuration to:

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
```

Keep the production branch as `main`.

## Adding EPUBs

Put ordinary EPUBs directly under the `library` folder, grouped by series:

```text
library/
└─ My Series/
   ├─ Volume 01.epub
   ├─ Volume 02.epub
   └─ Volume 03.epub
```

Put adult/NSFW series under `library/NSFW/`:

```text
library/
└─ NSFW/
   └─ Adult Series/
      ├─ Volume 01.epub
      └─ Volume 02.epub
```

The build automatically sets `nsfw: true` for any EPUB found under an `NSFW` folder and excludes it from the normal library.

Commit and push.

Cloudflare will run the build script. The script:

1. Opens every EPUB.
2. Reads the OPF metadata.
3. Detects series/author/title/date/language/tags.
4. Extracts the cover.
5. Groups volumes into series.
6. Copies the EPUBs into the published `/books/` tree.
7. Generates `/data/catalog.json` for the main library and `/data/adult-catalog.json` for the Adult Library.
8. Deploys the finished site.

You do not edit either generated catalog manually.

> The Adult Library warning is a client-side content gate, not authentication or true access control. Because this is a public static site, anyone who already knows a direct EPUB URL can still request that file.

## Correcting metadata

Copy:

```text
library/series-overrides.example.json
```

to:

```text
library/series-overrides.json
```

Then add only the fields you want to override. You can also use `"nsfw": true` or `"nsfw": false` to explicitly classify a series.

## Local test

Install Node.js, then from the project folder run:

```text
npm install
npm run build
npm run preview
```

Open the local URL shown in the console.

## Reader persistence

Reading progress, bookmarks, pinned series, the Adult Library acknowledgement, and reader preferences use browser `localStorage`.
There is no user account and no remote reading-history database.
