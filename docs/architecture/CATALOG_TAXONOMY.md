# Shadow Garden Catalog Taxonomy

Shadow Garden v2.3 separates **Genres** from **Tags** so EPUB publisher metadata cannot inflate the public filter vocabulary.

## Canonical Genres

Genres use the Novel Updates genre vocabulary as Shadow Garden's controlled list:

Action, Adult, Adventure, Comedy, Drama, Ecchi, Fantasy, Gender Bender, Harem, Historical, Horror, Josei, Martial Arts, Mature, Mecha, Mystery, Psychological, Romance, School Life, Sci-fi, Seinen, Shoujo, Shoujo Ai, Shounen, Shounen Ai, Slice of Life, Smut, Sports, Supernatural, Tragedy, Wuxia, Xianxia, Xuanhuan, Yaoi, Yuri.

The vocabulary is intentionally fixed. Publisher-specific forms such as `Fiction/Fantasy/General`, `Fantasy Fiction`, and `Science Fiction` normalize to canonical values instead of becoming new filter entries.

## Tags

Tags remain flexible descriptive metadata. Examples include `Academy`, `Reincarnation`, `Light Novel`, `Webnovel`, or publisher-specific descriptors that do not safely map to one canonical genre.

Generic hierarchy nodes such as `Fiction` and `General` are discarded. Ambiguous terms are preserved as Tags rather than guessed into a more specific Genre. For example, `Boys Love` remains a tag rather than being automatically classified as Yaoi or Shounen Ai.

## EPUB Import

Garden Keeper reads EPUB `dc:subject` values locally during preflight and classifies them into canonical Genres and descriptive Tags. Raw subjects are retained only in the queued preflight state for review; they are not added to the public catalog as duplicate taxonomy values.

The server repeats the normalization before catalog writes, so manual or stale clients cannot bypass the taxonomy boundary.

## Existing Catalogs

Garden Maintenance exposes a taxonomy audit before migration. The audit shows how many series would change and previews the before/after Genre and Tag sets. Normalization is explicit and backed up before writing either catalog.

Unknown descriptive values are preserved as Tags; only recognized aliases/generic hierarchy nodes are moved or removed automatically.

## Ownership

- Browser normalization: `src/assets/js/domain/catalog-taxonomy.js`
- Server normalization/audit: `functions/_lib/catalog-taxonomy.js` and `functions/services/catalog.js`
- EPUB subject extraction: `src/assets/js/admin-batch.js`
- Public filtering: `src/assets/js/library-model.js` + `src/assets/js/library.js`
- Keeper editing/audit: Library and Maintenance workflows

Browser and server taxonomy behavior is kept in sync by permanent unit/service regression coverage.
