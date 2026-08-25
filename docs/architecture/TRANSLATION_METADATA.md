# Fan Translation Metadata

Shadow Garden v2.1 treats fan-translation provenance as first-class public catalog metadata.

## Catalog shape

A series may define a translation status and one or more credits:

```json
{
  "translationStatus": "Ongoing",
  "translations": [
    {"name":"Miraclerifle","url":"https://example.com/","coverage":"Chapters 1–627"},
    {"name":"EAP","coverage":"Chapters 628–776"}
  ]
}
```

Supported translation statuses are `Complete`, `Ongoing`, `Stalled`, and `Partial`. Credit fields are `name`, optional `group`, optional HTTP(S) `url`, optional free-form `coverage`, and optional short `note`.

A volume may define its own `translations` array. A non-empty volume array overrides the series credits for that volume; an absent/empty volume array inherits the series credits. This allows translator hand-offs by chapter or volume range without repeating the default credit on every book.

## Public UI ownership

- `domain/translations.js` owns browser normalization, inheritance, translator names, search terms and primary-credit selection.
- Library search indexes translator/group/coverage text. `translator=...` is a canonical Library query parameter and the Translator/Group control participates in active-filter pills and mobile result focus.
- Catalog cards show compact `TL · ...` attribution.
- Series pages show a dedicated Translation Credits panel, translation status, translator filter links and safe external source links. Per-volume overrides are called out on the affected volume card.
- Original/publication series status remains separate from translation status.

## Garden Keeper ownership

`admin/translation-workflow.js` augments the existing Series Editor without replacing the Library workflow. It owns series translation status/credits and per-volume overrides. Writes go through `/admin-api/translations` to `functions/services/translations.js`, which validates URLs and field lengths, snapshots catalogs before mutations, and invalidates the public catalog cache.

The New Books workflow may seed a new series with its primary fan-translation credit and translation status; richer hand-offs and per-volume overrides remain editable in the Series Editor after upload.

## Security and persistence

Translation attribution is intentionally public metadata. The public catalog transformation preserves it while continuing to redact private EPUB paths, hashes and original filenames. No reading-state, media-ticket, human-verification, Keeper-session, or private-B2 contract changes.
