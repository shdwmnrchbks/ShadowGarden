# Shadow Garden Dependency Maintenance

**Status:** Active operations policy during v2.11  
**Cadence:** Weekly, Monday morning (Asia/Manila)  
**Current reviewed runtime/toolchain:** Node 22.23.2 · npm@10.9.8  
**Current audit record:** [`../audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md`](../audits/V2_11_BUILD_DEPENDENCIES_TOOLING_AUDIT.md)

Shadow Garden uses Dependabot to surface reviewable update pull requests. It does not auto-merge dependency or GitHub Actions changes. Audit G revalidated this policy and found no evidence for automatic dependency fixes, a package-manager change, lockfile consolidation, or a second dependency-update path.

## Automated scope

The npm updater is deliberately allow-listed to the five direct production/tooling dependencies in `package.json`:

- `@aws-sdk/client-s3` — local B2 setup/upload tooling;
- `aws4fetch` — Pages Functions private-B2 signing;
- `epubjs` — Reader runtime/vendor asset;
- `fast-xml-parser` — EPUB package parsing in build/upload tooling;
- `jszip` — EPUB archive parsing plus browser vendor asset.

Transitive packages move only when a reviewed direct-dependency update requires the lockfile to change. Adding another direct dependency requires an intentional manifest/lockfile/policy update.

GitHub Actions updates are a separate Dependabot stream. Repository workflows keep third-party actions pinned to full commit SHAs; human-readable version comments may move with the pin.

## Review and merge policy

No dependency PR is eligible for automatic merge. Every update is an ordinary reviewed pull request and must pass the normal release-quality gates before merge:

1. Verify Shadow Garden;
2. Real Browser E2E on Chromium desktop/mobile, Firefox desktop, WebKit desktop/mobile;
3. human review of the dependency and lockfile diff for unexpected packages, integrity changes, scripts, or ownership changes.

EPUB.js, AWS/B2 (`@aws-sdk/client-s3`, `aws4fetch`), authentication/security, runtime-pin, package-manager, and GitHub Actions changes are high-impact even when the semantic version bump is small. Review must confirm the affected owner and expected behavior rather than treating version number or green automation as sufficient evidence.

## Pull-request volume

Both npm and GitHub Actions streams are capped at five open Dependabot pull requests and run weekly. npm checks begin at 08:00 and GitHub Actions checks at 08:20 Asia/Manila.

## Runtime and lockfile policy

Shadow Garden supports Node 22 through `engines.node = "22.x"` while repository verification uses the reviewed Node 22.23.2 patch. Root `package.json#packageManager` remains `npm@10.9.8`; the E2E workspace follows the same runtime family while owning its independent Playwright lockfile.

Both committed npm lockfiles use lockfile format 3. `tools/check-runtime-lockfiles.mjs` validates manifest/root-lock identity, version, engine, direct dependency metadata, registry origin/integrity, and reviewed workflow runtime pins.

Do not hand-edit `resolved`, `integrity`, or transitive dependency fields. Runtime/npm/lockfile changes are reviewed maintenance changes and must pass the normal verification floor.

## Dependency audit reporting

`.github/workflows/dependency-audit.yml` runs every Monday at 09:00 Asia/Manila and can also be dispatched manually. It:

- installs the lockfile-defined production tree without install-time audit noise;
- verifies runtime/lockfile policy;
- independently verifies the E2E lockfile install with install scripts disabled;
- collects `npm audit --omit=dev --json`;
- classifies the result through `tools/dependency-audit-report.mjs`.

The audit workflow is separate from normal pull-request/push Verify because registry availability is external. Failure to obtain or parse a supported npm audit report is an **observability failure**, not a clean security result.

Findings are classified by repository policy:

- **Action required:** any high/critical production-tree finding. The scheduled job fails visibly; human review establishes runtime relevance and a safe remediation/mitigation.
- **Review required:** a moderate direct-dependency finding, or a moderate transitive finding with an npm-reported fix. The report stays visible for review.
- **Monitor only:** lower-severity findings and moderate transitive findings without an npm-reported fix.

`npm audit` metadata is triage evidence, not proof that Shadow Garden can reach or exploit the vulnerable path. Review the advisory against actual runtime ownership, deployment exposure, and the proposed dependency/lockfile diff. The reporter never modifies package metadata or the lockfile.

## What automation does not do

- no dependency or Actions auto-merge;
- no independent arbitrary transitive updates;
- no weakening/skipping of the five-browser matrix;
- no `npm audit fix` automation;
- no manual rewrite of lockfile integrity/transitive metadata;
- no dependency change authorized solely by advisory severity.

`tools/check-dependency-maintenance.mjs` enforces allow-list/cadence/audit/workflow-pin/no-auto-merge policy. `tools/check-runtime-lockfiles.mjs` separately enforces the reviewed Node/npm/two-lockfile contract.

Audit G removed duplicate **verification execution**, not dependency-review authority: workflows that already passed `npm run check` use `npm run build:dist`, and Baseline Health no longer repeats the exact performance command already owned by the repository check. Any future maintenance-policy change must preserve explicit human review for high-impact dependencies and the same release-quality verification floor.
