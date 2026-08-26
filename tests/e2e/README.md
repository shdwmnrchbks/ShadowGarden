# Shadow Garden real-browser E2E

This workspace is intentionally isolated from the production package graph. Playwright is pinned here and the suite runs against the built Shadow Garden output with deterministic local fixture catalogs and a generated EPUB.

## What the suite owns

- Chromium, Firefox, and WebKit desktop critical paths.
- Touch-capable Chromium and WebKit mobile projects.
- Public Library, Series, Reader, and Garden Keeper workflows.
- Reader fixture coverage for normal chapters, visual-only content, unusually structured legacy XHTML, and a deliberately large chapter.
- Bounded accessibility scans for Shadow Garden chrome, keyboard/focus restoration, zoom-equivalent reflow, forced colors/increased contrast, and mobile touch-target sizing.
- Failure traces, screenshots, video, console errors, page errors, and failed-request diagnostics.

The generated EPUB under `.generated/` is rebuilt before every E2E run and is ignored by Git. Production B2 content is never required by this suite.

## Run locally

From the repository root:

```sh
npm ci
npm ci --prefix tests/e2e
npx --prefix tests/e2e playwright install chromium firefox webkit
npm run build
npm run test:e2e
```

Accessibility assertions cover Shadow Garden application chrome. Publication-level EPUB accessibility remains a separate content responsibility; see `docs/architecture/ACCESSIBILITY_TESTING.md`.
