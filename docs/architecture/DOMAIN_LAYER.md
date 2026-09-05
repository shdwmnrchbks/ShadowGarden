# Shared Browser Domain and State Layer

**Refactor milestone:** R2 — Shared domain and state layer  
**Introduced:** Shadow Garden v1.16.0  
**Persistence model:** browser-local reading/preferences data; no Reader accounts or server-side reading history

R2 establishes `src/assets/js/domain/` as the canonical browser-domain boundary. Library, Series, Reader storage, and shared navigation code should depend on these services instead of independently interpreting catalog identity or reading localStorage families.

## Dependency direction

```text
Library / Series / Reader controllers
        |
        v
src/assets/js/domain/
  catalog       book identity
  reading state progress/bookmarks
  preferences   urls / formatting
        |
        v
browser storage / public catalog
```

Network authorization remains outside this layer. Signed EPUB tickets, Garden Pass, acquisition limits, and B2 access continue to belong to the protected Pages Functions / `book-access.js` boundary.

## Modules

### `domain/book-identity.js`

Owns public and compatibility identity semantics:

- opaque public book ID: `bk_[A-Za-z0-9_-]{22}`;
- legacy private media path recognition for migration only;
- deterministic legacy-path → `bk_...` mapping under `shadow-garden-book-id-v1`;
- stable `series:<series-id>:volume:<number>` aliases;
- volume alias construction and matching.

A public `bk_...` identifier is not an authorization secret. Protected EPUB access still requires the server-issued ticket boundary.

### `domain/catalog.js`

Owns browser catalog normalization and lookup:

- status normalization (`Complete`, `Ongoing`, `Hiatus`, `Dropped`);
- status-tag cleanup;
- public `bookId` → public `volume.file` compatibility shape;
- series and volume lookup;
- Main/Adult series-ID classification;
- one-time compatibility migration of legacy progress/bookmark identities.

`data-source.js` remains the network/source adapter and delegates catalog meaning to this module. It may coalesce concurrent public catalog requests and retain the latest successful normalized catalog for bounded startup coordination. A cache-tolerant sibling owner such as pinned navigation can explicitly hand that successful startup snapshot to one subsequent page-controller load; normal later loads remain fresh and still fetch through the canonical source adapter.

### `domain/progress.js`

Owns `sg-progress:<identity>`:

- read/write/clear by identity or alias set;
- newest-progress resolution across aliases;
- page-1/cover beginning semantics;
- legacy progress migration;
- canonical `.file` identity on new progress records.

The Reader now writes progress through this service. When a protected Reader session has both a private source path and public `bk_...` identity, writes are made to both compatibility keys with the public `bk_...` value stored as the canonical `file`. This removes the old 500 ms polling mirror from Reader bootstrap.

### `domain/bookmarks.js`

Owns `sg-bookmarks:<identity>` and compatibility alias writes/migration. Read Again deliberately does **not** clear bookmarks.

### `domain/reading-state.js`

Owns the only user-facing volume state machine:

```text
Unread      -> Read
In Progress -> Continue
Finished    -> Read Again
```

Rules:

- no progress, cover, or canonical page 1 → **Unread**;
- unmarked progress beyond page 1 → **In Progress**;
- explicit Finished marker → **Finished**, regardless of saved progress;
- Read Again removes Finished, clears progress aliases, preserves bookmarks, and returns the next Reader session to page 1.

Finished persistence remains compatible with `sg-finished-books` and `sg-finished:<alias>`.

The service also owns series-level operations such as finished count, whole-series Finished state, preferred Series CTA volume, latest resumable/readable volume selection, and Library banner candidate selection. Audit C keeps that ownership in the domain layer but materializes per-volume state once per decision path so callers do not repeatedly rescan the same browser-local state.

### `domain/preferences.js`

Owns browser-local public Library/Series preferences:

- `sg-pinned`;
- `sg-pinned-nav-collapsed`;
- `sg-view:<scope>`;
- `sg-mobile-filters-collapsed:<scope>`;
- `sg-adult-ack`.

These values affect presentation/navigation only. They are never authorization state.

### `domain/storage.js`

Small fail-soft localStorage primitives. Domain modules use this boundary rather than repeatedly implementing JSON parsing and storage exception handling.

### `domain/urls.js`

Owns public navigation builders for Series, Reader, Read Again restart, Main/Adult Library, and Adult gate return URLs.

### `domain/format.js`

Owns shared low-level browser formatting helpers such as array normalization, HTML escaping, byte sizes, and dates. R3+ should gradually replace duplicated local helpers when moving render ownership.

### `domain/index.js`

Stable namespace entrypoint used by current browser consumers:

```js
import { catalog, readingState, preferences, urls } from "/assets/js/domain/index.js";
```

## Compatibility boundaries retained after R2

R2 intentionally did not perform every later UI decomposition. Current compatibility ownership is narrower than the original R2 state:

- the retired top-level `reading-status.js` facade is gone; current browser code uses canonical `domain/reading-state.js` ownership directly;
- `data-source.js` retains its synchronous `normalizeStatus()` compatibility export for older Garden Keeper code, while catalog normalization itself is domain-owned;
- `book-access.js` still contains security-side legacy identity/migration compatibility and remains an acquisition/security boundary;
- remaining grandfathered presentation compatibility should consume canonical domain services rather than independently scanning browser-local persistence.

## Library / Series handoff

Library and Series controllers are consumers of this domain layer rather than alternate persistence owners.

- `library-model.js` owns filtering/sorting/contextual option computation and requests whole-series Finished state only when an active reading-status filter requires it.
- `library-renderers.js` derives presentation from materialized reading-state entries instead of starting a second persistence scan.
- `library.js` owns URL/control/render orchestration and one canonical catalog render per user action.
- Series rendering keeps its own public page/controller composition while relying on the same catalog, reading-state, progress, bookmark, preference, URL, and volume-action domain owners.

The v2.11C realistic 300-series audit found no evidence that these surfaces need virtualization, controller consolidation, or a new persistence/cache architecture.

## Reader handoff

`reader/storage.js` is now an adapter over `domain/progress.js` and `domain/bookmarks.js`. It receives the private EPUB source identity used by EPUB.js plus the public ID established by Reader bootstrap and treats them as aliases for one logical book.

Reader bootstrap still owns protected ticket/source setup and the temporary URLSearchParams handoff required by the current EPUB.js integration. That transport workaround belongs to the Reader integration boundary. It no longer owns a parallel progress/bookmark synchronization timer.

## Security boundary

The domain layer must remain browser-local and non-authoritative for protected access:

- no B2 credentials;
- no media ticket signing/verification;
- no Garden Keeper authorization;
- no raw IP/network telemetry;
- no server-side reading-history writes.

Completed Security Milestones 1–9 remain the authoritative security contract.
