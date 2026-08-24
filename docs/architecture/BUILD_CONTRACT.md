# Source, Build, and Tooling Contract

**Refactor milestone:** R1 — Repository and tooling hygiene  
**Baseline application:** v1.15.14

This document defines which files are authored, which are generated, how local assets are versioned, and what tooling is intentionally pinned during the refactor.

## Authored vs generated

Authored and committed:

- `src/` — static Library, Series, Reader, and Garden Keeper source.
- `functions/` — Cloudflare Pages Functions and shared server helpers.
- `tests/` — deterministic R8 unit, service/integration, DOM, browser-smoke fixtures and test helpers.
- `tools/` — build, upload, validation, test runner, and refactor guardrails.
- `library/` — local EPUB/build input and non-secret library configuration/placeholder files.
- `docs/` — architecture, roadmap, security history, and style guidance.
- root project/config files such as `package.json`, `.gitignore`, `.nvmrc`, README, and CHANGELOG.

Generated and never committed:

- `dist/` — complete Cloudflare Pages static output.
- `node_modules/` — installed npm dependency tree.
- `dist/assets/vendor/epub.min.js` — copied from the installed `epubjs` package by `tools/build.mjs`.
- `dist/assets/vendor/jszip.min.js` — copied from the installed `jszip` package by `tools/build.mjs`.
- `dist/data/catalog.json` / `dist/data/adult-catalog.json` when produced from local library input.
- `dist/data/version.json` — deployment metadata written by `tools/write-source.mjs`.

`dist/` must remain reproducible from committed source plus installed dependencies and environment/build metadata. No source module may depend on editing `dist/` directly.

## Node and CI

R1 standardizes the development/verification Node major on **Node 22**:

- `.nvmrc` contains `22` for compatible local version managers.
- GitHub Actions uses Node 22 explicitly.
- CI action revisions are pinned to immutable commit SHAs rather than floating `@v4` tags.

Formatting/linting is intentionally not introduced during R1 because a repository-wide reformat would obscure functional refactor diffs. It can be added after module boundaries settle.

R8 keeps the same Node boundary for tests: `tools/run-tests.mjs` uses the built-in Node test runner, so the new test architecture does not introduce a second runtime or a test-only framework dependency.

## Dependency policy during the refactor

The current `package.json` dependency ranges are retained in R1 to avoid combining a dependency upgrade/audit with repository cleanup.

A committed npm lockfile is **deferred to R9's dependency audit**, when unused packages and the final dependency set are evaluated together. Until then:

- CI installs only from the committed manifest;
- dependency changes require an explicit PR and successful full regression checks;
- no production source may import an undeclared package;
- R1 does not silently upgrade or downgrade runtime dependencies.

This is the deliberate interpretation of the roadmap requirement to add/maintain a lockfile **once the dependency strategy is finalized**.

## Asset cache-busting

`package.json#version` is the single deploy-time cache-busting version for local JavaScript and CSS assets.

Authored v1 files still contain historical `?v=...` query strings. R1 does not create a noisy repository-wide edit just to normalize them. Instead, `tools/build.mjs` runs the shared asset-versioning helper after copying `src/` to `dist/` and rewrites local `/assets/*.js` and `/assets/*.css` references to:

```text
?v=<package.json version>
```

This applies to direct HTML references and runtime-loaded/imported local JS/CSS references in copied text assets. It does not alter remote URLs, EPUB/media URLs, images, catalog URLs, or source files.

Result: future feature work no longer needs to manually bump scattered asset query strings for deployment cache invalidation. R7/R9 may later remove the historical source query strings entirely or replace this with hashed bundles if a bundler is adopted.

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
src/
tests/
tools/
```

A future `package-lock.json` is also an allowed root file once R9 finalizes dependencies.

Project planning/history belongs under `docs/`; deterministic test source belongs under `tests/`; generated output belongs under ignored directories; temporary scratch files do not belong in the repository.

## Dead-file rule

A source file that is not a documented entrypoint, runtime import, tool input, test fixture/helper, or intentionally retained migration artifact should be removed rather than left as an ambiguous alternate implementation.

R1 removes `src/assets/js/library-continue-meta.js`, which had already been removed from Main/Adult HTML after `library-finished-polish.js` became authoritative and had no remaining runtime owner.
