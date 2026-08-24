# Shadow Garden Browser Persistence Contracts

This document freezes the browser-local persistence surface established by the v1.15.14 application and records the canonical owners introduced by R2/v1.16.0. R2 preserves the existing key formats; it changes who is allowed to interpret/write them.

## localStorage

| Key / family | Canonical owner after R2 | Value | Contract |
| --- | --- | --- | --- |
| `sg-progress:<identity>` | `domain/progress.js` through `reader/storage.js` | JSON object containing Reader position/progress and `updatedAt` | Primary reading progress. `<identity>` may be public `bk_...` or a legacy private media alias during migration. Page 1/cover classifies as Unread. |
| `sg-bookmarks:<identity>` | `domain/bookmarks.js` through `reader/storage.js` | JSON array | Per-volume bookmarks. Read Again must preserve bookmarks. |
| `sg-reader-settings` | `reader/storage.js` + Reader bootstrap early-theme read via `domain/storage.js` | JSON object | Reader theme, typography, flow and related core settings. Must remain readable before full Reader initialization so the loading shell uses the saved theme. |
| `sg-reader-polish-settings` | `reader-polish.js` | JSON object | v1 auxiliary Reader settings, currently including swipe-page-turn preference. R4 should fold this into canonical Reader settings with migration. |
| `sg-finished-books` | `domain/reading-state.js` | JSON object keyed by recognized volume aliases with timestamp values | Aggregate Finished-state compatibility map. Finished overrides progress. |
| `sg-finished:<alias>` | `domain/reading-state.js` | string `"1"` | Redundant per-alias Finished marker retained for compatibility/resilience. R10 may remove it only after the transition window. |
| `sg-pinned` | `domain/preferences.js` | JSON array of series IDs | Pinned-series set shared by Library, Series and navigation. |
| `sg-pinned-nav-collapsed` | `domain/preferences.js` | `"1"` or `"0"` | Collapse preference for the pinned-series navigation section. |
| `sg-view:<scope>` | `domain/preferences.js` | `"grid"` or `"compact"` | Library view preference. Current scopes are `main` and `nsfw`. |
| `sg-mobile-filters-collapsed:<scope>` | `domain/preferences.js` | `"1"` or `"0"` | Mobile-only Library filter collapse preference for `main` / `nsfw`. |
| `sg-adult-ack` | `domain/preferences.js` | `"1"` when acknowledged | Browser-local acknowledgement for the Adult Library. It is not authentication or parental control. |

### Reading-progress identity rule

The public `bk_...` identity is canonical for public navigation/domain state, while EPUB.js still receives the signed private media path during the current Reader transport handoff.

R2 therefore uses one logical-volume service with compatibility aliases:

1. public `bk_...` remains the canonical value stored in new progress records' `file` field;
2. Reader writes progress/bookmarks to the public and current private-source compatibility keys through one service call;
3. legacy `/media/shadow-garden/books/...epub` keys may be read/migrated while compatibility remains supported;
4. no UI module may invent another unrelated identity for the same volume;
5. the old 500 ms Reader bootstrap mirror is removed—alias writes are synchronous at the canonical storage boundary;
6. R4 may simplify the private-source transport handoff further, but cannot change the three-state semantics or lose existing progress/bookmarks.

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

R2 centralizes the public/browser state contracts behind services, but no storage-key deletion is allowed merely because a new module exists. A key can be retired only after its readers/writers are identified, migration behavior is tested, and the roadmap records the supported transition window. `tools/check-r0.mjs`, `tools/check-reading-status.mjs`, and `tools/check-r2.mjs` enforce these contracts across implementation-owner changes.
