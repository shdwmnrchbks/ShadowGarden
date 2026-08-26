# Shadow Garden Build & Deployment Layer

**Milestone:** R9 baseline, extended through v2.6  
**Baseline release:** v1.24.0  
**Current release:** v2.6.0  
**Status:** Active contract

R9 finalized Shadow Garden's dependency, build, preview, CI, and deployment-metadata ownership without changing the public/Reader/Keeper architecture established by R0–R8. Later v2 releases retain that build model. v2.6 strengthens the release gate by requiring the exact `main` commit to pass both deterministic Verify and Real Browser E2E before production smoke and GitHub release publication.

## Build model

Shadow Garden remains an intentionally small **native static/module application**. The production build is:

```text
committed src/ + committed tooling + locked npm dependencies + build context
                                ↓
                         tools/build.mjs
                                ↓
                              dist/
                                ↓
                      tools/write-source.mjs
```

`dist/` remains generated and ignored. No production module may require a hand-edited file under `dist/`.

## Deliberate no-bundler decision

Shadow Garden does **not** add Vite, Rollup, webpack, esbuild, Parcel, or another application bundler without measured need.

Reasons:

- public UI and Reader already use explicit native module/runtime ownership;
- Pages Functions deploy as Cloudflare Function modules rather than a client bundle;
- EPUB.js and JSZip are intentionally copied as vendor browser assets by the build;
- centralized asset-version stamping solves the current cache-invalidation requirement;
- no measured startup/module-count/deployment-size problem requires another transformation layer;
- additional build transformation would enlarge the Reader/Functions regression surface without demonstrated benefit.

R10 and v2.1–v2.6 have not produced evidence that changes this decision. Future performance work may revisit it only with measurements and equivalent regression coverage.

## Dependency audit

The five direct production/tooling dependencies remain because each has a current owner:

- `@aws-sdk/client-s3` — local Backblaze B2 setup/upload tooling (`tools/b2-setup.mjs`, `tools/b2-upload.mjs`).
- `aws4fetch` — Cloudflare Pages private-B2 S3 signing in `functions/services/storage.js`.
- `epubjs` — canonical Reader vendor runtime copied to `dist/assets/vendor/epub.min.js`.
- `fast-xml-parser` — EPUB package/container parsing in build and B2 upload tooling.
- `jszip` — EPUB archive parsing in build/upload tooling and browser vendor runtime copied to `dist/assets/vendor/jszip.min.js`.

The isolated `tests/e2e/` workspace has its own pinned Playwright dependency/lockfile. It does not become a production runtime dependency.

## Lockfile and install contract

`package-lock.json` is committed at npm lockfile version 3 and must match `package.json` name, version, engine, and direct dependency declarations. Release reconciliation also requires the root package and lockfile versions to match exactly.

Normal CI installs use:

```bash
npm ci --no-audit --no-fund --progress=false
```

The project runtime remains **Node 22**:

- `.nvmrc` → `22`
- `package.json#engines.node` → `22.x`
- CI `setup-node` → Node 22

Real-browser CI separately runs `npm ci --prefix tests/e2e` against the E2E lockfile.

## CI action ownership

Verify and E2E workflows remain pinned to immutable action SHAs. Their source must remain reviewable and reproducible; workflow dependency updates are ordinary code changes and require the normal gates.

The current workflows are:

- `.github/workflows/verify.yml` — deterministic repository/security/behavioral checks plus production build;
- `.github/workflows/e2e.yml` — production build plus Chromium/Firefox/WebKit desktop and Chromium/WebKit mobile Playwright matrix;
- `.github/workflows/release-v2.yml` — verified v2 release publication.

Normal verification workflows are read-only. The release workflow has only the additional permissions needed to inspect workflow results and create the GitHub release.

## Deterministic build context

`tools/lib/build-context.mjs` is the single owner for deployment version/commit/branch/timestamp context.

It resolves:

1. version from `package.json`;
2. commit from Cloudflare/GitHub environment metadata, then local Git;
3. branch from Cloudflare/GitHub environment metadata, then local Git;
4. build timestamp from `SOURCE_DATE_EPOCH` when explicitly supplied;
5. otherwise the selected Git commit timestamp;
6. only when neither environment nor Git metadata can provide a timestamp, the current clock is a final fallback.

The same context is consumed by `tools/build.mjs` and `tools/write-source.mjs`.

Consequences:

- asset cache-busting uses the same package release version as deployment metadata;
- locally generated catalog `generatedAt` uses the resolved build timestamp instead of an independent wall-clock call;
- `dist/data/version.json` uses the same version/commit/branch/timestamp contract;
- rebuilding the same commit with the same dependency tree produces stable metadata instead of inventing a new build timestamp.

## Asset ownership

`tools/lib/asset-versioning.mjs` remains the one cache-busting owner for copied local JS/CSS references. It rewrites copied `/assets/*.js` and `/assets/*.css` references in `dist/` to the package release version.

The build copies locked vendor browser assets:

- `node_modules/epubjs/dist/epub.min.js` → `dist/assets/vendor/epub.min.js`
- `node_modules/jszip/dist/jszip.min.js` → `dist/assets/vendor/jszip.min.js`

Authored source does not carry manual release query bumps.

## Source and deployment metadata

`tools/write-source.mjs` owns:

- `dist/data/source.json` — local versus private-B2 catalog source and catalog URLs.
- `dist/data/version.json` — Shadow Garden name, package version, commit, short commit, branch, and deterministic build timestamp.

Private B2 configuration remains source/runtime configuration; no B2 credential enters generated static output.

`dist/data/version.json` is also the deployment identity used by the v2 release publisher: publication cannot proceed until production reports both the intended version and the exact verified `main` commit.

## Local preview

`tools/preview.mjs` is the dependency-free production preview server. It:

- uses Node 22 built-ins only;
- serves generated `dist/`;
- supports GET/HEAD;
- applies explicit common MIME types and `Cache-Control: no-store`;
- rejects paths outside `dist/`;
- defaults to `127.0.0.1:4173`, with `HOST`/`PORT` overrides.

The v2.6 Playwright workspace uses this production preview path rather than a second application server.

## Cloudflare Pages contract

Cloudflare Pages continues to build Shadow Garden with:

```bash
npm ci
npm run build
```

Build output remains:

```text
dist/
```

The private Backblaze B2 catalog/media architecture, `/media` proxy, Pages Functions, security contracts, and browser-local Reader state are unchanged by v2.6.

## Verified v2 release contract

`.github/workflows/release-v2.yml` is reusable across the `2.x.y` release line. The package version is the release source of truth and must have a matching `docs/releases/v${VERSION}.md` file.

A release is eligible only for the exact `main` commit that satisfied the gates. The sequence is:

```text
main commit
   |
   +--> Verify Shadow Garden: success
   |
   +--> Real Browser E2E: success for the same SHA
   |      Chromium / Firefox / WebKit desktop
   |      Chromium Mobile / WebKit Mobile
   |
   +--> Cloudflare production reports same version + commit
   |
   +--> production smoke
   |      /          Main Library marker
   |      /nsfw.html Adult Library marker
   |      /series.html
   |      /reader.html
   |      /robots.txt media disallow
   |
   +--> GitHub tag/release v${VERSION}
```

The publisher is triggered by a successful main Verify run, checks whether the matching GitHub release already exists, and then confirms the exact SHA's Real Browser E2E push run before proceeding. It must fail rather than publish if that browser run completes unsuccessfully or never becomes successful within the bounded polling window.

The production wait also fails closed if `/data/version.json` never matches both version and commit. A successful older deployment is not sufficient.

The GitHub release is created only after the public production smoke succeeds. Re-running the publisher for an already-existing release leaves the verified release unchanged.

## v2.6 release synchronization contract

For v2.6.0 the following records must agree before merge:

- `package.json` → `2.6.0`;
- root and workspace entry in `package-lock.json` → `2.6.0`;
- `docs/releases/v2.6.0.md` exists;
- `CHANGELOG.md` records v2.6.0 (and the previously omitted v2.5.0 history);
- root/documentation indexes identify v2.6.0 as the current release;
- `docs/roadmaps/CURRENT_ROADMAP.md` records v2.6 complete and advances active work to v2.7.0;
- `tools/check-v2-6.mjs` enforces the synchronization and release gate.

Production version metadata is generated from the package/build context and therefore joins this contract automatically after deployment.

## Permanent R9 guard and current guardrails

The Permanent R9 guard in `tools/check-r9.mjs` continues to protect:

- committed synchronized lockfile and Node 22 engine;
- read-only `npm ci` CI with immutable action pins;
- dependency ownership and the no-bundler boundary;
- centralized deterministic build context usage;
- dependency-free preview ownership;
- generated `dist/` boundary.

`tools/check-v2-6.mjs` adds current-release protection for:

- root package/lock version synchronization;
- Playwright workspace/project/artifact contracts;
- release notes/changelog/docs/roadmap synchronization;
- exact-main Real Browser E2E verification inside the v2 publisher.

Future releases should extend these owners rather than introducing a parallel release script or deployment metadata source.
