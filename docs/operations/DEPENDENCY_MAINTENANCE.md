# Shadow Garden Dependency Maintenance

**Status:** Active operations policy established in v2.10 and retained through v2.11  
**Cadence:** Weekly, Monday morning (Asia/Manila)

Shadow Garden uses Dependabot only to surface reviewable update pull requests. It does not auto-merge dependency or GitHub Actions changes. v2.11's engineering audit may reassess dependency ownership or maintenance cost, but no dependency is removed, replaced, or upgraded solely because the audit phase exists.

## Automated scope

The npm updater is deliberately allow-listed to the five direct production/tooling dependencies in `package.json`:

- `@aws-sdk/client-s3`
- `aws4fetch`
- `epubjs`
- `fast-xml-parser`
- `jszip`

Transitive packages move only when a reviewed direct-dependency update requires the lockfile to change. Adding another direct dependency requires an intentional update to both `package.json` and the maintenance allow-list/check.

GitHub Actions updates are handled as a separate Dependabot stream. Repository workflows must keep third-party actions pinned to full commit SHAs; human-readable version comments may be updated alongside the SHA.

## Review and merge policy

No dependency PR is eligible for automatic merge. Every update remains an ordinary reviewed pull request and must pass the repository's normal release-quality gates before merge:

1. Verify Shadow Garden must pass.
2. Real Browser E2E must pass on Chromium desktop/mobile, Firefox desktop, and WebKit desktop/mobile.
3. The dependency diff and lockfile must be reviewed for unexpected packages, integrity changes, scripts, or ownership changes.

Updates touching EPUB.js, AWS/B2 request or storage behavior (`@aws-sdk/client-s3`, `aws4fetch`), authentication/security boundaries, or GitHub Actions execution are treated as high-impact even when the version bump is small. They are never merged on version number or automated test status alone; review must confirm the affected owner and expected behavior.

The current ownership boundary is important during v2.11 audit work: production Cloudflare B2 access is owned by `aws4fetch` in `functions/services/storage.js`, while `@aws-sdk/client-s3` is used only by local operator B2 setup/upload utilities with explicit static credentials. Any proposal to consolidate or change that split must be justified by the engineering audit rather than assumed from package names.

## Pull-request volume

Both npm and GitHub Actions streams are capped at five open Dependabot pull requests and run weekly. npm checks begin at 08:00 and GitHub Actions checks at 08:20 Asia/Manila so update streams stay visible without creating continuous churn.

## Runtime and lockfile policy

Shadow Garden supports the Node 22 LTS family through `engines.node = "22.x"` in both the root and E2E manifests. Reproducible CI uses the reviewed patch line in `.nvmrc` and every `actions/setup-node` workflow; the current reviewed pin is Node `22.23.2`. Both manifests also declare `packageManager: "npm@10.9.8"`, matching the npm release bundled with that reviewed Node patch.

The exact CI patch pin is intentionally narrower than the supported engine family. Local/runtime consumers may use a compatible Node 22 patch, while repository gates run one known toolchain. Node 22 patch updates are reviewed maintenance changes and must pass the normal Verify plus five-browser matrix. A future Node major migration is an explicit engineering/maintenance decision, not a silent workflow edit.

Both committed npm lockfiles use lockfile format 3. `tools/check-runtime-lockfiles.mjs` verifies manifest/root-lock name, version, engine, and direct-dependency metadata; requires all registry-backed package entries to resolve from `https://registry.npmjs.org/` with SHA-512 integrity; and ensures Verify, E2E, and dependency-audit workflows use the reviewed Node patch pin.

Do not hand-edit `resolved`, `integrity`, or transitive dependency fields. The weekly dependency-audit workflow runs `npm ci` against the root production lockfile and separately against `tests/e2e/package-lock.json` with E2E install scripts disabled. Those registry-backed installs complement the deterministic source check by exercising the committed package URLs/checksums on a regular cadence.

## Dependency audit reporting

`.github/workflows/dependency-audit.yml` runs every Monday at 09:00 Asia/Manila and can also be started manually. It installs the lockfile-defined production tree without install-time audit noise, verifies the runtime/lockfile policy plus the E2E lockfile install, collects `npm audit --omit=dev --json`, and passes that JSON through `tools/dependency-audit-report.mjs`.

The audit workflow is intentionally separate from normal pull-request/push Verify. Registry availability is external and must not make deterministic product verification flaky. A scheduled audit that cannot obtain or parse a supported npm audit report fails visibly as an **observability failure**; it is not treated as a clean security result.

Findings are classified by repository policy:

- **Action required:** any high or critical finding in the production dependency tree. The scheduled audit job fails so the finding stays visible. “Action required” means promptly triage runtime relevance and establish a safe remediation or mitigation; it does not authorize an automatic dependency change.
- **Review required:** a moderate finding on a direct dependency, or a moderate transitive finding for which npm reports a fix. The scheduled job remains successful but the finding stays visible in the report for human review.
- **Monitor only:** lower-severity findings and moderate transitive findings with no npm-reported fix. Reassess them on the next weekly cycle or when the dependency graph changes.

`npm audit` metadata is useful triage evidence but does not prove Shadow Garden can reach or exploit the vulnerable path. Review the advisory against actual runtime ownership, affected code paths, deployment exposure, and the proposed lockfile diff. High-impact EPUB.js, AWS/B2, authentication/security, and workflow changes still require their owner-specific review and the complete verification matrix even if an audit report suggests a simple version bump.

The reporter writes a human-readable GitHub job summary and can be run against previously captured JSON with `npm run audit:report`. It never modifies package metadata or the lockfile.

## Relationship to the v2.11 engineering audit

Dependency maintenance and the v2.11 engineering audit solve different problems:

- dependency maintenance answers whether the locked third-party tree is current, reproducible, reviewable, and carrying known advisory findings;
- the engineering audit answers whether Shadow Garden's own dependency ownership, module structure, test seams, or realistic-scale performance justify a structural change.

A dependency being old or having alternatives is not enough to justify replacement. A dependency replacement/refactor must meet the same evidence threshold as other v2.11 architectural changes and must preserve the full security/Reader/build/browser contract.

## What this automation does not do

- It does not auto-merge.
- It does not update arbitrary transitive dependencies independently.
- It does not weaken or skip the five-browser matrix for dependency/configuration changes.
- It does not treat `npm audit` severity alone as proof of a production exploit.
- It never runs `npm audit fix` automatically.
- It does not rewrite lockfile integrity or transitive metadata by hand.
- It does not pre-authorize dependency replacement during the v2.11 audit.

`tools/check-dependency-maintenance.mjs` enforces the dependency allow-list, cadence, scheduled audit contract, workflow SHA pins, absence of repository auto-merge hooks, and continued E2E coverage for dependency/workflow pull requests. `tools/check-runtime-lockfiles.mjs` separately enforces the reviewed Node/npm toolchain and committed lockfile invariants.
