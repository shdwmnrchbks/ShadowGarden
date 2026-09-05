# Source, Build, and Tooling Contract

**Accepted v2 build baseline:** v2.0.0  
**Active deployment/product line:** v2.11.0  
**Latest formal release:** v2.10.0  
**Runtime/toolchain:** Node 22.x · npm@10.9.8

This document defines authored/generated boundaries, repository layout, runtime/dependency policy, and the native build contract. [`BUILD_DEPLOYMENT.md`](./BUILD_DEPLOYMENT.md) owns the CI/deployment/publisher details; [`VERSIONING_CONTRACT.md`](./VERSIONING_CONTRACT.md) owns deployment-versus-formal version semantics.

## Authored versus generated

Committed/authored sources include `src/`, `functions/`, `tests/`, `tools/`, `docs/`, local `library/` inputs/configuration, and ordinary root project files.

Generated and ignored material includes `dist/`, `node_modules/`, generated E2E EPUB fixtures/artifacts, copied vendor assets under `dist/assets/vendor/`, and generated catalog/source/version JSON under `dist/data/`.

`dist/` must be reproducible from committed source, locked dependencies, build inputs, and resolved build context. No application owner may rely on hand-editing generated output.

## Runtime and lockfiles

- `.nvmrc` and CI use the reviewed Node 22 patch; `package.json#engines.node` remains `22.x`.
- `package.json#packageManager` is `npm@10.9.8`.
- root `package-lock.json` is committed at lockfile v3 and follows formal `package.json#version`.
- `tests/e2e/package-lock.json` independently locks the isolated Playwright workspace.
- CI installs with `npm ci`; runtime/package-manager/lockfile changes are reviewed code changes.

Audit G found no reason to change package manager, merge the two lockfile ownership domains, or add a second deterministic test framework.

## Direct dependency ownership

The five root direct dependencies remain because each has a current owner:

- `@aws-sdk/client-s3` — local B2 setup/upload tooling;
- `aws4fetch` — private-B2 request signing in the Pages Functions storage service;
- `epubjs` — canonical Reader runtime/vendor asset;
- `fast-xml-parser` — EPUB package parsing in build/upload tooling;
- `jszip` — EPUB archive parsing plus browser vendor asset.

Dependency maintenance is review-driven. Production dependency audit reporting is non-mutating; no automated dependency fix/merge policy is authorized.

## Native no-bundler build

Shadow Garden remains an intentionally small static/native-module application. No measured Audit G problem justified Vite/Rollup/webpack/esbuild/Parcel or a framework migration.

`tools/build.mjs`:

1. clears and copies `src/` into generated `dist/`;
2. stamps local JS/CSS references through the canonical asset-versioning helper;
3. copies the reviewed EPUB.js and JSZip browser vendor artifacts;
4. optionally indexes local EPUB inputs and writes generated catalog data.

`tools/write-source.mjs` writes source configuration plus deterministic version/commit/branch/timestamp metadata. `tools/lib/build-context.mjs` is the sole build-context owner.

Audit B adds one dependency-sensitive build guard: the reviewed EPUB.js lifecycle compatibility patch is accepted only for the expected 0.3.93 vendor revision.

## Asset version ownership

Authored local JS/CSS references must not carry hand-maintained release-history `?v=` values. Build-time deployment stamping is the single cache-version owner. `tools/check-authored-cache-versions.mjs` protects that boundary.

## Repository and documentation layout

- `docs/architecture/` — current accepted ownership contracts;
- `docs/roadmaps/` — one current roadmap plus historical compatibility pointers only;
- `docs/audits/` — evidence and audit decisions;
- `docs/operations/` — active operational policy;
- `docs/releases/` — formal release records;
- `docs/archive/` — completed/superseded planning and milestone history;
- `docs/security/` — historical security milestone compatibility records;
- `tests/` — deterministic and E2E verification source;
- `tools/` — current build/verification/operations tooling;
- ignored generated output stays outside authored ownership.

A file with no current runtime/tool/test/document/history owner should be removed rather than retained as an ambiguous alternate implementation. Conversely, historical release/archive records are legitimate retained owners even when they mention superseded versions or old implementation names.

## Current executable-policy boundary

Modern purpose-specific checks/tests own current policy. Absence guards prevent retired milestone/release-era executable snapshots and retired compatibility facades from silently returning. Current architecture documents must describe the modern owners rather than treating historical executables as live contracts.
