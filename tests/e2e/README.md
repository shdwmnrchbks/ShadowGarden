# Shadow Garden Real-Browser E2E

This workspace is the v2.6 real-browser verification layer. It supplements the deterministic Node unit/service/DOM/browser-contract suites; it does not replace them.

## Install

From the repository root:

```sh
npm ci
npm ci --prefix tests/e2e
npm exec --prefix tests/e2e -- playwright install chromium firefox webkit
```

## Run

Build the same static output used by production, then run Playwright:

```sh
npm run build
npm run test:e2e
```

`playwright.config.mjs` starts `tools/preview.mjs` against generated `dist/`. Tests intercept catalog/source/version and fixture cover requests so normal E2E verification does not depend on production Backblaze B2 state.

## Browser matrix

- Chromium desktop
- Firefox desktop
- WebKit desktop
- Chromium mobile emulation
- WebKit mobile emulation

CI retains traces, screenshots, video, the HTML report, and attached console/page/network diagnostics when useful for failures. Generated browser output is ignored by Git.

## Ownership

Real-browser tests verify user-observable behavior. Existing `tests/browser/` files remain fast browser-contract/source tests under Node. New high-risk regressions should normally have the cheapest deterministic test that can prove the contract plus a real-browser case when layout, browser APIs, focus, touch, navigation, or EPUB runtime behavior is part of the failure mode.
