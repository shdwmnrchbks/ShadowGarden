# Shadow Garden Build & Deployment Layer

**Milestone:** R9  
**Release:** v1.24.0  
**Status:** Complete

R9 finalizes Shadow Garden's dependency, build, preview, CI, and deployment-metadata ownership without changing the public/Reader/Keeper application architecture established by R0–R8.

## Build model

Shadow Garden remains an intentionally small **native static/module application**. R9 makes that pipeline deterministic rather than introducing a bundler solely for convention.

The production build remains:

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

R9 does **not** add Vite, Rollup, webpack, esbuild, Parcel, or another application bundler.

Reasons:

- the public UI and Reader already use explicit native module/runtime ownership;
- Pages Functions are already deployed as Cloudflare Function modules rather than a client bundle;
- EPUB.js and JSZip are intentionally copied as vendor browser assets by the build;
- existing asset-version stamping solves the current cache-invalidation requirement;
- no measured load-time, module-count, or deployment-size problem requires another transformation layer;
- introducing a bundler immediately before R10 would enlarge the regression surface for Reader and Functions without a demonstrated benefit.

R10 completed without finding a measured problem that warrants bundling, so the v2 baseline keeps this native/static decision. Future changes may revisit it only with production evidence and equivalent regression coverage.

## Dependency audit

R9 audited every direct dependency and retained all five because each has a current owner:

- `@aws-sdk/client-s3` — local Backblaze B2 setup/upload tooling (`tools/b2-setup.mjs`, `tools/b2-upload.mjs`).
- `aws4fetch` — Cloudflare Pages private-B2 S3 signing in `functions/services/storage.js`.
- `epubjs` — canonical Reader vendor runtime copied to `dist/assets/vendor/epub.min.js`.
- `fast-xml-parser` — EPUB package/container parsing in build and B2 upload tooling.
- `jszip` — EPUB archive parsing in build/upload tooling and browser vendor runtime copied to `dist/assets/vendor/jszip.min.js`.

R9 does not remove a live dependency merely to reduce package count. Dependency upgrades remain explicit changes requiring the complete regression suite.

## Lockfile and install contract

`package-lock.json` is now committed at npm lockfile version 3 and must match `package.json` name, version, engine, and direct dependency declarations.

Normal CI installs use:

```bash
npm ci --no-audit --no-fund --progress=false
```

`npm install` is no longer the verification install path. This makes CI resolve the exact committed transitive tree and fail when the manifest and lockfile disagree.

The project runtime remains **Node 22**:

- `.nvmrc` → `22`
- `package.json#engines.node` → `22.x`
- CI `setup-node` → Node 22

## CI action ownership

The Verify workflow remains read-only and pins actions to immutable commit SHAs:

- `actions/checkout` v7.0.1 → `3d3c42e5aac5ba805825da76410c181273ba90b1`
- `actions/setup-node` v7.0.0 → `820762786026740c76f36085b0efc47a31fe5020`

These current action generations use the supported Actions runtime while the Shadow Garden project itself continues to execute on Node 22.

## Deterministic build context

`tools/lib/build-context.mjs` is the single owner for deployment version/commit/branch/timestamp context.

It resolves:

1. version from `package.json`;
2. commit from Cloudflare/GitHub environment metadata, then local Git;
3. branch from Cloudflare/GitHub environment metadata, then local Git;
4. build timestamp from `SOURCE_DATE_EPOCH` when explicitly supplied;
5. otherwise the selected Git commit timestamp;
6. only when neither environment nor Git metadata can provide a timestamp, the current clock is a final fallback.

The same context is consumed by both `tools/build.mjs` and `tools/write-source.mjs`.

Consequences:

- asset cache-busting uses the same package release version as deployment metadata;
- locally generated catalog `generatedAt` uses the resolved build timestamp instead of an independent wall-clock call;
- `dist/data/version.json` uses the same version/commit/branch/timestamp contract;
- rebuilding the same commit with the same dependency tree produces stable metadata instead of inventing a new build timestamp.

## Asset ownership

`tools/lib/asset-versioning.mjs` remains the one cache-busting owner for copied local JS/CSS references. It rewrites copied `/assets/*.js` and `/assets/*.css` references in `dist/` to the package release version.

The build then copies the locked vendor browser assets:

- `node_modules/epubjs/dist/epub.min.js` → `dist/assets/vendor/epub.min.js`
- `node_modules/jszip/dist/jszip.min.js` → `dist/assets/vendor/jszip.min.js`

R10 removes historical local query strings from authored HTML/JS/CSS. Deployment output is still version-stamped centrally by the build, so source files never need manual release query bumps.

## Source and deployment metadata

`tools/write-source.mjs` owns the two generated deployment descriptors:

- `dist/data/source.json` — local versus private-B2 catalog source and catalog URLs.
- `dist/data/version.json` — Shadow Garden name, package version, commit, short commit, branch, and deterministic build timestamp.

Private B2 configuration remains source/runtime configuration; no B2 credential enters generated static output.

## Local preview

`tools/preview.mjs` replaces the previous unpinned `npx serve dist` command.

The preview server:

- uses Node 22 built-ins only;
- serves the generated `dist/` tree;
- supports GET/HEAD;
- applies explicit common MIME types and `Cache-Control: no-store`;
- rejects paths outside `dist/`;
- defaults to `127.0.0.1:4173`, with `HOST`/`PORT` overrides.

This removes a network-resolved, undeclared CLI dependency from the normal development workflow.

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

The private Backblaze B2 catalog/media architecture, `/media` proxy, Pages Functions, security contracts, and browser-local Reader state are unchanged by R9.

## Permanent R9 guard

`tools/check-r9.mjs` protects:

- v1.24.0+ release state;
- committed synchronized lockfile and Node 22 engine;
- read-only `npm ci` CI with immutable current action pins;
- dependency ownership and the explicit no-bundler decision;
- centralized deterministic build context usage;
- dependency-free preview ownership;
- generated `dist/` boundary;
- R9 documentation/roadmap/index state and R10-next status.

R10 may remove obsolete compatibility entrypoints after this build/deployment boundary is stable, but it must preserve the locked/deterministic verification contract unless it intentionally replaces it with an equal or stronger owner.
