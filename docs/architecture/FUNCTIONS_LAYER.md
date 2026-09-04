# Pages Functions Service Layer

**Refactor milestone:** R6 — Pages Functions service layer  
**Current audit:** v2.11E — Pages Functions, security & storage

Shadow Garden keeps Cloudflare Pages Function files as **thin route adapters** over explicit backend services. Public URLs, response contracts, signed-media policy, Keeper authentication, private Backblaze B2 namespaces, Range delivery, catalog redaction, abuse controls, and recovery invariants remain service-owned.

> **v2.11E result:** the service split remains healthy. Audit E found one least-privilege storage defect, nine unowned service exports, and a verification gap. It did not justify a Functions rewrite. Read-only B2 operations now sign with read credentials even when called through a mutation-capable service client; mutation methods still require write credentials. Current repository checks also enforce route thinness, whole-Functions reachability, and retained service-export consumers.

## Dependency direction

```text
Pages Function routes
        |
        v
functions/services/
  http · storage · auth · media · catalog · validation
  abuse · admin · recovery · recovery-readiness · translations
        |
        v
functions/_lib/
  signed-session/ticket primitives
  throttles · crawler policy · book identity · taxonomy
        |
        v
private Backblaze B2 / Cloudflare Cache
```

Routes may select a service handler and return its response. They do not own authentication, validation, catalog persistence, B2 requests, cache invalidation, media-ticket verification, recovery policy, abuse policy, or response construction.

## Thin route adapters

The current production graph has **15 Pages Function route roots**:

- `/admin-access` → `services/auth.js#handleAdminAccess`
- `/human-access` → `services/auth.js#handleHumanAccess`
- `/book-access` → `services/media.js#handleBookAccess`
- `/media/*` → `services/media.js#handleMediaRequest`
- `/admin-api/status` and `/admin-api/upload` → `services/admin.js`
- `/admin-api/library` and `/admin-api/catalog` → `services/catalog.js`
- `/admin-api/series-banner` → `services/catalog.js`
- `/admin-api/maintenance` → catalog GET plus recovery-guarded POST ownership
- `/admin-api/backup` → `services/recovery.js`
- `/admin-api/recovery` → `services/recovery.js`
- `/admin-api/recovery-readiness` → `services/recovery-readiness.js`
- `/admin-api/abuse` → `services/abuse.js`
- `/admin-api/translations` → `services/translations.js`

`tools/check-functions-entrypoint-reachability.mjs` is now the live ownership guard. It discovers route roots dynamically, requires adapters to remain small direct `onRequest* → service` delegates, rejects route imports outside `functions/services/`, follows the complete Functions import graph, and rejects service exports without repository consumers. On the Audit-E measured code head it proves **15 thin route roots → all 38 Functions sources**, with **91 retained service exports having consumers**.

The historical R6 executable checker and forwarding `_lib/b2.js` / `_lib/garden-maintenance.js` facades remain retired; v2.11 uses current repository/security/service/browser checks instead of preserving release-era policy scripts.

## Authentication service

`functions/services/auth.js` owns the authentication/session application boundary:

- constant-time Keeper bearer-token comparison;
- bearer token + signed `sg_admin_session` verification for `/admin-api/*`;
- Garden Keeper Turnstile challenge/session establishment;
- server-authoritative Keeper failure cooldowns and telemetry;
- public human-verification session establishment;
- same-origin and crawler-policy enforcement on authentication endpoints.

Cryptographic formats remain in the accepted `_lib/admin-session.js`, `_lib/human-session.js`, and `_lib/admin-throttle.js` primitives.

## Media service

`functions/services/media.js` owns book acquisition authorization and private-media delivery.

`handleBookAccess()` preserves same-origin acquisition, crawler/script screening, M8 public abuse cooldown enforcement, human-session verification, opaque `bk_...` resolution, acquisition limits, and signed media ticket/cookie issuance.

`handleMediaRequest()` preserves allowlisted public catalogs/covers/EPUBs, signed EPUB authorization, `Range` and conditional-request forwarding, same-origin protected-media headers, public catalog redaction through `publicCatalogShape()`, canonical EPUB cache keys, and bounded caching.

The M8 cooldown remains deliberately outside `/media/*`. Invalid-ticket telemetry is still suppressed for stale Range retries so Reader recovery cannot activate the persistent network cooldown.

Audit E found no duplicated media owner and no reason to rewrite this service. Two previously exported media-only helpers were made private after repository-wide consumer tracing found no external owner.

## Storage service

`functions/services/storage.js` is the single Backblaze B2 transport owner.

It owns object-key encoding and traversal/prefix validation, AWS4 client construction, GET/HEAD/PUT/DELETE operations, backup integrity metadata, and storage configuration checks. The bucket remains private and direct B2 credentials/URLs are never a browser delivery contract.

### Least-privilege credential routing

Audit E measured four authenticated read-only handlers—Library GET, Series Banner GET, Maintenance GET, and Recovery GET—with valid Keeper auth plus B2 read credentials but no B2 write credentials. Before the fix they returned 502 because their call graphs instantiated `writeClient(env)` even though the storage operations were only GET/HEAD.

`writeClient(env)` is now method-routed and lazy:

- GET and HEAD use the read credential pair;
- PUT, DELETE, and any other mutation method use the write credential pair;
- a missing write credential pair never falls back to read credentials and fails before a mutation request is sent.

This preserves existing service composition while restoring least privilege. Handlers that perform mixed read/write transactions can keep one transport abstraction without forcing write credentials onto read-only execution paths.

Three storage-only implementation symbols (`B2_ENDPOINT`, `B2_REGION`, and `sha256Text`) were made private after the service-export audit found no repository consumer.

## Catalog, recovery, and validation

`functions/services/catalog.js` remains the canonical catalog persistence and Garden Maintenance read owner. It owns Main/Adult catalog mutation, stable book identity during replacement, Library/Series metadata, banners, snapshot creation, Trash state, cover-optimization commits, and maintenance payload shaping.

`functions/services/recovery.js` owns destructive/recovery-sensitive policy: backup deletion safety, emergency recovery, recovery-anchor protection, and guarded Maintenance mutations that can affect recovery guarantees. `functions/services/recovery-readiness.js` owns on-demand readiness inspection independently from destructive actions.

Audit E kept this split. Four catalog-only exported implementation details (`TRASH_KEY`, `loadCatalog`, `managementShape`, `appendTrashItem`) were made private after no external consumer was found.

`functions/services/validation.js` owns upload namespace/MIME/size validation, opaque `cv_...` cover policy, catalog input normalization, media-reference normalization, Garden Health inspection, and bounded object checks. Its allowed-upload prefixes, opaque-cover matcher, and SHA normalization remain exported intentionally as direct security regression seams and now have explicit service-test coverage.

## Abuse, HTTP, admin, and translations

`functions/services/abuse.js` owns cooldown lookup/response orchestration, deferred abuse-signal recording, Abuse Watch review, and public-cooldown release. HMAC identity/ledger primitives remain under `_lib/` and raw IP addresses are not persisted.

`functions/services/http.js` centralizes no-store JSON responses, multi-cookie responses, same-origin checks, JSON parsing, method errors, and `waitUntil`-safe deferred work.

`functions/services/admin.js` stays intentionally small: it composes authentication, validation, and storage for Keeper status and raw object uploads without becoming a second general service layer.

`functions/services/translations.js` owns server-side translation metadata mutation/validation. Its route remains a forwarding adapter rather than duplicating catalog/auth rules.

## Verification ownership

Audit E closes a verification gap by running the full Functions security and service contracts in normal pull-request Verify, not only in the monthly Baseline Health workflow. Verify now includes:

- `npm run check`, including route/source/export ownership;
- `npm run check:security` for signed media, opaque IDs, human-session, protected-route, catalog-redaction, and Range/cooldown contracts;
- `npm run test:service` for Keeper auth, B2 credential routing, recovery, catalog/storage integrity, translation metadata, media tickets, and validation;
- the existing Reader/Library targeted regressions and production build.

Baseline Health remains the periodic full deterministic/security/recovery/performance maintenance owner, and the five-project real-browser workflow remains the browser integration gate.

## Security invariants

The following remain non-negotiable:

- EPUB delivery requires valid signed media authorization and preserves HTTP Range behavior.
- M8 public cooldown enforcement stays outside `/media/*`.
- `/admin-api/*` requires both the Keeper bearer token and valid signed admin session.
- Keeper cooldown state remains server-authoritative.
- HMAC-derived identities remain opaque and raw IP addresses are never persisted.
- Public catalog payloads do not expose private EPUB paths, SHA-256 values, or original filenames.
- Cover object names remain opaque `cv_...` keys enforced server-side.
- Backblaze B2 credentials and private objects remain server-only.
- Recovery deletion/purge operations preserve a verified usable recovery anchor where required.
- Browser-local Reader progress, bookmarks, Finished state, and settings remain browser-local.

## v2.11E decision

Audit E found **a bounded credential-ownership defect, stale export surface, and a CI coverage gap—not an architectural Functions problem**. Keep the current route/service/helper decomposition. The accepted changes are method-level least-privilege B2 routing, removal of nine unowned exports, explicit ownership tests for three security-policy exports, a permanent thin-route/export-consumer guard, and promotion of security/service regressions into normal Verify.
