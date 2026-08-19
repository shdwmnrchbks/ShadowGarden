# Shadow Garden v0.1

A dark garden-inspired static EPUB library for Cloudflare Pages.

## Upload to GitHub

Upload the **contents of this folder** to the root of the GitHub repository connected to your Cloudflare Pages project.

The repository should look like:

```text
/
├─ index.html
├─ 404.html
├─ _headers
├─ assets/
├─ covers/
├─ data/
└─ epubs/
```

Cloudflare Pages will redeploy automatically after the commit is pushed to the production branch.

## Adding a series

Edit:

```text
data/library.json
```

Each series follows this shape:

```json
{
  "id": "my-series",
  "title": "My Series",
  "author": "Author Name",
  "translator": "Translator Name",
  "status": "Ongoing",
  "tags": ["Fantasy", "Adventure"],
  "description": "Series description.",
  "cover": "/covers/my-series.jpg",
  "volumes": [
    {
      "title": "Volume 01",
      "file": "/epubs/my-series-volume-01.epub",
      "cover": "/covers/my-series-v01.jpg",
      "translator": "Translator Name",
      "language": "English",
      "size": 0,
      "added": "2026-08-19"
    }
  ]
}
```

`size` is optional and is expressed in bytes. Use `0` if you do not want to fill it in yet.

## Covers

Put cover images in:

```text
/covers/
```

JPG, PNG, AVIF, and WebP all work in modern browsers.

Example:

```text
/covers/my-series-v01.jpg
```

Then use:

```json
"cover": "/covers/my-series-v01.jpg"
```

## EPUB files

Put EPUBs in:

```text
/epubs/
```

Example:

```text
/epubs/my-series-volume-01.epub
```

Then use:

```json
"file": "/epubs/my-series-volume-01.epub"
```

## Important

Cloudflare Pages currently has a per-file asset limit. Keep each EPUB below the limit configured for your Pages plan.

Only host files that you have permission to distribute.
