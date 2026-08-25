# Shadow Garden v2 Baseline

**Refactor milestone:** R10 — Final cutover and v2 baseline  
**Baseline release:** v2.0.0  
**Security baseline:** Milestones 1–9 remain mandatory  
**Hosting:** Cloudflare Pages + private Backblaze B2

Shadow Garden v2 is the accepted result of the R0–R10 incremental refactor. This document is the post-refactor architecture baseline. The earlier `V1_BASELINE.md` remains historical evidence of the starting point; this file describes the final ownership model that future work must preserve or intentionally replace with equal or stronger regression coverage.

## Runtime surfaces

The machine-readable direct/runtime entrypoint contract is [`v2-entrypoints.json`](./v2-entrypoints.json).

Public surfaces:

- Main Library — `src/index.html` + `library.js` controller/model/renderers.
- Adult Library — `src/nsfw.html` through the same Library owners with explicit Adult scope.
- Series — `src/series.html` + `series.js` / `series-renderers.js`.
- Reader — `src/reader.html` + authorized `reader-bootstrap.js` / `reader/app.js` architecture.
- Garden Keeper — `src/admin.html` directly loads only `admin/core.js` + `admin/app.js` after JSZip; feature workflows are runtime-loaded by the composition root.

Server surfaces are thin Cloudflare Pages Function routes over `functions/services/`.

## Ownership model

### Domain and browser-local state

`src/assets/js/domain/` owns catalog normalization, public/private book identity compatibility, progress, bookmarks, reading state, preferences, URLs, formatting and storage helpers.

Canonical public reading states remain:

```text
Unread      -> Read
In Progress -> Continue
Finished    -> Read Again
```

Read Again clears Finished + progress aliases, preserves bookmarks, and reopens page 1 through `restart=1`.

### Public Library and Series

- `library.js` — controller/scope/query/filter/render lifecycle.
- `library-model.js` — search/filter/sort/Recently Added model.
- `library-renderers.js` — Grid/Compact/Recently Added/reading-banner rendering.
- `series.js` — Series controller.
- `series-renderers.js` — hero/banner/tags/volumes/primary CTA.
- `public/volume-actions.js` — one Read/Continue/Read Again action pipeline.

No post-render repair layer owns these surfaces.

### Reader

- `reader/book-session.js` — authorized book session and Read Again startup.
- `reader/app.js` — Reader orchestrator.
- `reader/rendition.js`, `reader/paginated.js`, `reader/continuous.js` — rendition/flow adapters.
- `reader/page-map.js` — canonical device Page Map.
- `reader/progress-controller.js`, `bookmarks-controller.js`, `completion.js` — reading-state presentation.
- `reader/page-navigation-input.js` — Pages-only horizontal swipe and desktop wheel navigation.
- `reader/image-focus.js` — isolated focused-image pinch/pan overlay.

Continuous EPUB documents receive no Reader-owned `touchmove` or page-wide `touch-action` override. Image zoom never transforms the live EPUB viewport.

### Responsive navigation

`nav.js` owns drawer lifecycle, body-level portal, focus/accessibility state and open/close behavior. `nav.css` owns geometry, semantic presentation, fixed-open header behavior, layout compensation, document/background scroll locking and drawer-only vertical scrolling.

The reconciled real-device contract is documented in [`MOBILE_NAVIGATION.md`](./MOBILE_NAVIGATION.md).

### Garden Keeper

`admin/core.js` is the sole AdminClient/runtime primitive owner and `admin/app.js` is the composition root.

First-class workflows:

- `admin/auth-session.js`
- `admin/library-workflow.js`
- `admin/maintenance-workflow.js`
- `admin/history-workflow.js`
- `admin/trash-workflow.js`
- `admin/abuse-workflow.js`
- `admin/version.js`
- `admin/shell.js`

Contained Upload internals:

- `admin-batch.js`
- `admin/upload-safety.js`
- `admin-batch-editor.js`
- `admin-upload-workflow.js`
- `admin-upload-completion.js`
- `admin-upload-presentation.js`
- `admin/upload-events.js`

R10 removes the old R5-era duplicate owners and the final `-polish` runtime pathname.

### Pages Functions

Thin route adapters call explicit services:

- `auth.js`
- `media.js`
- `catalog.js`
- `storage.js`
- `validation.js`
- `abuse.js`
- `http.js`
- `admin.js`

Accepted low-level cryptographic/throttle/identity primitives remain beneath the service layer in `functions/_lib/`.

## CSS and presentation ownership

Public/Keeper foundation tokens remain in `site.css`; Reader tokens remain Reader-scoped.

Garden Keeper direct CSS now uses semantic `admin-series-editor.css` and `admin-layout.css` paths. The R7 alias files are gone. No known permanent source filename uses release-history `current`, `polish`, `fix`, `patch`, hotfix or version-number ownership.

Authored `src/` does not carry local `?v=` cache-busting queries. `package.json#version` plus the R9 build-time asset-stamping helper is the sole local JS/CSS cache-busting owner in generated `dist/`.

## Security invariants

All Security Milestones 1–9 remain permanent contracts:

- private Backblaze B2 origin storage;
- signed media tickets;
- opaque `bk_...` public book identities;
- Turnstile/Garden Pass human verification;
- signed Garden Keeper sessions plus bearer token;
- server-authoritative Keeper cooldown;
- HMAC-derived abuse identities/state with no raw IP persistence;
- opaque `cv_...` cover object names;
- authorized `/media/*` Range delivery;
- M8 persistent public cooldown stays outside `/media/*`;
- public catalog output redacts private EPUB fields.

R8 additionally tightened media-ticket paths to the canonical `/media/shadow-garden/books/` namespace.

## Persistence invariants

Reading progress, bookmarks, Finished state, pinned state, Reader settings, Library view/filter preferences and Adult acknowledgement remain browser-local. R10 does not convert these to accounts or server state and does not discard still-live compatibility aliases required to read established browser data.

## Build and deployment

R9 remains the build/deployment foundation:

- Node 22 project runtime;
- committed npm lockfile v3;
- `npm ci` in read-only Verify CI;
- deterministic `build-context.mjs` metadata;
- generated/ignored `dist/`;
- no bundler;
- dependency-free local preview.

R10 adds the v2 release gate. A successful `main` Verify run is followed by a release workflow that waits for the matching v2 deployment on `shadowgarden-bon.pages.dev`, performs public production smoke requests, and only then creates the GitHub release/tag.

## Regression architecture

Permanent validation consists of:

- Security Milestones 1–9 checks;
- R0–R10 architecture guard scripts;
- Node unit/service/DOM/browser-contract test layers;
- production build verification;
- post-main production deployment smoke before release publication.

High-risk regression fixtures include Main/Adult catalogs, long metadata, single/multi-volume series, Read → Continue → Finished → Read Again, visual EPUB cover/map/illustration pages, signed ticket tamper/expiry cases, Reader Pages/Continuous input ownership, image-focus isolation, Keeper authorization/composition and mobile drawer viewport/scroll-lock behavior.

## Legacy cutover rule

`docs/architecture/r1-legacy-source-exceptions.json` has no grandfathered patch-style source files after R10. Its removed-file list is a tombstone contract: those retired paths must not return.

Compatibility that remains in v2 is intentional and documented (for example established browser-persistence aliases and the contained Upload engine's `window.api` facade). Future cleanup must distinguish live compatibility contracts from obsolete duplicate owners.

## v2 acceptance

The v2 baseline is accepted when:

- all R0–R10/security/test checks pass on the final R10 PR;
- the production build passes;
- R10 is squash-merged to `main`;
- `main` Verify passes on the merge commit;
- Cloudflare Pages serves the matching v2 version/commit and public smoke surfaces;
- the v2 GitHub release is published from that exact verified/deployed commit.
