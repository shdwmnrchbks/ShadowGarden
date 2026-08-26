# Shadow Garden Test Architecture

Shadow Garden uses complementary deterministic and real-browser regression layers. R8 established the deterministic Node 22 test architecture; v2.6 extends that architecture with a bounded Playwright matrix so high-risk browser behavior is accepted by real Chromium, Firefox, and WebKit rather than source contracts alone.

The layers intentionally have different jobs:

- deterministic tests answer quickly whether canonical owners and representative behaviors remain correct;
- architecture/security guards enforce boundaries and invariants;
- real-browser E2E proves that the production build behaves correctly in actual rendering/input engines.

No layer replaces another.

## Deterministic layers

### Unit

`tests/unit/`

Unit tests exercise pure or browser-local domain helpers with the smallest practical environment:

- catalog/status normalization and identity handling;
- Library search/filter/sort behavior;
- single-volume and multi-volume behavior;
- deliberately long metadata;
- Unread → In Progress → Finished state transitions;
- Read Again persistence primitives and bookmark preservation;
- Pages swipe classification;
- focused-image pan geometry.

Unit tests do not contact B2, Cloudflare, Turnstile, or the deployed site.

### Service / integration

`tests/service/`

Service tests cross real server-module boundaries while remaining deterministic and offline:

- signed media ticket issue/verify/cookie behavior;
- expired and tampered media tickets;
- canonical media cache URL behavior;
- Garden Keeper bearer + signed-session authorization;
- upload namespace, opaque-cover, MIME, size, and catalog-input validation;
- Garden Health structural analysis.

These tests invoke the same service and `_lib` modules used by Pages Functions. Production storage/Turnstile networking is not made a normal CI dependency.

### DOM

`tests/dom/`

DOM tests exercise renderer ownership with narrow doubles from `tests/helpers/fake-dom.mjs`. The doubles implement only the APIs the renderer under test consumes, making new hidden DOM dependencies fail visibly.

Coverage includes Grid/Compact card markup, pinned/volume badges, canonical Continue state, and reading-banner state/action/artwork ownership.

### Browser smoke and contract

`tests/browser/`

The deterministic Browser smoke/contract layer checks browser-facing entrypoints and ownership without launching a browser engine. It covers:

- Main, Adult, Series, Reader, and Garden Keeper entrypoint surfaces;
- semantic CSS/runtime wiring and first-paint ownership;
- cover/map/illustration/chapter fixtures;
- Visual Page Cache and Paginated visual contain-fit ownership;
- Read → Continue → Finished → Read Again lower-layer contracts;
- Pages versus Continuous input ownership;
- image-focus isolation;
- Garden Keeper composition/auth/workflow boundaries;
- responsive navigation viewport/focus/scroll-lock ownership;
- v2.6 source-contract companions for browser capabilities Playwright cannot honestly synthesize as trusted input.

This layer remains useful after v2.6 because it is fast, deterministic, and precise about ownership. It is no longer the final authority for browser-critical behavior; that role belongs to `tests/e2e/`.

## Real Browser E2E — v2.6+

`tests/e2e/`

v2.6 introduces an isolated Playwright workspace pinned exactly to **1.62.1** with its own committed `package-lock.json`. The root production dependency set remains unchanged.

`playwright.config.mjs` defines five projects:

1. `chromium-desktop`
2. `firefox-desktop`
3. `webkit-desktop`
4. `chromium-mobile`
5. `webkit-mobile`

The suite builds the real production `dist/` tree and serves it with the repository preview server. Tests intercept only deterministic external/data boundaries rather than replacing application controllers.

### Deterministic E2E data

`tests/e2e/support/fixtures.mjs` supplies isolated Main/Adult catalogs, authorization/service responses, media delivery, and browser diagnostics.

`tests/e2e/support/build-reader-fixture.mjs` generates an EPUB3 before every E2E run instead of committing a binary fixture. The book exercises:

- valid EPUB container/package/navigation data;
- normal text chapters;
- illustrations and visual-only pages;
- a deliberately large chapter;
- legacy/common malformed-but-readable structure;
- a chapter split across multiple XHTML spine items;
- protected `/book-access` acquisition;
- canonical `/media/shadow-garden/books/` source identity;
- HTTP Range `206` delivery.

Generated files live under `tests/e2e/.generated/` and remain ignored.

### Public-flow authority

Real-browser Library/Series coverage verifies:

- Main and Adult catalog isolation;
- search/filter/view behavior and browser history restoration;
- pinned navigation and suggestion rerolls;
- mobile navigation geometry, scroll lock, resize/orientation behavior, and reduced motion;
- canonical first paint with deterministic shell content still correct when external JavaScript is unavailable;
- Series → Reader → Series/Library route continuity;
- **Read → Continue → Finished → Read Again**, including exact resumed CFI where meaningful, bookmark preservation, page-1 restart, and final Unread presentation.

### Reader authority

Reader E2E verifies the real EPUB.js rendition across the matrix:

- protected startup and first readable content;
- Pages next/previous controls and TOC;
- desktop keyboard paging;
- trusted desktop wheel paging in engines where Playwright can deliver it through the sandboxed EPUB boundary;
- mobile Pages swipe policy and input installation;
- progress/bookmark persistence through reload;
- Pages ↔ Continuous switching and usable location preservation;
- Continuous native vertical touch/scroll ownership;
- image-focus activation/isolation and WebKit parent-owned hit targets;
- resize/orientation resilience;
- sleep/resume-style visibility restoration and ticket renewal;
- fullscreen control state on desktop;
- visual-only, legacy-structure, large, and split-XHTML chapter fixtures;
- issue #154 mobile chrome/width/touch-target/image-focus regressions;
- issue #157 full-height Continuous layout and navigation/spine chapter inheritance.

Capability limits are explicit. Playwright WebKit cannot manufacture a trusted cross-frame swipe or trusted wheel through every sandboxed EPUB boundary. Tests therefore combine live canonical navigation acceptance with deterministic source ownership assertions instead of presenting synthetic dispatch as trusted hardware input.

### Garden Keeper authority

Keeper E2E exercises the real client owners while replacing only remote/auth service boundaries:

- locked → Turnstile/session-established → unlocked lifecycle;
- protected status verification and logout cleanup;
- native dialog keyboard containment, Escape behavior, and focus restoration;
- Series metadata + fan-translation save ownership;
- volume translation overrides;
- generated-EPUB upload preflight, review, completion, failure, and retry;
- Maintenance, Catalog History, Trash, and Abuse Watch;
- held-response double-trigger tests proving busy states prevent duplicate mutations;
- recoverable success/error presentation and source-aware browser diagnostics.

### Accessibility authority

The E2E accessibility layer covers application-owned chrome for:

- Library;
- Series;
- Reader;
- Garden Keeper.

It includes bounded automated scans, keyboard-only critical interactions, focus restoration, visible focus, 200%/400% equivalent reflow, `prefers-reduced-motion`, forced colors, increased contrast, and mobile target sizing/labels.

Publication EPUB content has separate ownership limits documented in [`ACCESSIBILITY_TESTING.md`](./ACCESSIBILITY_TESTING.md). Shadow Garden does not silently rewrite arbitrary book semantics to make an automated scan pass.

## Failure artifacts and diagnostics

Playwright uses:

- `trace: 'retain-on-failure'`;
- `screenshot: 'only-on-failure'`;
- `video: 'retain-on-failure'`;
- an HTML report;
- shared console/page-error/failed-network diagnostics.

`.github/workflows/e2e.yml` uploads `playwright-report/` and `test-results/` with a bounded retention period. Generated artifacts are never committed.

## Shared fixtures

`tests/fixtures/` remains the canonical shared deterministic R8 fixture set:

- `catalog-main.json` and `catalog-adult.json`;
- reading-state scenarios;
- media-ticket scenarios;
- visual-page expectations;
- concrete EPUB XHTML snippets.

The E2E workspace has its own generated/route fixtures because it must exercise a real production build and real EPUB.js rather than Node test doubles.

## Commands

```bash
npm run test:unit
npm run test:service
npm run test:dom
npm run test:browser
npm test
npm run check
npm run build
npm run test:e2e
```

`tools/run-tests.mjs` remains the deterministic runner. `npm run check` combines architecture/security guards and the deterministic behavioral suite. `npm run build` repeats that complete check through `prebuild`.

`npm run test:e2e` runs the isolated Playwright workspace; CI installs its pinned dependencies/browser engines separately.

## CI and release ownership

`.github/workflows/verify.yml` is the deterministic repository/build gate.

`.github/workflows/e2e.yml` is the real-browser gate for pull requests and `main`.

For v2 releases, `.github/workflows/release-v2.yml` may publish only when the exact `main` commit:

1. has successful Verify;
2. has successful Real Browser E2E;
3. is the version/commit reported by Cloudflare production;
4. passes Main, Adult, Series, Reader, and robots production smoke.

Only then may the matching GitHub v2 release be created.

## Permanent R8 guard and v2.6 guardrails

The established `tools/check-*.mjs` files remain architecture/security guardrails. The Permanent R8 guard continues to protect the layered deterministic test/fixture contract, while v2.6 adds `tools/check-v2-6.mjs` to permanently protect:

- exact Playwright pin and isolated lockfile;
- the five browser projects;
- E2E failure artifacts;
- representative Library and Reader high-risk tests/source contracts;
- Reader mobile input/Continuous ownership invariants;
- v2.6 release metadata/documentation synchronization;
- the exact-main real-browser release gate.

Future regressions should strengthen the smallest owning deterministic layer and, when browser behavior is material, add or extend the corresponding real-browser case. v2.6 E2E is permanent release infrastructure, not milestone scaffolding.
