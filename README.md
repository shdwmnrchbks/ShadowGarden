# Shadow Garden v0.4

A static EPUB library and browser reader for Cloudflare Pages, with Backblaze B2 as the book-storage backend.

## Architecture

```text
GitHub
  site code + public B2 config only
        |
        v
Cloudflare Pages
  Shadow Garden frontend
        |
        v
Backblaze B2
  EPUBs + extracted covers + catalog JSON
```

No Backblaze secret key is stored in GitHub or Cloudflare. Upload credentials stay only in `.env.b2` on your PC.

## Cloudflare Pages settings

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Production branch: main
```

## One-time Backblaze B2 setup

1. Create or enable a Backblaze B2 account.
2. Create a bucket and make it **Public**.
3. Copy the bucket's S3 endpoint, for example:

```text
https://s3.us-west-004.backblazeb2.com
```

4. Create a scoped **Read and Write** Application Key for only this bucket.
5. Copy `library/b2.example.json` to `library/b2.json` and replace:
   - `bucket`
   - `endpoint`
   - `region`
   - `publicBaseUrl`
6. Copy `.env.b2.example` to `.env.b2` and fill in:

```text
B2_KEY_ID=...
B2_APPLICATION_KEY=...
```

`.env.b2` is gitignored and must never be committed.

7. Install dependencies and configure the bucket for Shadow Garden:

```text
npm install
npm run b2:setup
```

`b2:setup` sets the bucket to `public-read` and configures CORS for the origins listed in `library/b2.json`. If your scoped key cannot alter bucket settings, set the bucket Public in the Backblaze console and configure CORS there instead.

8. Commit `library/b2.json` to GitHub. It contains public endpoint information only, not credentials.

After Cloudflare rebuilds, `/data/source.json` tells Shadow Garden to load its catalogs directly from B2.

## Uploading books

Normal book:

```text
npm run b2:upload -- "D:\Books\My Series - Volume 01.epub"
```

Adult / NSFW book:

```text
npm run b2:upload -- --adult "D:\Books\Adult Series - Volume 01.epub"
```

If the EPUB does not contain useful series metadata, force the series name:

```text
npm run b2:upload -- --series="My Series" "D:\Books\Volume 01.epub"
```

You can upload multiple EPUBs in one command:

```text
npm run b2:upload -- "D:\Books\Volume 01.epub" "D:\Books\Volume 02.epub"
```

The uploader automatically:

1. Opens the EPUB.
2. Reads title, author, language, date, publisher, description, subjects and series metadata.
3. Detects the volume number where possible.
4. Extracts the cover image.
5. Uploads the EPUB to B2.
6. Uploads the extracted cover to B2.
7. Creates or updates the series entry.
8. Rewrites the appropriate B2 catalog (`catalog.json` or `adult-catalog.json`).

Because the browser reads the B2 catalog directly, adding a book does **not** require another GitHub commit or Cloudflare deployment.

## Storage layout in B2

```text
shadow-garden/
├─ books/
│  ├─ series-name/
│  │  └─ volume-01.epub
│  └─ adult-series-name/
├─ covers/
└─ data/
   ├─ catalog.json
   └─ adult-catalog.json
```

## Metadata corrections

Optional series-level corrections still use:

```text
library/series-overrides.json
```

Copy `library/series-overrides.example.json` as a starting point. Overrides are applied when a book is uploaded.

## Reader behavior

The existing browser reader works with the absolute B2 EPUB URLs stored in the catalog. B2 CORS must allow the Shadow Garden site origin so EPUB.js can fetch the remote EPUB package.

Reading progress, bookmarks, pinned series, the Adult Library acknowledgement and reader settings remain in browser `localStorage`.

## Local preview

```text
npm install
npm run build
npm run preview
```

Until `library/b2.json` exists and is enabled, the build automatically falls back to the original local `/data/catalog.json` mode.
