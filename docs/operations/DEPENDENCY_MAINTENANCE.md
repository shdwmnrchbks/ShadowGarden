# Shadow Garden Dependency Maintenance

**Status:** Active v2.10 operations policy  
**Cadence:** Weekly, Monday morning (Asia/Manila)

Shadow Garden uses Dependabot only to surface reviewable update pull requests. It does not auto-merge dependency or GitHub Actions changes.

## Automated scope

The npm updater is deliberately allow-listed to the five direct production dependencies in `package.json`:

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

## Pull-request volume

Both npm and GitHub Actions streams are capped at five open Dependabot pull requests and run weekly. npm checks begin at 08:00 and GitHub Actions checks at 08:20 Asia/Manila so update streams stay visible without creating continuous churn.

## What this automation does not do

- It does not auto-merge.
- It does not update arbitrary transitive dependencies independently.
- It does not weaken or skip the five-browser matrix for dependency/configuration changes.
- It does not treat `npm audit` severity alone as a production incident; audit findings are evaluated separately based on reachability, affected runtime surface, and available remediation.
- It does not rewrite lockfile integrity or transitive metadata by hand.

`tools/check-dependency-maintenance.mjs` enforces the allow-list, cadence, workflow SHA pins, absence of repository auto-merge hooks, and continued E2E coverage for dependency/workflow pull requests.
