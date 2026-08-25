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

Supported translation statuses are `Complete`, `Ongoing`, `Stalled`, and `Partial`. Credit fields are `name`, optional HTTP(S) `url`, and optional free-form `coverage`. The earlier `group` and `note` fields are retired: browser/server normalization ignores them, Keeper no longer writes them, and the public catalog transformation strips them from legacy records.

A volume may define its own `translations` array. A non-empty volume array overrides the series credits for that volume; an absent/empty volume array inherits the series credits. This allows translator hand-offs by chapter or volume range without repeating the default credit on every book.

## Public UI ownership

- `domain/translations.js` owns browser normalization, inheritance, translator names, search terms and primary-credit selection.
- Library search indexes translator/coverage text. `translator=...` is a canonical Library query parameter; the Translator control participates in active-filter pills and mobile result focus.
- Catalog cards show compact `TL · ...` attribution.
- Series pages keep translation attribution in the Series information area rather than repeating a separate Translation Credits panel.
- A translator name with a source URL links directly to that HTTP(S) source in a new tab. Without a source URL, the name falls back to the Library `translator=` filter.
- Per-volume overrides are called out on the affected volume card.
- Original/publication series status remains separate from translation status.

## Garden Keeper ownership

`admin/translation-workflow.js` augments the existing Series Editor without replacing the Library workflow. It owns series translation status/credits and per-volume overrides. Writes go through `/admin-api/translations` to `functions/services/translations.js`, which validates URLs and field lengths, snapshots catalogs before mutations, and invalidates the public catalog cache.

The New Books workflow may seed a new series with its primary fan-translation credit and translation status. During local EPUB preflight, contributor metadata with a translator role is recognized from both EPUB3 refined role metadata (`property="role"`, `refines="#..."`, MARC relator `trl`) and legacy `opf:role="trl"` contributor metadata; the detected translator is prefilled as the upload translation credit.

## Security and persistence

Translation attribution is intentionally public metadata. The public catalog transformation preserves the supported fields while continuing to redact private EPUB paths, hashes and original filenames. No reading-state, media-ticket, human-verification, Keeper-session, or private-B2 contract changes.
