# Source, Build, and Tooling Contract

**Refactor milestones:** R1 repository/tooling hygiene; finalized by R9 build/deployment cleanup  
**Baseline application:** v1.15.14  
**Current build contract:** v1.24.0

This document defines which files are authored, which are generated, how local assets are versioned, and what tooling is intentionally pinned during the refactor. R1 established the boundary; R9 finalizes dependency locking, deterministic build metadata, CI installation, and preview ownership. See [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) for the R9 architecture and audit detail.

## Authored vs generated

Authored and committed:

- `src/` — static Library, Series, Reader, and Garden Keeper source.
- `functions/` — Cloudflare Pages Functions and shared server helpers.
- `tests/` — deterministic R8 unit, service/integration, DOM, browser-smoke fixtures and test helpers.
- `tools/` — build, upload, validation, test runner, preview server, build context, and refactor guardrails.
- `library/` — local EPUB/build input and non-secret library configuration/placeholder files.
- `docs/` — architecture, roadmap, security history, and style guidance.
- root project/config files such as `package.json`, `package-lock.json`, `.gitignore`, `.nvmrc`, README, and CHANGELOG.

Generated and never committed:

- `dist/` — complete Cloudflare Pages static output.
- `node_modules/` — installed npm dependency tree.
- `dist/assets/vendor/epub.min.js` — copied from the locked `epubjs` package by `tools/build.mjs`.
- `dist/assets/vendor/jszip.min.js` — copied from the locked `jszip` package by `tools/build.mjs`.
- `dist/data/catalog.json` / `dist/data/adult-catalog.json` when produced from local library input.
- `dist/data/source.json` — generated catalog source descriptor.
- `dist/data/version.json` — generated deployment metadata.

`dist/` must remain reproducible from committed source plus locked dependencies and resolved build metadata. No source module may depend on editing `dist/` directly.

## Node and CI

Shadow Garden standardizes the development/verification Node major on **Node 22**:

- `.nvmrc` contains `22` for compatible local version managers.
- `package.json#engines.node` is `22.x`.
- GitHub Actions explicitly installs Node 22 for project commands.
- CI action revisions remain pinned to immutable commit SHAs rather than floating tags.
- R9 upgrades checkout/setup-node to current supported action generations while preserving the project Node 22 runtime.

R8 uses the same Node boundary for tests: `tools/run-tests.mjs` uses the built-in Node test runner, so the test architecture does not introduce a second runtime or a test-only framework dependency.

Formatting/linting remains intentionally separate from architecture changes; a repository-wide formatter must not be smuggled into a functional refactor slice.

## Finalized dependency policy

R9 resolves the lockfile deferral from R1.

`package-lock.json` is committed at lockfile version 3 and records the exact transitive dependency tree. CI installs with:

```bash
npm ci --no-audit --no-fund --progress=false
```

The direct dependency audit retained all five declared packages because each has an explicit runtime/tool owner:

- `@aws-sdk/client-s3` — local Backblaze B2 setup/upload utilities.
- `aws4fetch` — Cloudflare Pages private-B2 signing.
- `epubjs` — Reader browser runtime vendor asset.
- `fast-xml-parser` — EPUB metadata parsing in build/upload tooling.
- `jszip` — EPUB parsing plus the browser vendor asset.

Dependency changes require an explicit PR, synchronized manifest/lockfile, and the complete regression/build gate. R9 intentionally does not add a bundler because no measured application problem requires one; the decision and rationale live in [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md).

## Asset cache-busting

`package.json#version` is the single deploy-time cache-busting version for local JavaScript and CSS assets.

Authored v1 files can still contain historical `?v=...` query strings. Rather than requiring repetitive source edits, `tools/build.mjs` runs the shared asset-versioning helper after copying `src/` to `dist/` and rewrites local `/assets/*.js` and `/assets/*.css` references to:

```text
?v=<package.json version>
```

This applies to direct HTML references and runtime-loaded/imported local JS/CSS references in copied text assets. It does not alter remote URLs, EPUB/media URLs, images, catalog URLs, or source files.

R9 deliberately retains this native/static strategy instead of adding hashed bundles. A future bundler decision requires a measured benefit and an intentional replacement of this owner.

## Deterministic build metadata

`tools/lib/build-context.mjs` is the canonical version/commit/branch/timestamp owner for build output.

It prefers Cloudflare/GitHub commit and branch metadata, falls back to Git, and resolves the build timestamp from `SOURCE_DATE_EPOCH` or the selected commit timestamp before using wall-clock time as a last-resort non-Git fallback.

Both `tools/build.mjs` and `tools/write-source.mjs` consume this context. Local catalog `generatedAt` and `dist/data/version.json#builtAt` therefore share one timestamp rather than independently calling the clock.

## Local preview

`npm run preview` is owned by `tools/preview.mjs`, a dependency-free Node 22 static server for generated `dist/` output.

The old `npx serve dist` workflow is retired. Preview no longer downloads or executes an undeclared CLI at invocation time.

## Repository root policy

The repository root is intentionally limited to normal project entry/configuration files and top-level source directories:

```text
.env.b2.example
.github/
.gitignore
.nvmrc
CHANGELOG.md
README.md
docs/
functions/
library/
package.json
package-lock.json
src/
tests/
tools/
```

Project planning/history belongs under `docs/`; deterministic test source belongs under `tests/`; generated output belongs under ignored directories; temporary scratch files do not belong in the repository.

## Dead-file rule

A source file that is not a documented entrypoint, runtime import, tool input, test fixture/helper, or intentionally retained migration artifact should be removed rather than left as an ambiguous alternate implementation.

R1 removed `src/assets/js/library-continue-meta.js` after its runtime ownership had already moved elsewhere. R10 owns the final removal of legacy compatibility entrypoints that are still intentionally retained and documented; R9 does not mix that cutover into build/deployment cleanup.
