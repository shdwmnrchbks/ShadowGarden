# Shadow Garden library configuration

As of v0.4, EPUB binaries should live in Backblaze B2 rather than in this GitHub repository.

## Files kept here

```text
library/
├─ b2.example.json
├─ b2.json                    # create this after your B2 bucket exists
├─ series-overrides.example.json
└─ series-overrides.json      # optional
```

`b2.json` contains public bucket/endpoint information only. Do not put Backblaze credentials in it.

Credentials belong in the repository-root `.env.b2` file, which is gitignored.

## Upload normal books

```text
npm run b2:upload -- "D:\Books\Series Name - Volume 01.epub"
```

## Upload adult / NSFW books

```text
npm run b2:upload -- --adult "D:\Books\Adult Series - Volume 01.epub"
```

## Force a series name

```text
npm run b2:upload -- --series="Series Name" "D:\Books\Volume 01.epub"
```

The uploader extracts EPUB metadata and the cover, uploads both to B2, and updates the remote catalog automatically.

The old local-EPUB build path remains available as a fallback when `b2.json` is absent or disabled, but it is no longer the recommended storage method.
