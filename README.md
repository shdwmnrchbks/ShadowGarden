# Shadow Garden v0.5

A static EPUB library and browser reader for Cloudflare Pages, using a **private Backblaze B2 bucket** for book storage and a phone-friendly private upload console.

## Architecture

```text
GitHub
  site code + non-secret B2 config
        |
        v
Cloudflare Pages
  static library + reader + /admin.html
        |
        +--> /media/*       read-only Pages Function
        |        |
        |        v
        |   private Backblaze B2
        |
        +--> /admin-api/*   token-protected Pages Functions
                 |
                 v
            private B2 uploads + catalog updates
```

The B2 bucket remains private. Backblaze credentials are stored only as encrypted Cloudflare secrets.

## Current B2 configuration

```text
Bucket:   shadow-garden-books-01
Endpoint: https://s3.us-east-005.backblazeb2.com
Region:   us-east-005
Proxy:    /media
```

`library/b2.json` contains only these non-secret values. It stays `"enabled": false` until the first remote catalog has been created and the Cloudflare secrets are configured.

## Cloudflare Pages settings

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Production branch: main
```

Only `/media/*` and `/admin-api/*` invoke Pages Functions. The normal library, reader UI, CSS, JS and images remain static requests.

## Required Backblaze keys

Keep `shadow-garden-books-01` **Private**.

Create two application keys scoped to this bucket and optionally to the `shadow-garden/` prefix:

1. `sgdelivery` — **Read Only**.
2. `sguploader` — **Read and Write**.

Do not commit either key to GitHub.

## Cloudflare secrets

In Cloudflare:

```text
Workers & Pages
→ shadowgarden-bon
→ Settings
→ Variables and Secrets
```

Add these Production secrets:

```text
B2_READ_KEY_ID              = sgdelivery keyID
B2_READ_APPLICATION_KEY     = sgdelivery applicationKey
B2_WRITE_KEY_ID             = sguploader keyID
B2_WRITE_APPLICATION_KEY    = sguploader applicationKey
SG_ADMIN_TOKEN              = a long private token/password you choose
```

Encrypt all five values. `SG_ADMIN_TOKEN` is the password for the mobile Garden Keeper page and should not be reused anywhere else.

Redeploy the Pages project after setting or changing secrets.

## Phone-only upload workflow

Open:

```text
https://shadowgarden-bon.pages.dev/admin.html
```

The admin page is intentionally not linked from the public library and is marked `noindex`. Security comes from `SG_ADMIN_TOKEN`; the hidden URL by itself is not treated as authentication.

On the phone:

1. Enter `SG_ADMIN_TOKEN` and unlock Garden Keeper.
2. Choose an EPUB from phone storage.
3. The browser opens the EPUB locally with JSZip and extracts metadata and its cover before uploading.
4. Review/edit series, volume number, title, author, year, tags and description.
5. Toggle **18+ / Adult Library** when appropriate.
6. Tap **Upload EPUB to Shadow Garden**.

The upload workflow then:

1. Sends the EPUB through the authenticated Cloudflare upload API.
2. Stores it in private B2 under `shadow-garden/books/`.
3. Uploads the extracted cover under `shadow-garden/covers/`.
4. Reads and updates the appropriate B2 catalog.
5. Ensures both main and adult catalog files exist.
6. Stores same-origin `/media/...` URLs rather than exposing B2 origin URLs.

The mobile uploader enforces a 50 MB file limit. This is below Cloudflare Free's current request-body limit and comfortably above the project's normal EPUB sizes.

The admin token is held only in `sessionStorage`, so it is discarded when that browser tab/session ends.

## Activating B2 for readers

Activate only after:

1. all five Cloudflare secrets above exist;
2. Garden Keeper successfully uploads at least one EPUB and creates the B2 catalog files.

Then change in `library/b2.json`:

```json
"enabled": false
```

to:

```json
"enabled": true
```

After Cloudflare redeploys, Shadow Garden loads:

```text
/media/shadow-garden/data/catalog.json
/media/shadow-garden/data/adult-catalog.json
```

Covers and EPUBs are served through the same read-only private-B2 proxy. Range requests are forwarded for EPUB.js/read/download compatibility.

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

## Optional desktop CLI

The older local uploader remains available for anyone who later wants to use a desktop:

```text
npm run b2:setup
npm run b2:upload -- "D:\Books\Volume 01.epub"
```

It is no longer required for normal administration.

## Security notes

- The B2 bucket is private.
- `sgdelivery` is read-only.
- `sguploader` is used only by token-protected admin API routes.
- No Backblaze key is sent to the browser.
- `/admin.html` has `noindex` headers/meta and is not linked publicly.
- The browser sends `SG_ADMIN_TOKEN` only over HTTPS as an Authorization header.
- The main site remains public; private B2 storage protects the origin and credentials, not the public availability of valid `/media/...` URLs.
- The existing 18+ gate remains a client-side acknowledgement, not user authentication.

## Reader persistence

Reading progress, bookmarks, pinned series, the Adult Library acknowledgement and reader settings remain in browser `localStorage`.
