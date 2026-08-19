# Shadow Garden v0.4.1

A static EPUB library and browser reader for Cloudflare Pages, with a **private Backblaze B2 bucket** for book storage.

## Architecture

```text
GitHub
  site code + non-secret B2 config
        |
        v
Cloudflare Pages
  static site
        |
        +--> /media/* Pages Function
                    |
                    | AWS SigV4 signed request
                    v
             private Backblaze B2
             EPUBs + covers + catalogs
```

The B2 bucket remains private. Visitors never receive the Backblaze application key and do not access the B2 origin directly.

## Current B2 configuration

```text
Bucket:   shadow-garden-books-01
Endpoint: https://s3.us-east-005.backblazeb2.com
Region:   us-east-005
Proxy:    /media
```

`library/b2.json` contains these non-secret values. It is currently committed with `"enabled": false` so the live site keeps using its local catalog until the Cloudflare secrets and first B2 catalog are ready.

## Cloudflare Pages settings

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Production branch: main
```

Pages Functions are stored in the repository-root `functions/` directory. Only `/media/*` is routed through a Function; normal pages and assets remain static.

## One-time Backblaze setup

Keep the bucket **Private**.

Create a bucket-scoped Backblaze Application Key with enough access to upload and read files in `shadow-garden-books-01`. Save the Key ID and Application Key when Backblaze shows them.

On your Windows PC, clone the repository, then copy:

```text
.env.b2.example
```

to:

```text
.env.b2
```

Fill in:

```text
B2_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_application_key
```

`.env.b2` is gitignored and must never be committed.

Install dependencies and verify the private bucket connection:

```text
npm install
npm run b2:setup
```

`b2:setup` does **not** make the bucket public and does not add public browser CORS rules.

## Cloudflare encrypted secrets

The Pages Function at `/media/*` needs the same Backblaze credentials in Cloudflare.

In Cloudflare:

```text
Workers & Pages
→ shadowgarden-bon
→ Settings
→ Variables and Secrets
```

Add these for Production:

```text
B2_KEY_ID
B2_APPLICATION_KEY
```

Set `B2_APPLICATION_KEY` as an encrypted secret. `B2_KEY_ID` is not itself a password, but storing both in the Variables and Secrets area keeps the configuration together.

Do not put either value in GitHub source files.

## Uploading books

The uploader works even while `library/b2.json` has `"enabled": false`, which lets you populate/test B2 before switching the live catalog.

Normal book:

```text
npm run b2:upload -- "D:\Books\My Series - Volume 01.epub"
```

Adult / NSFW book:

```text
npm run b2:upload -- --adult "D:\Books\Adult Series - Volume 01.epub"
```

If the EPUB does not contain useful series metadata:

```text
npm run b2:upload -- --series="My Series" "D:\Books\Volume 01.epub"
```

Multiple EPUBs can be uploaded in one command:

```text
npm run b2:upload -- "D:\Books\Volume 01.epub" "D:\Books\Volume 02.epub"
```

The uploader automatically:

1. Reads EPUB metadata.
2. Detects series and volume information.
3. Extracts the cover.
4. Uploads the EPUB to the private B2 bucket.
5. Uploads the extracted cover.
6. Creates or updates the appropriate main/adult catalog in B2.
7. Stores same-origin `/media/...` URLs in the catalog.

After B2 is activated, adding a book does **not** require another GitHub commit or Cloudflare rebuild.

## B2 storage layout

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

## Activating B2

Only activate after both conditions are true:

1. `B2_KEY_ID` and `B2_APPLICATION_KEY` exist in the Cloudflare Pages Production environment.
2. At least one run of `npm run b2:upload` has created the B2 catalog files.

Then change:

```json
"enabled": false
```

to:

```json
"enabled": true
```

in `library/b2.json` and deploy `main`.

The build writes `/data/source.json`, and the browser will then load:

```text
/media/shadow-garden/data/catalog.json
/media/shadow-garden/data/adult-catalog.json
```

The same proxy serves covers and EPUB files. Range requests are forwarded for reader/download compatibility.

## Security note

A private B2 bucket protects the Backblaze origin and credentials; it does **not** turn Shadow Garden into an authenticated private website. Anyone who knows a valid public Shadow Garden `/media/...` URL can request it through the Pages Function. The existing 18+ gate is still a client-side acknowledgement rather than access control.

## Metadata corrections

Optional series-level corrections use:

```text
library/series-overrides.json
```

Copy `library/series-overrides.example.json` as a starting point. Overrides are applied when a book is uploaded.

## Reader persistence

Reading progress, bookmarks, pinned series, the Adult Library acknowledgement and reader settings remain in browser `localStorage`.
