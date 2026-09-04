# Shadow Garden v2.11.0 Development

Shadow Garden is a self-hosted EPUB library and browser Reader built for Cloudflare Pages. EPUBs, covers, catalogs, security state, and maintenance data live in a **private Backblaze B2 bucket** and are delivered or managed through same-origin Cloudflare Pages Functions. Private administration is handled by the **Garden Keeper** console.

Production: `https://shadowgarden-bon.pages.dev/`

The accepted architecture baseline remains **v2.0.0**. The latest formal release is **v2.10.0 — Maintenance & Supply Chain**. The active development line is **v2.11.0 — Engineering Audit, Refactor & Optimization**.

Shadow Garden has enough product features for the current operating horizon. v2.11 is therefore an **audit-first engineering-health phase**, not a feature expansion. The codebase will be audited for ownership, maintainability, dead/compatibility code, test seams, and realistic-scale performance. Refactoring and optimization are conditional: if the audit finds no material structural problem or bottleneck, those phases are explicitly skipped/deferred.

- Current roadmap: [`docs/roadmaps/CURRENT_ROADMAP.md`](./docs/roadmaps/CURRENT_ROADMAP.md)
- Engineering audit contract: [`docs/architecture/ENGINEERING_AUDIT.md`](./docs/architecture/ENGINEERING_AUDIT.md)
- Documentation index: [`docs/README.md`](./docs/README.md)
- Latest formal release: [`docs/releases/v2.10.0.md`](./docs/releases/v2.10.0.md)
- Completed planning archive: [`docs/archive/README.md`](./docs/archive/README.md)

## Current feature set

### Library and Series

- Separate Main and 18+ / Adult archives with explicit scope.
- Recently Added, progress-aware reading banner, reading suggestions, and pinned Series.
- Search, author, fan-translator, genre, year, volume-count, reading-status, pinned, exact-tag filters, sorting, URL persistence, Back/Forward restoration, and Grid/Compact rendering.
- Canonical browser-local states: **Unread → Read**, **In Progress → Continue**, **Finished → Read Again**.
- Shared canonical volume-action ownership across Library, Series, Recently Added, and reading-banner entry points.
- Series metadata, fan-translation provenance, banners/covers, volume actions, and tag navigation.

### EPUB Reader

- EPUB.js-based **Pages** and **Continuous** modes behind one Reader application layer.
- Authorized opaque `bk_...` book-session boundary and private EPUB source identity.
- Canonical device Page Map shared by both flows.
- Publication-owned Default typography plus supported Sans, Serif, and Sans-Serif choices.
- Canonical page/percentage/chapter progress presentation.
- Contents filtering, Current-location recovery, bounded whole-book CFI-backed search, Reader-owned footnote/endnote popups, and hardened resume/error recovery.
- Persistent browser-local progress, bookmarks, Finished state, themes, typography, flow, and layout preferences.
- Pages-only horizontal swipe/wheel navigation; Continuous preserves native vertical scrolling and receives no Reader-owned EPUB-document `touchmove` interception.
- Isolated image focus with pinch/pan while magnified without moving the live EPUB location.
- Protected media-ticket renewal after background/sleep-style resume.
- Reader reliability and accessibility are permanently covered across Chromium, Firefox, WebKit, Chromium Mobile, and WebKit Mobile.

### Garden Keeper

- Turnstile + Keeper-token protected administration with signed server-side sessions.
- Library/Series editing, translation metadata, multi-EPUB upload/preflight, duplicate/similar-volume warnings, safe batch edits with preview, artwork workflows, Maintenance, History, Trash, Recovery Readiness, Garden Health, and Abuse Watch.
- Catalog snapshots/checksums, recovery anchors, last-recoverable-state protection, and deterministic recovery drills.
- Busy/error guards and keyboard-contained dialogs with focus restoration.

### Pages Functions and storage

- Thin route adapters over explicit `auth`, `media`, `catalog`, `storage`, `validation`, `abuse`, `http`, and admin services.
- Private Backblaze B2 origin storage.
- Signed EPUB authorization and HTTP Range delivery.
- Existing `/media/*`, `/book-access`, `/human-access`, `/admin-access`, and `/admin-api/*` security contracts remain unchanged.
- Production B2 transport is owned by `functions/services/storage.js` through `aws4fetch`; optional local operator B2 utilities use the AWS S3 client with explicit static credentials.

### Accessibility and motion

- Keyboard focus treatment, dialog/drawer focus restoration, reduced motion, increased contrast, forced colors, browser zoom, and mobile touch targets are permanent contracts.
- Publication-owned EPUB accessibility is documented separately from Shadow Garden-owned application chrome.
- Motion remains progressive enhancement/observer-only and cannot become a state, request, workflow, or persistence owner.

## v2.11 engineering audit

The v2.11 audit is governed by [`docs/architecture/ENGINEERING_AUDIT.md`](./docs/architecture/ENGINEERING_AUDIT.md).

Every material finding is classified as one of:

- **No action** — healthy area; record evidence and leave it alone.
- **Cleanup** — dead/stale/duplicate material that can be removed without ownership redesign.
- **Targeted refactor** — demonstrated ownership/maintainability/reliability/testability problem with a clear replacement owner.
- **Measured optimization** — reproduced realistic-scale bottleneck with before/after evidence.
- **Deferred** — valid concern without enough present value to justify the risk/cost.

Refactor and optimization work are not roadmap quotas. A clean audit with no refactor and/or no optimization is a successful v2.11 outcome.

Audit coverage includes:

- shared browser domain/state;
- Library + Series model/render/action ownership;
- Reader session, adapters, Page Map/progress, input, image focus, search/TOC/notes, resume/ticket lifecycle;
- Garden Keeper workflows and batch-operation/network/catalog costs;
- Pages Function route/service/storage/auth boundaries;
- CSS/design-system duplication and compatibility rules;
- build/tool/test ownership and obsolete milestone-era guards;
- realistic 250–300-series Library behavior and representative large-EPUB Reader paths.

No framework rewrite, bundler migration, speculative virtualization, server-side Reader history, or 1,000+ series optimization project is authorized without evidence.

## Test architecture

Shadow Garden combines deterministic, real-browser, and recurring maintenance-health layers.

### Deterministic layers

- `tests/unit/` — domain/model/input helpers.
- `tests/service/` — auth, media, validation, catalog/administrative service boundaries.
- `tests/dom/` — renderer ownership against narrow DOM doubles.
- `tests/browser/` — deterministic browser-facing source/interaction contracts and fixtures.

These use Node 22's built-in test runner and remain fast/offline. `npm test` runs the complete deterministic behavioral suite. `npm run check` additionally enforces dependency/runtime, documentation, release-metadata, maintenance-baseline, and realistic-scale contracts.

### Real Browser E2E

`tests/e2e/` is an isolated Playwright workspace pinned to **1.62.1** with its own committed lockfile. CI runs five projects:

- Chromium desktop
- Firefox desktop
- WebKit desktop
- Chromium Mobile
- WebKit Mobile

The suite builds and serves real production `dist/`, while deterministic fixture routes replace production catalog/B2/service dependencies. It covers public Library/Series paths, Reader lifecycle and high-risk input/persistence/compatibility behavior, Garden Keeper workflows, and accessibility/focus/zoom/contrast/mobile contracts.

Failure runs retain Playwright traces, screenshots, video, HTML reports, and browser diagnostics. Monthly baselines rerun deterministic security/recovery/realistic-scale health and the complete browser matrix.

See [`docs/architecture/TEST_ARCHITECTURE.md`](./docs/architecture/TEST_ARCHITECTURE.md), [`docs/architecture/ACCESSIBILITY_TESTING.md`](./docs/architecture/ACCESSIBILITY_TESTING.md), and [`docs/architecture/MAINTENANCE_BASELINE.md`](./docs/architecture/MAINTENANCE_BASELINE.md).

## Security baseline

Security Milestones **1–9 are complete** and remain permanent contracts: private B2 origin storage, signed EPUB tickets, opaque `bk_...` identifiers, Garden Pass/Turnstile, acquisition throttling, crawler screening, Reader anti-indexing, signed Garden Keeper sessions, server-side cooldowns, HMAC-derived abuse controls, private Abuse Watch telemetry, and opaque cover keys.

Browser-local progress, bookmarks, Finished state, pinned state, Reader settings, Library preferences, and Adult acknowledgement remain local to the browser/profile. v2.11 introduces no server-side Reader account/history.

The completed security roadmap is archived at [`docs/archive/SECURITY_ROADMAP.md`](./docs/archive/SECURITY_ROADMAP.md).

## Architecture baseline and completed planning

The R0–R10 full-codebase refactor is complete. `main` remains deployable, Security Milestones 1–9 and browser-local persistence contracts remain protected by CI, and the v2 source tree has explicit owners instead of accumulated patch layers.

- v2 architecture baseline: [`docs/architecture/V2_BASELINE.md`](./docs/architecture/V2_BASELINE.md)
- Domain/state: [`docs/architecture/DOMAIN_LAYER.md`](./docs/architecture/DOMAIN_LAYER.md)
- Library/Series: [`docs/architecture/PUBLIC_UI_LAYER.md`](./docs/architecture/PUBLIC_UI_LAYER.md)
- Reader: [`docs/architecture/READER_LAYER.md`](./docs/architecture/READER_LAYER.md)
- Garden Keeper: [`docs/architecture/KEEPER_LAYER.md`](./docs/architecture/KEEPER_LAYER.md)
- Pages Functions: [`docs/architecture/FUNCTIONS_LAYER.md`](./docs/architecture/FUNCTIONS_LAYER.md)
- CSS/design system: [`docs/architecture/DESIGN_SYSTEM.md`](./docs/architecture/DESIGN_SYSTEM.md)
- Build/deployment: [`docs/architecture/BUILD_DEPLOYMENT.md`](./docs/architecture/BUILD_DEPLOYMENT.md)
- Versioning: [`docs/architecture/VERSIONING_CONTRACT.md`](./docs/architecture/VERSIONING_CONTRACT.md)

Completed planning is under [`docs/archive/`](./docs/archive/):

- R0–R10 refactor roadmap
- Security & Anti-Abuse roadmap
- v2.6–v2.10 product/reliability/operations roadmap
- v2.8 footnote/endnote audit
- v2.5 motion milestone records
- completed security milestone records

`docs/roadmaps/` now contains only the active v2.11 roadmap and its index.

## Current architecture

```text
Main / Adult Library                 Series
        |                              |
        v                              v
 library.js                       series.js
      |                               |
      +--> library-model.js           +--> series-renderers.js
      +--> library-renderers.js       |
      +-----------+-------------------+
                  |
                  v
        public/volume-actions.js
                  |
                  v
              domain/
  catalog · identity · reading-state
  progress · bookmarks · preferences
  storage · urls · format

Reader bootstrap
      |
      v
reader/book-session.js
      |
      v
reader/app.js
  ├─ rendition + paginated + continuous
  ├─ progress + bookmarks + completion
  ├─ settings + theme
  ├─ page-navigation-input
  ├─ image-focus
  └─ Page Map + retained EPUB.js compatibility layers

Garden Keeper
      |
      v
admin/core.js + admin/app.js
  ├─ Authentication/session
  ├─ Library/Series + translation metadata
  ├─ Upload workflow internals
  ├─ Maintenance
  ├─ Catalog History
  ├─ Trash & Recovery
  ├─ Abuse Watch
  └─ version + shell UI
      |
      v
single AdminClient
      |
      v
Cloudflare Pages Function routes
      |
      v
functions/services/
  ├─ auth + media + abuse
  ├─ catalog + validation + admin
  └─ storage + http
      |
      +--> private Backblaze B2

Regression architecture
      |
      +--> tests/unit + service + dom + browser
      |       └─ deterministic Node 22 suite
      |
      +--> tests/e2e
              └─ Chromium / Firefox / WebKit
                 desktop + Chromium/WebKit mobile

Build/deployment
      |
      +--> package.json + package-lock.json
      +--> npm ci / Node 22
      +--> deterministic build context
      +--> generated dist/
      +--> Verify + Real Browser E2E
      +--> monthly baseline health
      └--> matching Cloudflare deployment + verified release publisher
```

## Repository layout

```text
.
├─ README.md
├─ CHANGELOG.md
├─ package.json
├─ package-lock.json
├─ docs/
│  ├─ architecture/
│  ├─ releases/
│  ├─ roadmaps/
│  ├─ archive/
│  ├─ security/
│  └─ style/
├─ src/
├─ functions/
├─ tests/
└─ tools/
```

## Backblaze B2

```text
Bucket:   shadow-garden-books-01
Endpoint: https://s3.us-east-005.backblazeb2.com
Region:   us-east-005
Proxy:    /media
```

Primary namespaces are under `shadow-garden/books/`, `covers/`, `data/`, `backups/`, and `security/`. The bucket remains private; direct B2 URLs and credentials are not the public delivery mechanism.

## Required Cloudflare secrets

```text
B2_READ_KEY_ID
B2_READ_APPLICATION_KEY
B2_WRITE_KEY_ID
B2_WRITE_APPLICATION_KEY
SG_ADMIN_TOKEN
SG_MEDIA_SIGNING_SECRET
SG_TURNSTILE_SITE_KEY
SG_TURNSTILE_SECRET_KEY
```

Never commit application keys, signing secrets, Turnstile secrets, or `SG_ADMIN_TOKEN`.

## Cloudflare Pages settings

```text
Framework preset:       None
Production branch:      main
Build command:          npm run build
Build output directory: dist
Root directory:         repository root
```

Shadow Garden remains compatible with the free `pages.dev` deployment; a custom domain is not required.

## Development and validation

Use Node.js 22 and the committed lockfile.

```bash
npm ci
npm test
npm run test:unit
npm run test:service
npm run test:dom
npm run test:browser
npm run check
npm run build
npm run test:e2e
npm run preview
```

Pull requests and `main` run `.github/workflows/verify.yml` and `.github/workflows/e2e.yml`. Verify executes repository/security/deterministic regression checks and the production build; Real Browser E2E runs the five-project Playwright matrix. Monthly baseline workflows rerun deterministic security/recovery/realistic-scale health and the complete browser matrix.

For formal v2 releases, `.github/workflows/release-v2.yml` publishes only after the exact `main` commit has successful Verify and Real Browser E2E results, Cloudflare production reports the matching formal version + commit, and the public smoke checks pass.

Optional desktop B2 utilities:

```bash
npm run b2:setup
npm run b2:upload -- "path/to/book.epub"
```

## Documentation

Start with [`docs/README.md`](./docs/README.md). See [`CHANGELOG.md`](./CHANGELOG.md) for formal release history, [`docs/roadmaps/CURRENT_ROADMAP.md`](./docs/roadmaps/CURRENT_ROADMAP.md) for the active v2.11 audit/refactor/optimization plan, [`docs/architecture/ENGINEERING_AUDIT.md`](./docs/architecture/ENGINEERING_AUDIT.md) for the audit decision contract, and [`docs/releases/v2.10.0.md`](./docs/releases/v2.10.0.md) for the latest formal release record.
