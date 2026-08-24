# Pages Functions Service Layer

**Refactor milestone:** R6 — Pages Functions service layer  
**Release:** v1.21.0

R6 turns Cloudflare Pages Function files into **Thin route adapters** over explicit backend services. Public URLs, response contracts, security policy, private Backblaze B2 namespaces, and the accepted Milestones 1–9 security baseline are preserved.

## Dependency direction

```text
Pages Function routes
        |
        v
functions/services/
  http · storage · auth · media
  catalog · validation · abuse · admin
        |
        v
functions/_lib/
  signed-session/ticket primitives
  throttles · crawler policy · book identity
        |
        v
private Backblaze B2 / Cloudflare Cache
```

Routes may select a service handler and return its response. They do not own authentication, validation, catalog persistence, B2 requests, cache invalidation, media-ticket verification, abuse policy, or response construction.

## Thin route adapters

The following endpoints remain externally unchanged while becoming adapters:

- `/admin-access` → `services/auth.js#handleAdminAccess`
- `/human-access` → `services/auth.js#handleHumanAccess`
- `/book-access` → `services/media.js#handleBookAccess`
- `/media/*` → `services/media.js#handleMediaRequest`
- `/admin-api/status` and `/admin-api/upload` → `services/admin.js`
- `/admin-api/library`, `/catalog`, `/maintenance`, `/series-banner`, `/backup` → `services/catalog.js`
- `/admin-api/abuse` → `services/abuse.js`

`tools/check-r6.mjs` permanently prevents these route files from regaining B2, authentication, ticket, validation, or cache implementations.

## Authentication service

`functions/services/auth.js` owns the authentication/session application boundary.

It owns:

- constant-time Keeper bearer-token comparison;
- bearer token + signed `sg_admin_session` verification for `/admin-api/*`;
- Garden Keeper Turnstile challenge/session establishment;
- server-authoritative Keeper failure cooldowns and significant-cooldown telemetry;
- public human-verification session establishment;
- same-origin and crawler-policy enforcement on authentication endpoints.

Cryptographic token/session formats stay in the accepted `_lib/admin-session.js`, `_lib/human-session.js`, and `_lib/admin-throttle.js` primitives.

## Media service

`functions/services/media.js` owns both book acquisition authorization and private-media delivery.

### Book acquisition

`handleBookAccess()` preserves:

- same-origin acquisition requests;
- crawler/script screening before expensive human/catalog work;
- M8 public abuse cooldown enforcement;
- human-session verification;
- opaque `bk_...` book resolution;
- the 20-unique-books / 10-minute signed acquisition limiter;
- signed media ticket and HttpOnly ticket-cookie issuance.

### `/media/*`

`handleMediaRequest()` preserves:

- allowlisted public catalogs, opaque covers, and EPUB objects only;
- signed query-ticket or cookie-ticket authorization for EPUBs;
- `Range`, `If-Range`, `If-None-Match`, and `If-Modified-Since` forwarding;
- same-origin `Cross-Origin-Resource-Policy` and protected-media anti-indexing headers;
- public catalog redaction through `publicCatalogShape()`;
- canonical EPUB cache keys that exclude ephemeral signatures;
- immutable cover caching and bounded catalog/EPUB caching.

The M8 cooldown is deliberately **not** checked in `/media/*`. A stale Reader Range request may legitimately arrive after its ticket expires; invalid-ticket telemetry is therefore recorded only when `!incomingRange`. This preserves Reader recovery without letting Range requests activate the persistent network cooldown.

## Storage service

`functions/services/storage.js` is the single Backblaze B2 transport owner.

It owns:

- bucket/endpoint/region constants;
- read/write AWS4 clients;
- object-key encoding and traversal/prefix validation;
- B2 GET, HEAD, PUT, and DELETE operations;
- storage configuration checks.

The bucket remains private. Direct B2 URLs and credentials are not exposed as public delivery contracts.

`functions/_lib/b2.js` now exists only as a compatibility facade for older internal imports and tests. It contains no second B2/auth implementation.

## Catalog service

`functions/services/catalog.js` is the single server-side catalog persistence owner.

It owns:

- Main + Adult catalog loading/saving and public-cache invalidation;
- upload catalog mutation and duplicate reject/replace/separate behavior;
- stable `bookId` preservation during replacement;
- Library/Series metadata, status, audio-folder and Main/18+ shelf changes;
- Series banner selection;
- backup snapshot creation, retention, restore, and deletion;
- soft-delete Trash creation, recovery, and permanent purge;
- cover optimization catalog commits;
- Garden Maintenance payload orchestration.

`functions/_lib/garden-maintenance.js` is now a compatibility facade over this service rather than a second catalog implementation.

## Validation service

`functions/services/validation.js` owns reusable backend validation and catalog-health inspection.

It owns:

- the 50 MB upload limit;
- allowed upload namespaces/content types;
- server-enforced opaque `cv_...` cover object keys;
- normalized catalog mutation inputs and external URL checks;
- media-reference normalization;
- static Garden Health inspection;
- bounded/concurrent B2 object existence checking.

Browser EPUB preflight remains client-side Garden Keeper behavior; R6 does not move Reader-focused EPUB parsing to the server.

## Abuse service

`functions/services/abuse.js` owns abuse-response orchestration:

- safe M8 cooldown lookup for acquisition endpoints;
- standard cooldown responses;
- deferred persistent abuse-signal recording;
- authenticated Abuse Watch review and public-cooldown release.

The underlying HMAC state and ledger format remain unchanged in `_lib/abuse-telemetry.js`. R6 changes its storage dependency only; it does not migrate security state or persist raw IP addresses.

## HTTP and admin services

`functions/services/http.js` centralizes no-store JSON responses, multi-cookie responses, same-origin checks, JSON parsing, method errors, and `waitUntil`-safe deferred work.

`functions/services/admin.js` is intentionally small. It composes authentication, validation, and storage for Keeper status and raw object uploads without becoming another general service layer.

## Security invariants

R6 must preserve all accepted security contracts:

- `/media/*` EPUB delivery requires a valid signed media ticket and preserves HTTP Range behavior.
- M8 public cooldown enforcement stays outside `/media/*`.
- `/admin-api/*` still requires both the Keeper bearer token and valid signed admin session.
- Garden Keeper cooldown state remains server-authoritative across normal/Incognito sessions on one network.
- HMAC-derived security identities remain opaque and raw IP addresses are never persisted.
- public catalog payloads never expose private EPUB paths, SHA-256 values, or original filenames.
- cover object names remain opaque `cv_...` keys enforced server-side.
- Backblaze B2 credentials and direct private-object delivery remain server-only.
- browser-local Reader progress, bookmarks, Finished state, and settings remain browser-local.

## R6 acceptance

- Every Pages Function route is a thin adapter to `functions/services/`.
- Authentication, Media, Catalog, Storage, Validation, Abuse, HTTP, and small Admin service owners are explicit.
- Duplicate B2 and catalog persistence implementations are removed or reduced to compatibility facades.
- Permanent M5–M9 and R0 checks assert the same behavior at the new owners rather than route-file implementation details.
- `tools/check-r6.mjs` protects route thinness, service ownership, opaque upload validation, traversal rejection, signed-session ownership, and the Range/M8 boundary.
- The complete repository check suite and production build must pass before R6 merges.
