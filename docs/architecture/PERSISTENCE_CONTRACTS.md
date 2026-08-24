# Shadow Garden v1 Persistence Contracts

This document freezes the browser-local persistence surface used by the v1.15.14 application. These keys are compatibility contracts during the refactor. A refactor may introduce a canonical storage service, but it must either preserve these keys or explicitly migrate them before deleting old readers.

## localStorage

| Key / family | Owner(s) today | Value | Contract |
| --- | --- | --- | --- |
| `sg-progress:<identity>` | `reader/storage.js`, Reader bootstrap/mirroring, `reading-status.js`, Library banner | JSON object containing Reader position/progress and `updatedAt` | Primary reading progress. `<identity>` may be public `bk_...` or a legacy private media alias during v1 migration. Page 1/cover must classify as Unread. |
| `sg-bookmarks:<identity>` | `reader/storage.js`, `book-access.js` migration, Reader | JSON array | Per-volume bookmarks. Read Again must preserve bookmarks. |
| `sg-reader-settings` | `reader/storage.js`, `reader.html` early theme bootstrap | JSON object | Reader theme, typography, flow and related core settings. Must be readable before full Reader initialization so the loading shell uses the saved theme. |
| `sg-reader-polish-settings` | `reader-polish.js` | JSON object | v1 auxiliary Reader settings, currently including swipe-page-turn preference. R4 should fold this into the canonical Reader settings service with migration. |
| `sg-finished-books` | `reading-status.js` | JSON object keyed by recognized volume aliases with timestamp values | Aggregate Finished-state compatibility map. Finished state overrides progress. |
| `sg-finished:<alias>` | `reading-status.js` | string `"1"` | Redundant per-alias Finished marker used by v1. It exists to make completion resilient across public/private/stable aliases. R10 may remove it only after the transition window. |
| `sg-pinned` | `library.js`, `series.js`, `nav-pinned.js` | JSON array of series IDs | Pinned-series set shared by Library, Series and navigation. |
| `sg-pinned-nav-collapsed` | `nav-pinned.js` | `"1"` or `"0"` | Collapse preference for the pinned-series navigation section. |
| `sg-view:<scope>` | `library.js` | `"grid"` or `"compact"` | Library view preference. Current scopes are `main` and `nsfw`. |
| `sg-mobile-filters-collapsed:<scope>` | `library-mobile-filter.js` | `"1"` or `"0"` | Mobile-only Library filter collapse preference for `main` / `nsfw`. |
| `sg-adult-ack` | `library.js`, Series/Reader adult-gate checks | `"1"` when acknowledged | Browser-local acknowledgement for the Adult Library. It is not authentication or parental control. |

### Reading-progress identity rule

The v1 Reader still has compatibility code because EPUB.js historically initializes against the private media path while public Series/Library pages use `bk_...`. During the refactor:

1. the public `bk_...` identity is canonical for public navigation and domain state;
2. legacy `/media/shadow-garden/books/...epub` progress/bookmark keys may be read/migrated while compatibility remains supported;
3. new architecture must not create a third unrelated identity for the same volume;
4. the final R4/R10 architecture should write progress once through a canonical state service rather than mirror aliases with timers/patches.

## IndexedDB

| Database | Store | Owner | Contract |
| --- | --- | --- | --- |
| `shadow-garden-reader` | `page-maps` | `reader/page-map.js` | Device-specific canonical Page Map cache. Cache entries may be rebuilt; loss must not lose reading progress/bookmarks. |
| `shadow-garden-visual-pages` | `books` | `reader-visual-cache.js` | Prepared standalone visual-page cache. Optional/fail-soft optimization; deletion only causes re-preparation. |

IndexedDB caches are performance/measurement caches rather than user-authored reading history. Refactors may invalidate/rebuild them if the cache version changes, but must preserve logical Reader behavior.

## Server-issued cookies

These are browser persistence contracts but are server-authoritative rather than localStorage state.

| Cookie | Scope / lifetime | Purpose |
| --- | --- | --- |
| `sg_human_session` | `Path=/book-access`, 12 hours, HttpOnly, Secure, SameSite=Strict | Turnstile-backed Garden Pass session for protected book acquisition. |
| `sg_acquisition_window` | `Path=/book-access`, 10 minutes, HttpOnly, Secure, SameSite=Strict | Signed 20-unique-book rolling acquisition budget. |
| signed media ticket cookie | exact protected EPUB media path, short-lived, HttpOnly/Secure/SameSite policy defined by media-ticket service | Authorizes GET/HEAD/Range for exactly one EPUB path. |
| `sg_admin_session` | `Path=/admin-api`, 1 hour, HttpOnly, Secure, SameSite=Strict | Garden Keeper signed admin session; bearer token is still required. |
| `sg_admin_failures` | compatibility/UI mirror only | Legacy mirror of Keeper failure state. Server-side B2 throttle state is authoritative and Incognito/cleared cookies cannot reset it. |

## Non-persistent sensitive values

- Garden Keeper's admin token may exist in page memory/input state while the page is open but must not be written to localStorage, catalogs, EPUBs or B2 objects.
- Turnstile response tokens are transient request inputs and must not be persisted.
- signed media URLs/tickets are short-lived authorization material and must not become durable catalog fields.
- raw client IP addresses must not be written to the persistent abuse/admin throttle stores.

## Refactor guardrail

R2/R4 may consolidate these contracts behind services, but no storage-key deletion is allowed merely because a new module exists. A key can be retired only after its reader/writer owners are identified, migration behavior is tested, and the roadmap records the supported transition window.
