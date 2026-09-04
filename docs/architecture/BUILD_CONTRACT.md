# Source, Build, and Tooling Contract

**Refactor milestones:** R1 repository/tooling hygiene; finalized by R9 build/deployment cleanup  
**Baseline application:** v1.15.14  
**Current build contract:** v1.24.0 baseline, retained through v2.11

This document defines which files are authored, which are generated, how local assets are versioned, and what tooling is intentionally pinned. R1 established the boundary; R9 finalized dependency locking, deterministic build metadata, CI installation, and preview ownership. Later v2 releases retain those owners. See [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) for the current R9-derived build/deployment contract, [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) for the active-deployment versus formal-release version split, and [`ENGINEERING_AUDIT.md`](./ENGINEERING_AUDIT.md) for the v2.11 rule that build/tooling changes require evidence rather than cleanup preference.

## Authored vs generated

Authored and committed:

- `src/` — static Library, Series, Reader, and Garden Keeper source.
- `functions/` — Cloudflare Pages Functions and shared server helpers.
- `tests/` — deterministic R8 unit, service/integration, DOM, browser-smoke fixtures and test helpers plus the isolated real-browser workspace.
- `tools/` — build, upload, validation, test runner, preview server, build context, maintenance/audit helpers, and permanent architecture guardrails.
- `library/` — local EPUB/build input and non-secret library configuration/placeholder files.
- `docs/` — architecture, active roadmap, archived planning/security history, release records, operations, and style guidance.
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

Shadow Garden standardizes development and verification on **Node 22**:

- `.nvmrc` contains `22` for compatible local version managers.
- `package.json#engines.node` is `22.x`.
- GitHub Actions uses the reviewed Node 22 runtime policy for project commands.
- CI action revisions remain pinned to immutable commit SHAs rather than floating tags.

R8 and later deterministic tests use the same Node boundary through `tools/run-tests.mjs` and the built-in Node test runner. The real-browser workspace retains its own Playwright dependency/lockfile but does not introduce a second application runtime.

Formatting/linting remains intentionally separate from architecture changes; a repository-wide formatter must not be smuggled into a functional refactor slice. v2.11 may recommend tooling changes only when audit evidence shows a material maintenance or correctness benefit.

## Finalized dependency policy

R9 resolved the lockfile deferral from R1; v2.10 added controlled dependency-maintenance policy and recurring audit/runtime checks.

`package-lock.json` is committed at lockfile version 3 and records the exact transitive dependency tree. Its root/workspace version stays synchronized with the formal `package.json#version`; the active `deploymentVersion` is deliberately not a dependency-lock version. CI installs with:

```bash
npm ci --no-audit --no-fund --progress=false
```

The direct dependency set remains intentionally small and every package has an explicit owner:

- `@aws-sdk/client-s3` — local Backblaze B2 setup/upload utilities with explicit static credentials.
- `aws4fetch` — Cloudflare Pages private-B2 signing.
- `epubjs` — Reader browser runtime vendor asset.
- `fast-xml-parser` — EPUB metadata/container parsing in build/upload tooling.
- `jszip` — EPUB parsing plus the browser vendor asset.

Dependency changes require an explicit PR, synchronized manifest/lockfile, and the complete regression/build gate. The project intentionally does not add a bundler because no measured application problem currently requires one; the decision and audit threshold live in [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) and [`ENGINEERING_AUDIT.md`](./ENGINEERING_AUDIT.md).

## Asset cache-busting

`tools/lib/build-context.mjs#version` is the single deploy-time cache-busting version for local JavaScript and CSS assets. It resolves from `package.json#deploymentVersion` when present, otherwise falling back to the formal `package.json#version`.

R10 removed historical local `?v=...` query strings from authored v2 source. `tools/build.mjs` remains the sole cache-busting owner: after copying `src/` to `dist/`, the shared asset-versioning helper stamps local `/assets/*.js` and `/assets/*.css` references to:

```text
?v=<active deployment version>
```

This applies to direct HTML references and runtime-loaded/imported local JS/CSS references in copied text assets. It does not alter remote URLs, EPUB/media URLs, images, catalog URLs, or source files.

The native/static strategy remains the default. A future bundler or hashing strategy requires a reproduced problem, a clear replacement owner, and equivalent build/Reader/Functions regression coverage.

## Deterministic build metadata

`tools/lib/build-context.mjs` is the canonical deployment-version/commit/branch/timestamp owner for build output and exposes the formal `releaseVersion` separately.

It resolves the active deployment version from `package.json#deploymentVersion` with `package.json#version` fallback, prefers Cloudflare/GitHub commit and branch metadata, falls back to Git, and resolves the build timestamp from `SOURCE_DATE_EPOCH` or the selected commit timestamp before using wall-clock time as a last-resort non-Git fallback.

Both `tools/build.mjs` and `tools/write-source.mjs` consume this context. Local catalog `generatedAt` and `dist/data/version.json#builtAt` therefore share one timestamp rather than independently calling the clock, while `dist/data/version.json#version` reports the active deployment/product version shown by the site.

During v2.11 audit development, generated deployment metadata reports **v2.11.0** while `releaseVersion` remains **v2.10.0** until a later formal release cut.

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

Active planning belongs in `docs/roadmaps/CURRENT_ROADMAP.md`; completed/superseded planning is canonical under `docs/archive/`. Deterministic test source belongs under `tests/`; generated output belongs under ignored directories; temporary scratch files do not belong in the repository.

## Dead-file rule

A source file that is not a documented entrypoint, runtime import, tool input, test fixture/helper, or intentionally retained compatibility artifact should be removed rather than left as an ambiguous alternate implementation.

R1 removed `src/assets/js/library-continue-meta.js` after its runtime ownership had already moved elsewhere. R10 completed the major legacy-source cutover. v2.11 re-audits compatibility/dead paths, but deletion requires evidence that no supported state, historical guard, or intentional compatibility requirement still owns the path.
