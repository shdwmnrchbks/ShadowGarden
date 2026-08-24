# Shadow Garden Test Architecture

R8 establishes a layered, deterministic regression suite for the refactored Shadow Garden architecture. It uses the Node 22 built-in test runner and production modules directly, without introducing a test framework, browser bundle, network dependency, or a second application implementation.

## Test layers

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

These tests intentionally invoke the same R6 service and `_lib` modules used by Pages Functions. External B2/Turnstile calls are not mocked into fake success paths; network-dependent behavior remains covered by the established security guards and final production smoke work.

### DOM

`tests/dom/`

DOM tests exercise renderer ownership with narrow test doubles from `tests/helpers/fake-dom.mjs`. The doubles implement only the APIs the renderer under test actually consumes. This makes new hidden DOM dependencies fail visibly instead of being silently supplied by a large emulation library.

Current coverage includes:

- Grid/Compact card markup;
- pinned and volume badge presentation;
- Recently Added canonical Continue state;
- reading-banner action/state/artwork ownership.

### Browser smoke

`tests/browser/`

The browser-smoke layer verifies browser-facing entrypoints and high-risk interaction contracts without adding a new headless-browser dependency during R8:

- Main, Adult, Series, Reader, and Garden Keeper entrypoint surfaces;
- semantic CSS/runtime entrypoint wiring;
- actual cover/map/illustration/chapter XHTML fixtures;
- Visual Page Cache + Paginated visual contain-fit ownership;
- **Read → Continue → Finished → Read Again** end-to-end browser-local state/action flow;
- Read Again bookmark preservation and `restart=1` URL contract;
- Adult catalog isolation during Read Again;
- Pages horizontal swipe versus Continuous native-touch behavior;
- image-focus pinch/pan isolation from live EPUB documents;
- Garden Keeper composition-root and protected unlock/status boundaries.

This layer is a deterministic browser-contract smoke suite, not a full Chromium/WebKit deployment test. R10 still owns the final real production/browser regression matrix; R9 may make a deliberate browser-runner dependency decision if it provides measurable value.

## Shared fixtures

`tests/fixtures/` is the canonical R8 fixture set.

- `catalog-main.json` — Main shelf, including a single-volume series and a multi-volume series with long metadata.
- `catalog-adult.json` — isolated Adult shelf fixture.
- `reading-states.json` — Unread/In Progress/Finished/Read Again expectations.
- `media-ticket-scenarios.json` — signed-ticket valid/tampered/expired scenarios.
- `visual-pages.json` — visual-only and normal spine expectations.
- `epub/cover.xhtml`, `map.xhtml`, `illustration.xhtml`, `chapter.xhtml` — concrete EPUB spine document fixtures.

Fixtures contain no production secrets, private catalog data, or live storage URLs requiring authorization.

## Deterministic browser helpers

`tests/helpers/browser-env.mjs` provides browser-local storage, location, events, and simple browser globals. `tests/helpers/fake-dom.mjs` provides narrow DOM elements/class/style behavior for renderer tests.

Each test owns and restores its global state. Test files run with `--test-concurrency=1` within each layer, and the layered runner executes layers explicitly so failures identify their architectural boundary.

## Commands

```bash
npm run test:unit
npm run test:service
npm run test:dom
npm run test:browser
npm test
```

`tools/run-tests.mjs` is the single runner entrypoint. `npm run check` runs the existing security/refactor guards, the R8 architecture guard, and the full layered test suite. `npm run build` repeats `npm run check` through `prebuild` before generating production output.

## Coverage ownership

The established `tools/check-*.mjs` files remain architecture/security guardrails. R8 tests do not replace them. Guardrails answer “is the required owner/boundary still present?” while `tests/` increasingly answers “does the behavior produce the expected result for representative fixtures?”

The two forms are intentionally complementary:

- Security Milestones 1–9 and R0–R7 retain their permanent guards.
- R8 adds reusable behavioral fixtures and layer-specific execution.
- Future regressions should add the smallest fixture/test at the owning layer rather than another one-off root check script.

## Permanent R8 guard

`tools/check-r8.mjs` protects:

- the four test-layer directories and layered runner;
- required fixture families;
- priority reading flow coverage;
- Reader Page/Continuous/image-focus coverage;
- signed-ticket tamper/expiry coverage;
- Keeper authorization/workflow smoke coverage;
- package scripts and CI integration;
- the v1.23.0 R8 roadmap/documentation contract.
