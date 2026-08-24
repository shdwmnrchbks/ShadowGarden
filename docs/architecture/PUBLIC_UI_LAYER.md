# Public Library and Series UI Layer

**Refactor milestone:** R3 — Library + Series decomposition  
**Introduced:** Shadow Garden v1.17.0  
**State dependency:** R2 `domain/` services

R3 removes the v1 pattern where the Library or Series page rendered one DOM shape and later scripts observed and repaired it. Public Library/Series UI now renders from canonical state in one pass, and every volume entry point uses the same action model.

## Ownership

### `library.js`

The Library controller owns page initialization, Main/Adult scope, URL/filter state, incremental rendering, control events, Adult acknowledgement, and refresh orchestration. It does not construct cards itself.

### `library-model.js`

Owns pure catalog query behavior: search tokenization, filters, sorting, Recently Added selection, filter-option discovery, and validation of URL-derived filter values.

### `library-renderers.js`

Owns Library markup for:

- Grid and Compact series cards;
- Compact badge rail;
- Recently Added volume cards;
- the progress-aware reading banner and its backdrop artwork.

Finished/pinned/volume/adult badges are rendered directly. There is no post-render compact-card MutationObserver.

### `series.js`

The Series controller owns catalog lookup, Main/Adult scope, pin events, page title, and rerendering when local reading state changes or a page returns from the Reader.

### `series-renderers.js`

Owns the Series hero, banner selection, clickable tags, primary volume CTA, volume cards, cover links, state metadata, Finished marks, and not-found content.

The selected `bannerBookId` is applied during the initial render rather than by a later polish layer.

### `public/volume-actions.js`

This is the single public volume-action controller shared by Library and Series.

Every volume link rendered by R3 carries the same action metadata:

```text
data-volume-action
+ series id
+ public book id
+ canonical volume state
+ volume title
```

The R2 state machine determines the action:

```text
Unread      -> Read
In Progress -> Continue
Finished    -> Read Again
```

For Finished volumes, the controller owns the confirmation dialog, clears Finished + progress through the R2 services, verifies that the volume returned to Unread, and only then opens the Reader with `restart=1`. Bookmarks are preserved. If reset persistence fails, navigation is stopped instead of silently opening a stale Finished volume.

## Entry-point parity

The same action object is used by:

- Series primary CTA;
- Series volume Read/Continue/Read Again button;
- Series volume cover;
- Library Recently Added card/cover;
- Library reading banner CTA.

This fixes the pre-R3 flaw where Recently Added knew a volume was Finished but still used a direct Reader URL that bypassed the Read Again confirmation/reset path.

## Refresh behavior

Library and Series both refresh canonical reading UI on:

- `sg-reading-status-changed`;
- relevant cross-tab `storage` changes;
- `pageshow` when returning through browser history/bfcache.

Library refresh preserves the number of incrementally loaded catalog cards instead of collapsing the user back to the first render batch when reading state changes.

## Removed R3 ownership layers

- `library-series-polish.js`
- `library-finished-polish.js`
- `series-read-again.js`
- `series-cover-links.js`
- `series-read-again.css` (replaced by shared `volume-actions.css`)

These files must not return. Their behavior now belongs to the controllers/renderers above.

## Deliberate boundaries left for later milestones

- `library-mobile-filter.js` remains the single owner of mobile filter panel placement/collapse behavior; its persistent value is R2-owned.
- `nav-pinned.js` remains the site-navigation owner for pinned-series navigation.
- `library-footer-version.js` remains the Library deployed-version component.
- broad CSS consolidation remains R7 work.
- Reader internals are unchanged until R4.

R3 changes public UI ownership, not security, catalog storage, or Reader persistence formats.
