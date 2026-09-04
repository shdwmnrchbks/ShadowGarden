# Source, Build, and Tooling Contract

**Refactor milestones:** R1 repository/tooling hygiene; finalized by R9 build/deployment cleanup  
**Baseline application:** v1.15.14  
**Accepted v2 build baseline:** v2.0.0  
**Current operational line:** v2.10.0

This document defines which files are authored, which are generated, how local assets are versioned, and what tooling is intentionally pinned. R1 established the boundary; R9 finalized dependency locking, deterministic build metadata, CI installation, and preview ownership; v2.10 added explicit runtime/lockfile, documentation, release-metadata, and recurring maintenance guards. See [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) for build/deployment architecture, [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) for active-deployment versus formal-release ownership, and [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md) for the current audit-first review of whether any further simplification is justified.

## Authored vs generated

Authored and committed:

- `src/` — static Library, Series, Reader, and Garden Keeper source.
- `functions/` — Cloudflare Pages Functions and shared server helpers.
- `tests/` — deterministic unit, service/integration, DOM, browser-contract, E2E fixtures, and test helpers.
- `tools/` — build, upload, validation, test runner, preview server, build context, audit/maintenance tooling, and architecture guardrails.
- `library/` — local EPUB/build input and non-secret library configuration/placeholder files.
- `docs/` — architecture contracts, audit evidence, operations policy, active roadmap, release records, archived planning/security history, and style guidance.
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

Shadow Garden supports the **Node 22 LTS family** while repository verification uses one reviewed patch/toolchain:

- `.nvmrc` contains the reviewed CI patch, currently `22.23.2`.
- `package.json#engines.node` is `22.x`.
- `package.json#packageManager` is `npm@10.9.8`.
- GitHub Actions explicitly install the reviewed Node `22.23.2` patch for project commands.
- CI action revisions remain pinned to immutable commit SHAs rather than floating tags.
- Node patch/npm changes are reviewed maintenance work and must pass the normal repository and five-browser gates.

The deterministic test architecture uses the same Node boundary: `tools/run-tests.mjs` uses the built-in Node test runner, so the repository does not introduce a second runtime or a test-only framework dependency for unit/service/DOM/browser-contract layers.

Formatting/linting remains intentionally separate from architecture changes; a repository-wide formatter must not be smuggled into a functional refactor slice. The post-v2.10 audit may recommend tooling changes only when they reduce demonstrated fragility or duplicated cost.

## Finalized dependency policy

R9 resolved the lockfile deferral from R1; v2.10 made the maintenance contract explicit.

`package-lock.json` is committed at lockfile version 3 and records the exact transitive dependency tree. Its root/workspace version stays synchronized with the formal `package.json#version`; the active `deploymentVersion` is deliberately not a dependency-lock version. CI installs with `npm ci` against the committed lockfile.

The direct dependency audit retained all five declared packages because each has an explicit runtime/tool owner:

- `@aws-sdk/client-s3` — local Backblaze B2 setup/upload utilities.
- `aws4fetch` — Cloudflare Pages private-B2 signing.
- `epubjs` — Reader browser runtime vendor asset.
- `fast-xml-parser` — EPUB metadata parsing in build/upload tooling.
- `jszip` — EPUB parsing plus the browser vendor asset.

Dependency changes require an explicit PR, synchronized manifest/lockfile, and the complete regression/build gate. High-impact EPUB.js, AWS/B2, authentication/security, runtime-pin, and workflow changes require owner-specific review. The active policy is documented in [`../operations/DEPENDENCY_MAINTENANCE.md`](../operations/DEPENDENCY_MAINTENANCE.md).

R9 intentionally does not add a bundler because no measured application problem requires one. The post-v2.10 audit retains the same rule: a future bundler decision requires a reproduced build/runtime problem and a measured benefit that outweighs migration and ownership cost.

## Asset cache-busting

`tools/lib/build-context.mjs#version` is the single deploy-time cache-busting version for local JavaScript and CSS assets. It resolves from `package.json#deploymentVersion` when present, otherwise falling back to the formal `package.json#version`.

R10 removed historical local `?v=...` query strings from authored v2 source. `tools/build.mjs` remains the sole cache-busting owner: after copying `src/` to `dist/`, the shared asset-versioning helper stamps local `/assets/*.js` and `/assets/*.css` references to:

```text
?v=<active deployment version>
```

This applies to direct HTML references and runtime-loaded/imported local JS/CSS references in copied text assets. It does not alter remote URLs, EPUB/media URLs, images, catalog URLs, or source files.

The repository retains this native/static strategy instead of hashed bundles until measurements demonstrate a reason to replace it.

## Deterministic build metadata

`tools/lib/build-context.mjs` is the canonical deployment-version/commit/branch/timestamp owner for build output and also exposes the formal `releaseVersion` separately.

It resolves the active deployment version from `package.json#deploymentVersion` with `package.json#version` fallback, prefers Cloudflare/GitHub commit and branch metadata, falls back to Git, and resolves the build timestamp from `SOURCE_DATE_EPOCH` or the selected commit timestamp before using wall-clock time as a last-resort non-Git fallback.

Both `tools/build.mjs` and `tools/write-source.mjs` consume this context. Local catalog `generatedAt` and `dist/data/version.json#builtAt` therefore share one timestamp rather than independently calling the clock, while `dist/data/version.json#version` reports the active deployment/product version shown by the site.

## Local preview

`npm run preview` is owned by `tools/preview.mjs`, a dependency-free Node 22 static server for generated `dist/` output.

The old `npx serve dist` workflow is retired. Preview no longer downloads or executes an undeclared CLI at invocation time.

## Repository root and documentation policy

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

Documentation ownership inside `docs/` is explicit:

- `docs/architecture/` — accepted current architecture contracts;
- `docs/roadmaps/` — one active roadmap plus compatibility pointers only;
- `docs/audits/` — evidence, measurements, findings, and audit decisions;
- `docs/operations/` — active maintenance/recovery policy;
- `docs/releases/` — formal release records and clearly labeled historical compatibility files;
- `docs/archive/` — completed/superseded planning and milestone history;
- `docs/security/` — completed security milestone compatibility records;
- `docs/style/` — product voice/design guidance.

Deterministic test source belongs under `tests/`; generated output belongs under ignored directories; temporary scratch files do not belong in the repository.

## Dead-file rule

A source file that is not a documented entrypoint, runtime import, tool input, test fixture/helper, operational record, or intentionally retained compatibility/history artifact should be removed rather than left as an ambiguous alternate implementation.

R1 removed `src/assets/js/library-continue-meta.js` after its runtime ownership had already moved elsewhere. R10 removed the final known obsolete compatibility entrypoints and patch layers. The current audit explicitly rechecks for dead/unreachable code and stale compatibility paths, but deletion still requires evidence that the file is no longer an intentional owner or compatibility record.
