# Shadow Garden Build & Deployment Layer

**Milestone:** R9 baseline, extended through v2.8  
**Baseline release:** v1.24.0  
**Active deployment/product version:** v2.8.0 — Reader Experience (in progress)  
**Latest formal release:** v2.6.7  
**Status:** Active contract

R9 finalized Shadow Garden's dependency, build, preview, CI, and deployment-metadata ownership without changing the public/Reader/Keeper architecture established by R0–R8. Later v2 work retains that build model. v2.6 strengthened the release gate by requiring the exact `main` commit to pass both deterministic Verify and Real Browser E2E before production smoke and GitHub release publication. v2.8 additionally distinguishes the active deployed product version from the latest completed formal release so slice development can identify itself accurately without prematurely creating a GitHub release.

See [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) for the authoritative version split.

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

R10 and subsequent v2 work have not produced evidence that changes this decision. Future performance work may revisit it only with measurements and equivalent regression coverage.

## Dependency audit

The five direct production/tooling dependencies remain because each has a current owner:

- `@aws-sdk/client-s3` — local Backblaze B2 setup/upload tooling (`tools/b2-setup.mjs`, `tools/b2-upload.mjs`).
- `aws4fetch` — Cloudflare Pages private-B2 S3 signing in `functions/services/storage.js`.
- `epubjs` — canonical Reader vendor runtime copied to `dist/assets/vendor/epub.min.js`.
- `fast-xml-parser` — EPUB package/container parsing in build and B2 upload tooling.
- `jszip` — EPUB archive parsing in build/upload tooling and browser vendor runtime copied to `dist/assets/vendor/jszip.min.js`.

The isolated `tests/e2e/` workspace has its own pinned Playwright dependency/lockfile. It does not become a production runtime dependency.

## Lockfile and install contract

`package-lock.json` is committed at npm lockfile version 3 and must match `package.json#version`, package name, engine, and direct dependency declarations. The lockfile belongs to the **formal release/dependency graph**, not the active deployment label.

Current intentional state while v2.8 is in progress:

```text
package.json#version            2.6.7   latest formal release
package-lock.json root version  2.6.7   synchronized formal release/dependency graph
package.json#deploymentVersion  2.8.0   active deployed product line
```

Never hand-edit transitive dependency versions, integrity hashes, or generated lockfile dependency metadata to change the displayed site version. When the formal v2.8.0 release is cut, regenerate the lockfile with npm after changing `package.json#version` to `2.8.0`.

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
- `.github/workflows/release-v2.yml` — verified formal v2 release publication.

Normal verification workflows are read-only. The release workflow has only the additional permissions needed to inspect workflow results and create the GitHub release.

## Deterministic build context

`tools/lib/build-context.mjs` is the single owner for deployment version/commit/branch/timestamp context.

It resolves:

1. `releaseVersion` from `package.json#version`;
2. active deployment `version` from `package.json#deploymentVersion`, falling back to `package.json#version` when no deployment override exists;
3. commit from Cloudflare/GitHub environment metadata, then local Git;
4. branch from Cloudflare/GitHub environment metadata, then local Git;
5. build timestamp from `SOURCE_DATE_EPOCH` when explicitly supplied;
6. otherwise the selected Git commit timestamp;
7. only when neither environment nor Git metadata can provide a timestamp, the current clock is a final fallback.

The same context is consumed by `tools/build.mjs` and `tools/write-source.mjs`.

Consequences:

- asset cache-busting uses the active deployment version;
- locally generated catalog `generatedAt` uses the resolved build timestamp instead of an independent wall-clock call;
- `dist/data/version.json` exposes both active deployment `version` and formal `releaseVersion`, plus commit/branch/timestamp identity;
- rebuilding the same commit with the same dependency tree produces stable metadata instead of inventing a new build timestamp.

## Asset ownership

`tools/lib/asset-versioning.mjs` remains the one cache-busting owner for copied local JS/CSS references. It rewrites copied `/assets/*.js` and `/assets/*.css` references in `dist/` to the active deployment version supplied by build context.

The build copies locked vendor browser assets:

- `node_modules/epubjs/dist/epub.min.js` → `dist/assets/vendor/epub.min.js`
- `node_modules/jszip/dist/jszip.min.js` → `dist/assets/vendor/jszip.min.js`

Authored source does not carry manual release query bumps.

## Source and deployment metadata

`tools/write-source.mjs` owns:

- `dist/data/source.json` — local versus private-B2 catalog source and catalog URLs.
- `dist/data/version.json` — Shadow Garden name, active deployment version, formal release version, commit, short commit, branch, and deterministic build timestamp.

Private B2 configuration remains source/runtime configuration; no B2 credential enters generated static output.

The public Library footer and Garden Keeper version component both fetch `/data/version.json` with `cache: no-store` and display its active `version`. Public surfaces must not hard-code a current version string.

## Local preview

`tools/preview.mjs` is the dependency-free production preview server. It:

- uses Node 22 built-ins only;
- serves generated `dist/`;
- supports GET/HEAD;
- applies explicit common MIME types and `Cache-Control: no-store`;
- rejects paths outside `dist/`;
- defaults to `127.0.0.1:4173`, with `HOST`/`PORT` overrides.

The Playwright workspace uses this production preview path rather than a second application server.

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

The private Backblaze B2 catalog/media architecture, `/media` proxy, Pages Functions, security contracts, and browser-local Reader state are unchanged by the v2.8 version-label split.

## Formal v2 release contract

`.github/workflows/release-v2.yml` remains reusable across the `2.x.y` formal release line. **`package.json#version` is the formal release source of truth.** A matching `docs/releases/v${VERSION}.md` file is required before a new release can be published.

`package.json#deploymentVersion` is deliberately not used to decide release eligibility. It identifies the active deployed product line only.

A formal release is eligible only for the exact `main` commit that satisfied the gates. The sequence remains:

```text
formal release version + matching release notes
   |
main commit
   |
   +--> Verify Shadow Garden: success
   |
   +--> Real Browser E2E: success for the same SHA
   |      Chromium / Firefox / WebKit desktop
   |      Chromium Mobile / WebKit Mobile
   |
   +--> Cloudflare production reports same formal/deployment version + commit
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

During v2.8 slice development, the publisher continues to see formal `package.json#version` 2.6.7. Because the verified v2.6.7 GitHub release already exists, ordinary v2.8 deployment commits do not create a new release. At final v2.8 cutover, `package.json#version`, generated lockfile root/workspace version, `deploymentVersion`, and `docs/releases/v2.8.0.md` converge on 2.8.0 before the release gate runs.

The publisher checks whether the matching GitHub release already exists, confirms the exact SHA's Real Browser E2E push run before proceeding, waits for matching Cloudflare production deployment metadata, and fails closed if browser or production verification does not match.

The GitHub release is created only after public production smoke succeeds. Re-running the publisher for an already-existing release leaves the verified release unchanged.

## Historical v2.6 release synchronization contract

For v2.6.0 the following records were required to agree before release:

- `package.json` → `2.6.0`;
- root and workspace entry in `package-lock.json` → `2.6.0`;
- `docs/releases/v2.6.0.md` exists;
- `CHANGELOG.md` records v2.6.0 (and the previously omitted v2.5.0 history);
- root/documentation indexes identify the release correctly;
- `docs/roadmaps/CURRENT_ROADMAP.md` records v2.6 complete;
- `tools/check-v2-6.mjs` enforces the completed v2.6 baseline through the v2.6.7 hotfix line.

The latest completed release metadata remains v2.6.7 while active deployment metadata is v2.8.0.

## Permanent R9 guard and current guardrails

The Permanent R9 guard in `tools/check-r9.mjs` continues to protect:

- committed synchronized lockfile and Node 22 engine;
- read-only `npm ci` CI with immutable action pins;
- dependency ownership and the no-bundler boundary;
- centralized deterministic build context usage;
- dependency-free preview ownership;
- generated `dist/` boundary.

`tools/check-v2-6.mjs` continues to protect the completed v2.6/v2.6.7 reliability baseline, including:

- formal root package/lock version synchronization;
- Playwright workspace/project/artifact contracts;
- v2.6 release notes/changelog/docs/roadmap history;
- exact-main Real Browser E2E verification inside the v2 publisher.

The active deployment/release version split is documented in [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) and regression-covered by `tests/unit/build-context-version.test.mjs`.
