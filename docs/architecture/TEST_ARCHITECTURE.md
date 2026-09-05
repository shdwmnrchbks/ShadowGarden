# Shadow Garden Test Architecture

Shadow Garden uses complementary deterministic and real-browser layers. Deterministic tests answer quickly whether canonical owners and representative behavior remain correct; repository/security guards enforce boundaries; Playwright proves browser-critical behavior in actual rendering/input engines. No layer replaces another.

## Deterministic layers

`tools/run-tests.mjs` discovers every `*.test.mjs` file in four layers and runs each layer with Node's built-in test runner at concurrency 1:

- `tests/unit/` — pure/domain/browser-local helpers and build/tooling policy units;
- `tests/service/` — real Pages Functions service/_lib boundaries with deterministic storage/network doubles;
- `tests/dom/` — renderer ownership against narrow DOM doubles;
- `tests/browser/` — deterministic browser-facing source/interaction/fixture contracts without launching an engine.

Audit A/G explicitly retained historical-looking test filenames because the active runner discovers them. Filename age is not evidence that a test is stale.

At Audit G closeout the normal service gate contains **47 tests**, including migrated acquisition-throttle, crawler-classification, Keeper session/throttle, and abuse cooldown/release behavior that previously lived inside stale release-era standalone policy scripts.

## Security and repository guards

`npm run check` owns current repository/dependency/runtime/documentation/release/baseline/cache-version/retired-owner/reachability/performance policy. `npm run check:security` remains a dedicated signed-media/opaque-ID/human-session/protected-route contract. Normal Verify runs the complete service suite as a separate explicit owner.

This split is deliberate: current behavioral tests/guards replace frozen milestone-policy executables rather than preserving old source-regex snapshots forever.

## Real Browser E2E

`tests/e2e/` is an isolated Playwright workspace pinned to **1.62.1** with its own committed lockfile. The five projects are:

1. `chromium-desktop`
2. `firefox-desktop`
3. `webkit-desktop`
4. `chromium-mobile`
5. `webkit-mobile`

The suite builds real production `dist/` and serves it through `tools/preview.mjs`. External/data boundaries are deterministic fixtures; application controllers/rendering are not replaced.

### Public/Library/Series authority

Coverage includes Main/Adult isolation, search/filter/view/history restoration, pinned navigation, suggestion rerolls, first paint, Series ↔ Reader continuity, and Read → Continue → Finished → Read Again with bookmark preservation.

### Reader authority

Coverage includes protected startup, Pages/Continuous, TOC/search, keyboard/wheel/swipe ownership, progress/bookmark persistence, flow switching, image focus, resize/orientation, resume/ticket renewal, fullscreen, split/large/visual EPUB fixtures, mobile chrome/targets, Continuous rail/artwork containment, and the Audit B lifecycle-sensitive paths.

Where Playwright cannot honestly synthesize trusted cross-frame hardware input in every engine, deterministic ownership contracts complement the live browser acceptance rather than pretending synthetic dispatch is trusted input.

### Garden Keeper authority

Coverage includes auth/session, dialogs/focus restoration, Library/Series/translations, multi-EPUB upload/preflight/error/retry, Maintenance, History, Trash/recovery readiness, Abuse Watch, and duplicate-mutation busy-state protection.

### Accessibility authority

Application-owned coverage includes bounded scans, keyboard/focus behavior, 200%/400% equivalent reflow, reduced motion, forced colors, increased contrast, and labelled mobile target sizing. EPUB publication content retains the separate boundary documented in [`ACCESSIBILITY_TESTING.md`](./ACCESSIBILITY_TESTING.md).

## Failure artifacts

Playwright retains trace/screenshot/video on failure as configured and uploads report/test artifacts with bounded retention. Generated fixtures/artifacts remain uncommitted.

## Commands

```bash
npm run test:unit
npm run test:service
npm run test:dom
npm run test:browser
npm test
npm run check
npm run check:security
npm run build
npm run test:e2e
```

`npm run build` is self-validating via `prebuild -> npm run check`. CI jobs that already ran the repository check use **`npm run build:dist`** for the post-check build so the same deterministic gate is not executed twice.

## CI and release ownership

- `.github/workflows/verify.yml` — one repository check + security/service/targeted regressions + post-check `build:dist`.
- `.github/workflows/e2e.yml` — five real-browser projects on pull requests and `main`, plus manual/monthly reruns.
- `.github/workflows/baseline-health.yml` — monthly/manual repository check + security + full deterministic tests + post-check build.
- `.github/workflows/release-v2.yml` — publishes only after exact-main Verify, matching real-browser success, matching Cloudflare deployment metadata, and production smoke.

## Current guardrail decision

The permanent product contract is the **behavior and ownership**, not the continued existence of historical milestone checker executables. Current purpose-specific checks/tests, Audit F CSS ownership measurement, service/security regressions, and the five-browser matrix are the active guardrails. Absence checks keep retired executable policy from silently returning.
