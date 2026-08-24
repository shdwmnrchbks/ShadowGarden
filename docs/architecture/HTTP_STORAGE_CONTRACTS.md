# Shadow Garden v1 HTTP and Storage Contracts

This document freezes the externally meaningful route/auth/storage boundaries that the full refactor must preserve. Internal file placement may change; these behaviors may not drift accidentally.

## Cloudflare Pages Functions routes

`src/_routes.json` sends the following paths through Pages Functions:

| Route | Methods | Authorization / policy | Storage effect |
| --- | --- | --- | --- |
| `/media/*` | GET, HEAD, OPTIONS | Catalogs/covers are public through the same-origin proxy. EPUB objects require a valid signed media ticket; cross-site EPUB requests are denied. Range requests are supported and are deliberately outside M5/M8 cooldown enforcement. | Read-only B2 proxy; public cache for catalogs/covers/authorized EPUB responses. |
| `/book-access` | POST, OPTIONS | Same-origin browser policy, M8 network cooldown, automation screen, signing configuration, optional active Turnstile human session, opaque-book resolution, M5 acquisition budget. | Reads private catalogs; issues signed media ticket + acquisition cookie. No EPUB bytes returned directly. |
| `/human-access` | GET/POST/OPTIONS as implemented | M8 cooldown + automation screen; verifies Cloudflare Turnstile with the `book_access` action/hostname. | Issues `sg_human_session`; abuse signals may write security telemetry. |
| `/admin-access` | GET/POST plus supported control actions | Keeper-specific Turnstile action, constant-time `SG_ADMIN_TOKEN` comparison, server-side escalating network cooldown. | Issues/clears signed `sg_admin_session`; reads/writes/deletes admin throttle state and may append Abuse Watch events. |
| `/admin-api/*` | endpoint-specific GET/POST/PUT style operations | Every endpoint requires both `Authorization: Bearer <SG_ADMIN_TOKEN>` and a valid `sg_admin_session`. | Authorized catalog/media/maintenance writes in the managed Shadow Garden B2 namespace. |

### `/media/*` invariants

- Only managed keys below `shadow-garden/` can be addressed.
- Publicly routable media is limited to the two catalogs, cover-image objects and EPUB objects; other managed objects return 404 through this proxy.
- EPUB authorization accepts a valid query ticket or exact-path ticket cookie.
- GET/HEAD and HTTP Range semantics must be preserved.
- protected media strips permissive CORS headers, sets same-origin resource policy and noindex/noarchive headers.
- public catalog responses are transformed through `publicCatalogShape()` before reaching the browser; private file paths, EPUB hashes and original filenames are redacted.
- M8 tripwire enforcement does **not** run in this route. Cross-site EPUB denials and invalid non-Range ticket requests may emit telemetry, while stale Range recovery failures do not add persistent score.

### `/book-access` invariants

Successful book acquisition returns an opaque public `bookId`, a short-lived signed media URL and expiry metadata. It sets the exact-book ticket cookie and the signed acquisition-window cookie. The `bk_...` identifier itself is not authorization.

The order of inexpensive/defensive checks is intentional: same-origin policy and current M8 cooldown/automation screening happen before expensive authorization/catalog work. A normal Reader can reauthorize the same book without consuming another unique-book slot.

### Garden Keeper authorization invariant

UI lock state is never sufficient authorization. `adminAuthorized()` requires:

1. constant-time match of the bearer token against `SG_ADMIN_TOKEN`; and
2. a currently valid HMAC-signed `sg_admin_session` cookie.

Refactoring client modules cannot weaken this server boundary.

## Backblaze B2 root

All managed objects live below:

```text
shadow-garden/
```

The bucket is `shadow-garden-books-01` in region `us-east-005`. Browser code never receives B2 credentials or direct private download URLs.

Read and write credentials are intentionally separate:

- `B2_READ_KEY_ID` / `B2_READ_APPLICATION_KEY` — read proxy, catalogs, object existence checks, throttle/telemetry reads.
- `B2_WRITE_KEY_ID` / `B2_WRITE_APPLICATION_KEY` — Garden Keeper mutations, backups/trash, cover/EPUB writes, security-state writes/deletes.

## B2 object namespaces

| Namespace / key | Data | Readers | Writers / deleters |
| --- | --- | --- | --- |
| `shadow-garden/data/catalog.json` | Main Library private-source catalog | media proxy, book resolver, Garden Keeper | Garden Keeper catalog/library/upload/maintenance services |
| `shadow-garden/data/adult-catalog.json` | Adult Library private-source catalog | same | same |
| `shadow-garden/data/trash.json` | recoverable removed series/volume records | Garden Keeper maintenance | Garden Keeper maintenance/catalog operations |
| `shadow-garden/books/<series-or-managed-path>/*.epub` | private EPUB bytes | signed `/media/*` proxy, maintenance health checks | Garden Keeper upload/replace; purge may delete when explicitly authorized |
| `shadow-garden/covers/cv_<opaque-id>-detail.<ext>` | detail cover derivative | public `/media/*`, Keeper health/maintenance | upload/cover maintenance; Trash purge may delete |
| `shadow-garden/covers/cv_<opaque-id>-thumb.<ext>` | thumbnail cover derivative | public `/media/*`, Keeper health/maintenance | upload/cover maintenance; Trash purge may delete |
| `shadow-garden/backups/catalog-index.json` | bounded backup index | Garden Keeper history/maintenance | snapshot/restore/delete maintenance code |
| `shadow-garden/backups/catalogs/*.json` | private catalog snapshots | Garden Keeper history/restore | snapshot creation; retention cleanup / explicit backup deletion |
| `shadow-garden/security/admin-throttle/<opaque-id>.json` | Keeper failed-unlock state | admin throttle service | admin throttle service; successful auth clears it |
| `shadow-garden/security/abuse-state/<opaque-id>.json` | active public tripwire state | abuse service | abuse service; manual release/expiry cleanup deletes state |
| `shadow-garden/security/abuse-ledger.json` | bounded Abuse Watch event ledger | Garden Keeper Abuse Watch | abuse telemetry service |

### Storage safety rules

- Delete operations validate managed object keys and refuse traversal/backslash escape.
- raw client IP values are converted to HMAC-derived opaque IDs before persistent security storage.
- catalog backups are private/no-store and limited to the newest 30 snapshots.
- Trash moves do not immediately delete EPUB/cover bytes; permanent purge is the explicit destructive boundary.
- public cover object names created after v1.15.10 are opaque and do not encode series title, volume number or a source-image hash.

## Identity formats

### Public book ID

```text
bk_<22 Base64URL characters>
```

Current derivation is deterministic from the normalized private media path so an EPUB replacement can preserve an existing public ID where the previous volume identity is retained.

### Public cover storage ID

```text
cv_<20–64 Base64URL-safe characters>
```

Current Garden Keeper generation uses 16 random bytes (22 Base64URL characters) and produces paired `-detail` / `-thumb` keys. The upload endpoint rejects descriptive new cover keys outside the opaque pattern.

### Network/security IDs

Admin-throttle and abuse-state object filenames are truncated HMAC outputs derived from the network IP using `SG_MEDIA_SIGNING_SECRET`. They are deliberately opaque and must not be reverse-mapped or replaced by raw IP persistence during refactoring.

## Failure-model contract

Authorization and telemetry have different failure behavior:

- signed media/admin authorization must fail closed when the required security configuration/state cannot be trusted;
- public abuse telemetry is additive and generally fails open to the existing signed-ticket/Turnstile/acquisition layers if its optional telemetry store is unavailable;
- admin failed-unlock throttle is part of the authentication protection and therefore fails closed if its authoritative store cannot be used.

This distinction is a permanent refactor guardrail.
