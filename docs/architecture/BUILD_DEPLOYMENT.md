# Shadow Garden Build & Deployment Layer

**Milestone:** R9 baseline, extended through v2.11  
**Baseline release:** v1.24.0  
**Active deployment/product version:** v2.11.0 — Engineering Audit, Refactor & Optimization  
**Latest formal release:** v2.10.0  
**Status:** Active contract

R9 finalized Shadow Garden's dependency, build, preview, CI, and deployment-metadata ownership without changing the public/Reader/Keeper architecture established by R0–R8. Later v2 work retains that build model. v2.6 strengthened the release gate by requiring the exact `main` commit to pass both deterministic Verify and Real Browser E2E before production smoke and GitHub release publication. v2.10 added explicit release-metadata/documentation/runtime/lockfile maintenance guards. v2.11 uses the same build/release model while the active deployment line advances ahead of the latest formal release for an audit-first engineering phase.

See [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) for the authoritative version split and [`ENGINEERING_AUDIT.md`](./ENGINEERING_AUDIT.md) for the v2.11 evidence rules.

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

R10 and subsequent v2 work have not produced evidence that changes this decision. v2.11 may revisit it only if the engineering audit reproduces a material build/runtime bottleneck and equivalent regression/security behavior can be preserved. A bundler migration is not an audit default or roadmap quota.

## Dependency audit

The five direct production/tooling dependencies remain because each has a current owner:

- `@aws-sdk/client-s3` — local Backblaze B2 setup/upload tooling (`tools/b2-setup.mjs`, `tools/b2-upload.mjs`), using explicit static credentials.
- `aws4fetch` — Cloudflare Pages private-B2 S3 signing in `functions/services/storage.js`.
- `epubjs` — canonical Reader vendor runtime copied to `dist/assets/vendor/epub.min.js`.
- `fast-xml-parser` — EPUB package/container parsing in build and B2 upload tooling.
- `jszip` — EPUB archive parsing in build/upload tooling and browser vendor runtime copied to `dist/assets/vendor/jszip.min.js`.

The isolated `tests/e2e/` workspace has its own pinned Playwright dependency/lockfile. It does not become a production runtime dependency.

v2.11 audits whether these owners remain justified and correctly scoped; it does not remove or replace a dependency merely because an alternative exists.

## Lockfile and install contract

`package-lock.json` is committed at npm lockfile version 3 and must match `package.json#version`, package name, engine, and direct dependency declarations. The lockfile belongs to the **formal release/dependency graph**, not the active deployment label.

Current intentional v2.11 development state:

```text
package.json#version            2.10.0   latest formal release
package-lock.json root version  2.10.0   synchronized formal release/dependency graph
package.json#deploymentVersion  2.11.0   active deployed engineering-audit line
```

Never hand-edit transitive dependency versions, integrity hashes, or generated lockfile dependency metadata to change the displayed site version. A later formal v2.11.0 release cut, if performed, must change `package.json#version`, regenerate/synchronize lockfile root metadata through npm, add matching release notes/changelog metadata, and pass the permanent release gates.

Normal CI installs use:

```bash
npm ci --no-audit --no-fund --progress=false
```

The project runtime remains **Node 22**:

- `.nvmrc` → `22`
- `package.json#engines.node` → `22.x`
- CI `setup-node` → reviewed Node 22 policy

Real-browser CI separately runs `npm ci --prefix tests/e2e` against the E2E lockfile.

## CI action ownership

Verify and E2E workflows remain pinned to immutable action SHAs. Their source must remain reviewable and reproducible; workflow dependency updates are ordinary code changes and require the normal gates.

The current workflows are:

- `.github/workflows/verify.yml` — deterministic repository/security/behavioral checks plus production build;
- `.github/workflows/e2e.yml` — production build plus Chromium/Firefox/WebKit desktop and Chromium/WebKit mobile Playwright matrix, including monthly/manual reruns;
- `.github/workflows/baseline-health.yml` — monthly/manual deterministic security, recovery, realistic-scale performance, test, and build baseline;
- `.github/workflows/dependency-audit.yml` — policy-driven dependency/audit reporting;
- `.github/workflows/release-v2.yml` — verified formal v2 release publication.

Normal verification/maintenance workflows are read-only with respect to production state. The release workflow has only the additional permissions needed to inspect workflow results and create a GitHub release.

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

The private Backblaze B2 catalog/media architecture, `/media` proxy, Pages Functions, security contracts, and browser-local Reader state are unchanged by the v2.11 development-version split.

## Formal v2 release contract

`.github/workflows/release-v2.yml` remains reusable across the `2.x.y` formal release line. **`package.json#version` is the formal release source of truth.** A matching `docs/releases/v${VERSION}.md` file is required before a new release can be published.

`package.json#deploymentVersion` is deliberately not used to decide release eligibility. It identifies the active deployed product/development line only.

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

During v2.11 audit development, the publisher continues to see formal `package.json#version` 2.10.0. Because the verified v2.10.0 GitHub release already exists, ordinary v2.11 development commits do not create or rewrite that release. A final v2.11 release cut, if warranted, must explicitly converge `package.json#version`, lockfile root/workspace version metadata, `deploymentVersion`, changelog, and `docs/releases/v2.11.0.md` before the release gate can publish it.

The publisher checks whether the matching GitHub release already exists, confirms the exact SHA's Real Browser E2E push run before proceeding, waits for matching Cloudflare production deployment metadata, and fails closed if browser or production verification does not match.

The GitHub release is created only after public production smoke succeeds. Re-running the publisher for an already-existing release leaves the verified release unchanged.

## Historical release synchronization

Completed formal release metadata remains immutable history. v2.6 established the permanent exact-main browser release gate; v2.8 exercised development/formal version divergence; v2.9 added Keeper recovery/productivity ownership; v2.10 added explicit dependency/runtime/documentation/release/maintenance contracts and formally converged at 2.10.0.

The active v2.11 development line does not rewrite those release records.

## Permanent R9 guard and current guardrails

The permanent R9 guard in `tools/check-r9.mjs` continues to protect:

- committed synchronized formal lockfile and Node 22 engine;
- read-only `npm ci` CI with immutable action pins;
- dependency ownership and the no-bundler boundary;
- centralized deterministic build context usage;
- dependency-free preview ownership;
- generated `dist/` boundary.

`tools/check-v2-6.mjs` continues to protect the completed v2.6/v2.6.7 reliability baseline, including the Playwright workspace/project/artifact contracts and exact-main Real Browser E2E verification inside the v2 publisher.

v2.10 guardrails continue to protect controlled dependency maintenance, runtime/lockfile integrity, documentation freshness, formal release metadata, and scheduled baseline ownership.

The active deployment/release version split is documented in [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md), regression-covered by `tests/unit/build-context-version.test.mjs`, and intentionally set to deployment v2.11.0 / formal v2.10.0 during the engineering audit.
