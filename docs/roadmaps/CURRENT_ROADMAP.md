# Shadow Garden Current Roadmap — Reliability, Scale & Reader Experience

> **Status:** 🚧 **CURRENT WORK IN PROGRESS**  
> **Starting baseline:** v2.5.0 — Motion & Continuity  
> **Active release:** v2.6.0 — Reliability & Real-Browser Testing  
> **Updated:** 2026-08-26

Shadow Garden has completed its major architecture refactor, security hardening, UX polish, and motion/continuity milestones. The next phase deliberately shifts away from another large refactor or presentation pass. The focus is now proving the application in real browsers and real reading sessions, establishing measurable performance limits, improving Reader quality, and making Garden Keeper operations safer and faster.

Completed roadmaps and milestone records are archived under [`../archive/README.md`](../archive/README.md). This file is the single active project roadmap.

## Working rules

1. **Reliability before new surface area.** A feature is not complete if it works only in source-contract tests or one browser configuration.
2. **Reader stability remains the highest-risk product contract.** Pages, Continuous, Page Map, progress, bookmarks, image focus, ticket renewal, orientation changes, and navigation require regression coverage.
3. **Measure before optimizing.** Performance work begins with reproducible fixtures and budgets, not speculative rewrites.
4. **Preserve v2 ownership.** Do not reintroduce duplicate state/UI owners, patch layers, or a framework rewrite without measured need.
5. **Preserve security invariants.** Private B2, signed media tickets, opaque identities, Turnstile/Garden Pass, signed Keeper sessions, abuse controls, protected Range delivery, and public catalog redaction remain contracts.
6. **Reading data stays browser-local.** No Reader accounts or server-side reading history are introduced by this roadmap.
7. **Accessibility is a functional requirement.** Keyboard use, reduced motion, forced colors, increased contrast, zoom, focus restoration, and touch targets must be verified in a real browser.
8. **Small release slices.** Each release must leave `main` deployable and pass the production release gate.

## Status legend

- ⬜ Planned
- 🟨 In progress
- ✅ Done
- ⏸ Deferred / optional

## Roadmap overview

| Release | Status | Primary outcome |
| --- | --- | --- |
| **v2.6.0 — Reliability & Real-Browser Testing** | 🟨 In progress | Replace browser-contract-only confidence with real Chromium/Firefox/WebKit end-to-end coverage and accessibility verification |
| **v2.7.0 — Performance & Scale** | ⬜ Planned | Establish performance budgets and keep Library/Reader responsive as the collection and EPUB size grow |
| **v2.8.0 — Reader Experience** | ⬜ Planned | Improve long-session reading ergonomics, navigation, typography, search/notes behavior, and EPUB resilience |
| **v2.9.0 — Keeper Productivity & Recovery** | ⬜ Planned | Make large-library administration faster and prove recovery from catalog/storage failures |
| **v2.10.0 — Maintenance & Supply Chain** | ⬜ Planned | Add controlled dependency maintenance, audit visibility, documentation freshness, and long-term operational checks |

---

# v2.6.0 — Reliability & Real-Browser Testing

**Status:** 🟨 In progress  
**Goal:** make real browser behavior—not source regexes or DOM contracts—the final authority for high-risk user flows.

## 2.6A — Real browser harness

- [ ] Add a pinned real-browser E2E runner, with Playwright as the default implementation unless repository constraints demonstrate a better option.
- [ ] Run Chromium, Firefox, and WebKit in CI for a bounded critical-path suite.
- [ ] Add desktop and mobile viewport projects, including touch-capable mobile emulation.
- [ ] Keep existing unit/service/DOM/browser-contract tests; real-browser tests supplement rather than replace deterministic lower layers.
- [ ] Create stable fixture/library startup so E2E tests do not depend on production B2 data.
- [ ] Capture useful failure artifacts such as trace, screenshot, console errors, and failed network requests without committing generated artifacts.

## 2.6B — Critical public flows

- [ ] Main and Adult Library load independently with correct shelf isolation.
- [ ] Search, filters, sorting, Grid/Compact switching, Recently Added, pinned state, and Back/Forward restoration work in a real browser.
- [ ] Series → Reader → Series/Library navigation preserves expected reading state and route continuity.
- [ ] Verify **Read → Continue → Finished → Read Again** end to end, including bookmark preservation and page-1 restart.
- [ ] Verify mobile navigation open/close, independently scrollable drawer content, background scroll lock, sticky header behavior, and orientation/viewport changes.
- [ ] Verify reduced-motion paths perform the same functional transitions without optional choreography.

## 2.6C — Reader reliability matrix

- [ ] Reader opens a valid EPUB and reaches first readable content without uncaught errors.
- [ ] Pages mode: next/previous controls, keyboard navigation, swipe recognition, desktop wheel turns, TOC seek, bookmarks, settings, and fullscreen.
- [ ] Continuous mode: native vertical touch/scroll remains uninterrupted; Reader owns no EPUB-document `touchmove` interception.
- [ ] Switching Pages ↔ Continuous preserves a sensible reading location and canonical Page Map/progress behavior.
- [ ] Image focus opens only from EPUB images; pinch/pan remains isolated to the overlay and closing it preserves live EPUB position.
- [ ] Resize/orientation changes do not corrupt Page Map, progress, focused-image state, or navigation controls.
- [ ] Reader survives sleep/resume-style page visibility changes and ticket renewal without losing the current location.
- [ ] Add fixtures for large chapters, visual-only pages, maps/illustrations, and common malformed-but-readable EPUB structures.

## 2.6D — Garden Keeper real-browser coverage

- [ ] Verify locked → Turnstile/session-established → unlocked Keeper flow with mocked/local service boundaries.
- [ ] Verify dialogs trap/restore focus correctly and remain keyboard-operable.
- [ ] Verify Series editing, translation metadata, upload preflight/completion, maintenance, History, Trash, and Abuse Watch presentation flows.
- [ ] Verify busy/success/error states do not double-submit or leave controls permanently disabled.
- [ ] Verify motion remains observer-only and does not become an API/workflow owner.

## 2.6E — Accessibility verification

- [ ] Add automated accessibility scans on Library, Series, Reader chrome, and Garden Keeper surfaces.
- [ ] Add keyboard-only critical-flow tests and explicit focus restoration assertions.
- [ ] Verify 200% and 400% zoom/reflow on public and Keeper surfaces where applicable.
- [ ] Verify `prefers-reduced-motion`, forced colors, increased contrast, and visible focus treatment.
- [ ] Audit touch target sizes and labels for mobile Reader/navigation controls.
- [ ] Document known EPUB-content accessibility limits separately from Shadow Garden chrome responsibilities.

## v2.6.0 acceptance

- [ ] Critical E2E suite passes on Chromium, Firefox, and WebKit.
- [ ] Mobile Reader/navigation paths have real-browser regression coverage.
- [ ] Accessibility checks cover all four major surfaces: Library, Series, Reader, Garden Keeper.
- [ ] No security or browser-local persistence contract changes are required.
- [ ] `npm run check`, production build, real-browser suite, and production smoke all pass before release.

---

# v2.7.0 — Performance & Scale

**Status:** ⬜ Planned  
**Goal:** establish measurable responsiveness budgets before the personal library becomes large enough to expose architectural bottlenecks.

## 2.7A — Reproducible scale fixtures

- [ ] Add generated 50-, 250-, 1,000-, and larger-series catalog fixtures without committing real library metadata.
- [ ] Add representative small, medium, and large EPUB fixtures/metadata profiles.
- [ ] Keep performance fixtures deterministic and safe for CI.

## 2.7B — Budgets and measurement

- [ ] Measure Library first meaningful catalog paint and post-hydration stability.
- [ ] Measure search/filter/sort response latency at scale.
- [ ] Measure Series render time for large volume counts.
- [ ] Measure Reader time-to-first-readable-page for representative EPUB sizes.
- [ ] Measure long-session Reader memory growth, Continuous scrolling stability, layout shifts, and long tasks.
- [ ] Establish regression budgets with enough tolerance to avoid flaky CI while still catching meaningful degradation.

## 2.7C — Targeted optimization

- [ ] Optimize only after a measured bottleneck is reproduced.
- [ ] Evaluate incremental/virtualized Library rendering if existing incremental rendering no longer meets the budget.
- [ ] Avoid bundler/framework adoption unless profiling demonstrates a concrete startup or delivery problem it would solve.
- [ ] Preserve stable motion identities and accessibility while optimizing DOM work.

## v2.7.0 acceptance

- [ ] Performance baselines and budgets are documented.
- [ ] Large Library fixtures remain responsive within accepted budgets.
- [ ] Reader large-EPUB startup and long-session behavior are measured and protected.
- [ ] No optimization introduces duplicate state ownership or weakens existing E2E coverage.

---

# v2.8.0 — Reader Experience

**Status:** ⬜ Planned  
**Goal:** improve the surface used for hours at a time without destabilizing the Reader architecture.

## Candidate scope

- [ ] Refine typography controls/presets: font family, size, line height, paragraph spacing/margins, and readable defaults.
- [ ] Improve location/progress presentation so chapter and volume position are understandable without clutter.
- [ ] Improve TOC and chapter navigation for long books.
- [ ] Add in-book text search if EPUB.js/runtime constraints permit a robust implementation.
- [ ] Improve bookmark management beyond add/remove at the current location.
- [ ] Audit footnote/endnote/pop-up behavior across common EPUB patterns.
- [ ] Improve resume behavior after orientation changes, reloads, backgrounding, and long idle periods.
- [ ] Expand malformed/common-EPUB compatibility fixtures and graceful error presentation.
- [ ] Evaluate reader-history conveniences such as recently read/completion date only if they remain browser-local.

## v2.8.0 acceptance

- [ ] Every new Reader interaction has Chromium/Firefox/WebKit coverage where technically meaningful.
- [ ] Pages and Continuous retain their separate input ownership.
- [ ] Page Map/progress/bookmarks remain canonical and backward-compatible.
- [ ] No live EPUB viewport pinch/pan or Continuous touch interception is reintroduced.

---

# v2.9.0 — Keeper Productivity & Recovery

**Status:** ⬜ Planned  
**Goal:** reduce repetitive administration and prove the library can recover from operational mistakes or damaged state.

## 2.9A — Keeper productivity

- [ ] Expand safe batch editing for taxonomy/status/translation metadata.
- [ ] Add clear metadata diff/preview before high-impact bulk saves.
- [ ] Add duplicate/similar-volume detection and upload warnings.
- [ ] Improve bulk cover/banner replacement workflows.
- [ ] Produce a concise import/preflight report with actionable validation warnings.
- [ ] Add one-click fixes only where the transformation is deterministic and reversible.
- [ ] Evaluate an operation queue for long maintenance tasks so UI state remains explicit.

## 2.9B — Recovery readiness

- [ ] Define catalog snapshot/backup retention policy.
- [ ] Verify backup objects/checksums and detect unreadable/incomplete recovery material.
- [ ] Document and automate a recovery drill from a damaged/missing catalog to a known-good snapshot.
- [ ] Verify Trash/recovery/purge interactions cannot silently destroy the last recoverable catalog state.
- [ ] Add a Keeper “recovery readiness” or equivalent maintenance report if it can be computed cheaply and reliably.
- [ ] Exercise recovery against local/mocked B2 fixtures in CI; do not make destructive production recovery part of normal CI.

## v2.9.0 acceptance

- [ ] A documented recovery drill succeeds from deterministic fixtures.
- [ ] High-impact Keeper changes provide preview/confirmation and recoverable history where appropriate.
- [ ] Batch operations do not bypass canonical validation, catalog, storage, or admin service owners.

---

# v2.10.0 — Maintenance & Supply Chain

**Status:** ⬜ Planned  
**Goal:** keep the mature application healthy without turning maintenance automation into a source of unreviewed changes.

## Scope

- [ ] Add controlled dependency update automation for the five direct dependencies and GitHub Actions pins.
- [ ] Do not auto-merge EPUB.js, AWS/B2, authentication, or security-sensitive dependency changes without the complete verification matrix.
- [ ] Add dependency/audit reporting with an explicit policy for actionable vs non-actionable findings.
- [ ] Review Node/npm version policy and lockfile integrity on a regular cadence.
- [ ] Add a documentation freshness guard for current version/current roadmap links where practical.
- [ ] Keep release notes, package version, lockfile version metadata, and production version metadata synchronized.
- [ ] Periodically rerun the security, recovery, browser, accessibility, and performance matrices against the current baseline.

## v2.10.0 acceptance

- [ ] Dependency changes are reproducible, reviewable, and covered by the same release gates as product changes.
- [ ] Current documentation no longer presents an archived roadmap as active work.
- [ ] Operational/security checks remain visible without adding fake client-side protection or unnecessary infrastructure.

---

# Cross-release backlog

These are useful ideas, but they should be pulled into a release only when the active milestone has capacity and the change has a clear owner.

- Richer browser-local “Recently Read” and completion history.
- Better multi-filter composition and saved Library views.
- Additional metadata cleanup tools in Garden Keeper.
- More EPUB compatibility fixtures from real-world failures.
- Optional customer-owned Cloudflare-zone hardening if Shadow Garden ever leaves `pages.dev`.

## Explicit non-goals for this roadmap

- Another full-codebase refactor.
- A framework rewrite without measured benefit.
- Server-side Reader accounts/history.
- DRM-like client restrictions such as disabling right-click or DevTools.
- Motion for its own sake.
- Broad feature expansion before real-browser reliability and scale budgets are established.

## Completion rule

This roadmap remains **CURRENT WORK IN PROGRESS** until its active release and subsequent planned releases are either completed, intentionally deferred, or superseded by a new roadmap. When superseded, archive this file and create a new single active roadmap rather than accumulating multiple “current” plans.
