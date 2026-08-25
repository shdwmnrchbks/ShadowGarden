# Garden Keeper Application Layer

**Refactor milestone:** R5 — Garden Keeper decomposition  
**Original release:** v1.20.0  
**Final cutover:** R10 / v2.0.0

R5 replaced Garden Keeper's page-wide bootstrap/enhancement chain with an explicit application root and feature-owned workflows. R10 removes the remaining dead R5-era owners and patch-style pathnames so the v2 source tree now matches that architecture directly.

## Composition

`src/admin.html` directly loads only the generated JSZip dependency plus:

- `admin/core.js` — shared runtime, state/events, reusable UI helpers, cover utilities, and the single admin client.
- `admin/app.js` — composition root. It loads the registered workflows and the contained Upload internals, initializes the workflows, and connects only explicit cross-workflow lifecycle events.

The application shell is `admin/shell.js`. It owns the New Books and Maintenance dialogs, series-targeted upload context, and post-unlock workspace presentation. It does not own authentication, catalog mutation, upload execution, backups, Trash, or abuse telemetry.

## Single admin client

`admin/core.js` contains the only `AdminClient`.

The client owns:

- Bearer `SG_ADMIN_TOKEN` attachment for `/admin-api/*` requests.
- `credentials: "same-origin"` so the signed `sg_admin_session` cookie accompanies protected requests.
- normalized JSON/error handling and bounded request timeouts.
- opaque `cv_...` cover-object naming and catalog payload rewrite for uploaded cover derivatives.
- the private in-memory authorization latch used by browser workflows.
- upload context normalization required by the existing batch engine.

A compatibility `window.api` / `window.uploadObject` facade remains only for the contained Upload engine. Those facades delegate directly to `AdminClient` and are not replaced by later scripts. This is a live compatibility boundary, not an obsolete patch owner.

## Authentication/session

`admin/auth-session.js` is the sole Authentication/session owner.

Unlock is ordered as follows:

1. obtain the `/admin-access` Turnstile challenge;
2. complete Turnstile using the `admin_access` action;
3. POST the keeper token + Turnstile token to `/admin-access`;
4. receive the signed, HttpOnly admin session cookie from the server;
5. verify `/admin-api/status` through `AdminClient` using both bearer token and signed session;
6. only then mark the private client authorization latch and UI as unlocked.

The visible `state.unlocked` value is a UI/workflow mirror, not the authorization boundary. Protected client calls require the private `AdminClient` latch, and the server independently requires both the bearer token and valid signed session. Lock immediately closes the client latch and explicitly deletes the server session.

The server-authoritative failed-unlock cooldown, HMAC network identity, raw-IP prohibition, and Turnstile policy are unchanged from Milestone 7.

## Library and Series workflow

`admin/library-workflow.js` is the single owner of Library management and Series editing. It directly renders manager cards and volume editors and owns:

- search and Main/18+ filtering;
- series metadata and canonical Complete/Ongoing/Hiatus/Dropped status;
- series-level audio-aligned EPUB folder URL;
- Main ↔ 18+ movement;
- volume metadata editing;
- series/volume Move to Trash behavior;
- series banner selection from volume covers;
- direct Add Book entry into the shell's targeted Upload context.

R10 deletes the old `admin-audio.js`, `admin-series-status.js`, `admin-series-banner.js`, `admin-series-editor-polish.js`, `admin-overhaul.js`, and original `admin.js` files rather than leaving them as dormant alternate implementations.

## Upload workflow

Upload remains intentionally composed because local EPUB validation and batch editing are substantial subsystems. Its final v2 internal order is explicit in `admin/app.js`:

1. `admin-batch.js` — batch queue, local reader-focused EPUB inspection, duplicate detection, catalog/upload transaction.
2. `admin/upload-safety.js` — replacement guard and actionable queue guidance.
3. `admin-batch-editor.js` — multi-EPUB editor selector.
4. `admin-upload-workflow.js` — stateful uploading/completion presentation and queue removal affordances.
5. `admin-upload-completion.js` — terminal transaction handoff.
6. `admin-upload-presentation.js` — editor restoration and uploaded-series chooser enrichment.
7. `admin/upload-events.js` — emits the explicit `upload:completed` lifecycle event.

R10 renames the last active `admin-upload-polish.js` path to `admin-upload-presentation.js`. The behavior is unchanged; only ownership is made semantic. The old `admin-preflight.js` and `admin-batch-safety.js` layers are deleted because the current batch engine and `admin/upload-safety.js` already own those responsibilities.

## Maintenance workflow

`admin/maintenance-workflow.js` owns Garden Health, deep B2 verification, catalog/object metrics, and cover optimization. Cover uploads use the shared client's opaque-cover contract. R10 deletes the old `admin-maintenance.js` implementation.

## History workflow

`admin/history-workflow.js` owns Catalog History: loading snapshots, manual backup creation, restore, and authenticated backup deletion. A restore invalidates Library data through an explicit application event. R10 deletes `admin-backup-history.js`.

## Trash workflow

`admin/trash-workflow.js` owns Trash & Recovery: listing soft-deleted entries, restoration, item purge, and purge-all. Library owns the action that *moves* a live series/volume into Trash; Trash owns everything after that boundary.

## Abuse workflow

`admin/abuse-workflow.js` owns Abuse Watch telemetry and explicit public-cooldown release. It continues to display only HMAC-derived network identifiers supplied by the server; no raw network identity is introduced in the browser. R10 deletes the retired `admin-abuse.js` owner.

## Version and reusable UI primitives

`admin/version.js` is the deployed-version component. Reusable state-pill, upload/file/status messaging, and toast primitives live under `ShadowGardenKeeper.ui` in `admin/core.js`. Dialog navigation/context belongs to `admin/shell.js` rather than being patched into unrelated workflows.

The obsolete `admin-bootstrap.js` and `admin-security.js` files are deleted in R10. `admin/core.js` + `admin/app.js` are the only Garden Keeper browser entrypoints in v2.

## Security invariants

The v2 cutover must not weaken any existing boundary:

- `/admin-api/*` requires the admin bearer token and signed admin session server-side.
- UI state alone cannot authorize a request.
- explicit Lock invalidates the browser client latch and server session.
- the server-side unlock cooldown remains authoritative across normal/Incognito windows on one public network.
- raw IP addresses are not persisted.
- cover uploads use opaque `cv_...` object names.
- private EPUB/B2 paths are not made public by the Keeper refactor.
- public Library, Series, Reader, signed media tickets, Range handling, and browser-local reading data are unchanged.

## Final R5/R10 acceptance

- Workflows initialize independently through `admin/app.js` and the shell registry.
- One admin client owns bearer/session/error behavior.
- Unlock requires `/admin-access` plus protected `/admin-api/status` validation before the client latch opens.
- Library/Series edit, Upload, Maintenance, Catalog History, Trash, and Abuse Watch each have explicit owners.
- No retired R5 browser owner remains in `src/assets/js/`.
- The active Upload presentation helper has a semantic filename.
- `tools/check-r5.mjs` and `tools/check-r10.mjs` guard the final composition and ownership contracts.
