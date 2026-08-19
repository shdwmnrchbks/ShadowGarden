# Drop EPUB files here

## Main library

```text
library/
├─ Trash of the Count's Family/
│  ├─ Volume 01.epub
│  └─ Volume 02.epub
└─ Another Series/
   └─ Volume 01.epub
```

## Adult / NSFW library

Anything anywhere under the folder named `NSFW` is automatically kept out of the main catalog:

```text
library/
└─ NSFW/
   ├─ Adult Series A/
   │  ├─ Volume 01.epub
   │  └─ Volume 02.epub
   └─ Adult Series B/
      └─ Volume 01.epub
```

The build script reads EPUB metadata and cover images automatically.

Series grouping priority:
1. EPUB `calibre:series` metadata.
2. EPUB 3 `belongs-to-collection` metadata.
3. The folder containing the EPUB.
4. A title-based fallback.

If EPUB metadata is incomplete, putting each series in its own folder is the safest option.

You can also force a series into or out of the Adult Library with `"nsfw": true` or `"nsfw": false` in `series-overrides.json`.
