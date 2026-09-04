# Archived Shadow Garden Roadmap — Reliability, Reader Experience & Operations

> **Status:** 🗄️ Archived — completed 2026-09-04  
> **Former active scope:** v2.6.x through v2.10.0  
> **Superseded by:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)

This file preserves the complete roadmap that was formerly `docs/roadmaps/CURRENT_ROADMAP.md`. It is historical planning only; shipped behavior remains defined by release records and architecture contracts.

---

# Shadow Garden Current Roadmap — Reliability, Reader Experience & Operations

> **Status:** ✅ **CURRENT RELEASE COMPLETE**  
> **Starting baseline:** v2.6.x — Reliability & Reader hardening  
> **Active release:** v2.10.0 — Maintenance & Supply Chain  
> **Updated:** 2026-09-04

Shadow Garden has completed its major architecture refactor, security hardening, UX polish, motion/continuity milestone, the v2.6 real-browser reliability milestone, targeted v2.6.x Reader fixes, the v2.8 Reader Experience milestone, v2.9 Keeper Productivity & Recovery, and v2.10 Maintenance & Supply Chain. This file remains the single current roadmap until a successor roadmap takes ownership. Performance work remains intentionally limited to realistic personal-library scale and should not displace operational work unless measurements expose a real bottleneck.

Completed roadmaps and milestone records are archived under [`../archive/README.md`](../archive/README.md). This file is the single active project roadmap. Completed releases inside this roadmap remain recorded here so the handoff into the next active release is explicit.

## Working rules

1. **Reliability before new surface area.** A feature is not complete if it works only in source-contract tests or one browser configuration.
2. **Reader stability remains the highest-risk product contract.** Pages, Continuous, Page Map, progress, bookmarks, image focus, ticket renewal, orientation changes, and navigation require regression coverage.
3. **Measure realistic usage before optimizing.** Shadow Garden is a personal library; performance work should target the expected collection ceiling (roughly 250–300 series) plus representative large EPUBs, not speculative 1,000+ series workloads.
4. **Optimize only demonstrated bottlenecks.** Do not add virtualization, framework/bundler changes, or architectural complexity without a measured problem at realistic scale.
5. **Preserve v2 ownership.** Do not reintroduce duplicate state/UI owners, patch layers, or a framework rewrite without measured need.
6. **Preserve security invariants.** Private B2, signed media tickets, opaque identities, Turnstile/Garden Pass, signed Keeper sessions, abuse controls, protected Range delivery, and public catalog redaction remain contracts.
7. **Reading data stays browser-local.** No Reader accounts or server-side reading history are introduced by this roadmap.
8. **Accessibility is a functional requirement.** Keyboard use, reduced motion, forced colors, increased contrast, zoom, focus restoration, and touch targets must be verified in a real browser.
9. **Small release slices.** Each release must leave `main` deployable and pass the production release gate.

## Status legend

- ⬜ Planned
- 🟨 In progress
- ✅ Done
- ⏸ Deferred / optional

## Roadmap overview

| Release | Status | Primary outcome |
| --- | --- | --- |
| **v2.6.0 — Reliability & Real-Browser Testing** | ✅ Done | Real Chromium/Firefox/WebKit end-to-end and accessibility coverage is now a permanent release gate |
| **v2.7.0 — Performance Sanity** | ⏸ Deferred / optional | Keep a lightweight guard for realistic ~300-series libraries and large EPUBs; optimize only if measurements justify it |
| **v2.8.0 — Reader Experience** | ✅ Done | Improve long-session reading ergonomics, navigation, focused typography choices, search behavior, and EPUB resilience |
| **v2.9.0 — Keeper Productivity & Recovery** | ✅ Done | Make library administration faster and prove recovery from catalog/storage failures |
| **v2.10.0 — Maintenance & Supply Chain** | ✅ Done | Controlled dependency maintenance, audit visibility, documentation/version guards, and periodic operational baselines |

---

# v2.6.0 — Reliability & Real-Browser Testing

**Status:** ✅ Done  
**Completed:** 2026-08-26  
**Release record:** [`../releases/v2.6.0.md`](../releases/v2.6.0.md)  
**Goal:** make real browser behavior—not source regexes or DOM contracts—the final authority for high-risk user flows.

## 2.6A — Real browser harness

- [x] Add a pinned real-browser E2E runner, with Playwright as the default implementation unless repository constraints demonstrate a better option.
- [x] Run Chromium, Firefox, and WebKit in CI for a bounded critical-path suite.
- [x] Add desktop and mobile viewport projects, including touch-capable mobile emulation.
- [x] Keep existing unit/service/DOM/browser-contract tests; real-browser tests supplement rather than replace deterministic lower layers.
- [x] Create stable fixture/library startup so E2E tests do not depend on production B2 data.
- [x] Capture useful failure artifacts such as trace, screenshot, console errors, and failed network requests without committing generated artifacts.

## 2.6B — Critical public flows

- [x] Main and Adult libraries hydrate from isolated fixture catalogs.
- [x] Search, compact view, and Back navigation restore rendered Library state.
- [x] Reading suggestion reroll advances and pinned series remain available in the navigation drawer.
- [x] Verify **Read → Continue → Finished → Read Again** end to end, including bookmark preservation and page-1 restart.
- [x] Verify mobile navigation open/close, independently scrollable drawer content, background scroll lock, sticky header behavior, and orientation/viewport changes.
- [x] Verify reduced-motion paths perform the same functional transitions without optional choreography.

## 2.6C — Reader reliability matrix

- [x] Reader opens a valid EPUB and reaches first readable content without uncaught errors.
- [x] Pages mode: next/previous controls, keyboard navigation, swipe recognition, desktop wheel turns, TOC seek, bookmarks, settings, and fullscreen.
- [x] Continuous mode: native vertical touch/scroll remains uninterrupted; Reader owns no EPUB-document `touchmove` interception.
- [x] Switching Pages ↔ Continuous preserves a sensible reading location and canonical Page Map/progress behavior.
- [x] Image focus opens only from EPUB images; pinch/pan remains isolated to the overlay and closing it preserves live EPUB position.
- [x] Resize/orientation changes do not corrupt Page Map, progress, focused-image state, or navigation controls.
- [x] Reader survives sleep/resume-style page visibility changes and ticket renewal without losing the current location.
- [x] Add fixtures for large chapters, visual-only pages, maps/illustrations, and common malformed-but-readable EPUB structures.

The release also closes the late mobile Reader reports tracked in #154 and #157: Continuous artwork/chrome geometry, direction-aware auto-hide behavior, reliable one-tap image focus, paginated chrome clearance, full-height Continuous reading after auto-hide, and spine/nav-based chapter inheritance across split XHTML are all covered by the final browser matrix.

## 2.6D — Garden Keeper real-browser coverage

- [x] Verify locked → Turnstile/session-established → unlocked Keeper flow with mocked/local service boundaries.
- [x] Verify dialogs trap/restore focus correctly and remain keyboard-operable.
- [x] Verify Series editing, translation metadata, upload preflight/completion, maintenance, History, Trash, and Abuse Watch presentation flows.
- [x] Verify busy/success/error states do not double-submit or leave controls permanently disabled.
- [x] Verify motion remains observer-only and does not become an API/workflow owner.

## 2.6E — Accessibility verification

- [x] Add automated accessibility scans on Library, Series, Reader chrome, and Garden Keeper surfaces.
- [x] Add keyboard-only critical-flow tests and explicit focus restoration assertions.
- [x] Verify 200% and 400% zoom/reflow on public and Keeper surfaces where applicable.
- [x] Verify `prefers-reduced-motion`, forced colors, increased contrast, and visible focus treatment.
- [x] Audit touch target sizes and labels for mobile Reader/navigation controls.
- [x] Document known EPUB-content accessibility limits separately from Shadow Garden chrome responsibilities.

## v2.6.0 acceptance

- [x] Critical E2E suite passes on Chromium, Firefox, and WebKit.
- [x] Mobile Reader/navigation paths have real-browser regression coverage.
- [x] Accessibility checks cover all four major surfaces: Library, Series, Reader, Garden Keeper.
- [x] No security or browser-local persistence contract changes are required.
- [x] `npm run check`, production build, real-browser suite, and production smoke all pass before release.

The reusable v2 publisher now requires the exact `main` commit to pass both Verify and Real Browser E2E, then match Cloudflare production version/commit metadata and pass the public production smoke before creating the GitHub release. The regression matrix remains permanent after v2.6 rather than being treated as milestone-only scaffolding.

---

# v2.7.0 — Performance Sanity

**Status:** ⏸ Deferred / optional  
**Goal:** retain a small, realistic performance guard without spending a full development cycle on scale Shadow Garden is not expected to reach.

This milestone is deliberately bounded. It may be completed as a small standalone release, folded into v2.8, or left deferred until profiling shows a real need. It must not block Reader Experience work merely to satisfy an arbitrary release number.

## 2.7A — Realistic fixtures

- [ ] Add one deterministic catalog stress fixture around the expected upper bound of **250–300 series** without committing real library metadata.
- [ ] Add or identify one representative large EPUB fixture/profile for Reader startup and Continuous-mode sanity checks.
- [ ] Keep fixtures deterministic, lightweight, and safe for CI.

## 2.7B — Minimal measurement

- [ ] Confirm Library load, search, filtering, sorting, and Series navigation remain subjectively responsive at the 250–300-series fixture.
- [ ] Record a lightweight baseline for Reader time-to-first-readable-page on the large EPUB fixture.
- [ ] Exercise an extended Continuous-mode session well enough to catch obvious runaway memory growth, severe layout instability, or long-task regressions.
- [ ] Prefer broad regression thresholds or documented observations over brittle micro-benchmarks.

## 2.7C — Optimization only when justified

- [ ] Fix only bottlenecks that are reproduced at realistic scale.
- [ ] Do **not** add Library virtualization/infinite rendering solely for hypothetical 1,000+ series collections.
- [ ] Do **not** adopt a framework/bundler or split state ownership as a performance shortcut.
- [ ] Preserve motion identity, accessibility, Reader behavior, and existing E2E coverage in any optimization that is actually required.

## v2.7.0 acceptance

- [ ] The Library remains healthy around the expected 250–300-series ceiling.
- [ ] A representative large EPUB reaches readable content and survives extended Continuous reading without an obvious severe regression.
- [ ] Any optimization included in the release is backed by a reproduced problem, not speculative scale planning.
- [ ] No performance work weakens the existing real-browser release gate.

### Explicitly dropped from the former v2.7 scope

- 1,000+ and larger-series catalog targets.
- A dedicated performance-budget infrastructure project.
- Virtualization or incremental-rendering rewrites without measured need.
- Broad long-session profiling work that is not tied to a reproducible Reader problem.

---

# v2.8.0 — Reader Experience

**Status:** ✅ Done  
**Completed:** 2026-09-03  
**Release record:** [`../releases/v2.8.0.md`](../releases/v2.8.0.md)  
**Goal:** improve the surface used for hours at a time without destabilizing the Reader architecture.

## Slice 1 — Focused typeface choices

- [x] Replace the legacy Book/System/Classic menu with exactly four choices: **Default**, **Sans**, **Serif**, and **Sans-Serif**.
- [x] Make **Default** publication-owned: Shadow Garden must not force a `font-family`, so the EPUB's own default font remains authoritative.
- [x] Use **PT Sans** for Sans, **Literata** for Serif, and **Inter** for Sans-Serif.
- [x] Migrate legacy browser-local font preferences safely (`book` → Default, `system` → Inter, `classic` → Literata).
- [x] Keep font size, line height, text width, flow, and the rest of the existing Reader settings unchanged.

## Slice 2 — Clear location and progress

- [x] Present the canonical device page, volume percentage, and current chapter together in Pages mode without introducing a second progress calculation.
- [x] Keep narrow/mobile chrome compact by prioritizing page and percentage visually while retaining full chapter context in the underlying label and accessibility text.
- [x] Make the Continuous seek rail mirror the same canonical progress owner with a compact page label and a richer `aria-valuetext`/title.
- [x] Preserve the existing browser-local progress payload and Page Map ownership; Slice 2 is a presentation change, not a persistence migration.
- [x] Add deterministic formatter coverage and a real-browser regression spanning Pages and Continuous presentation.

## Slice 3 — Long-book Contents navigation

- [x] Add in-place Contents filtering without introducing a second navigation model.
- [x] Keep the search tray collapsed behind a magnifying-glass action beside Bookmarks so the drawer stays compact by default.
- [x] Add a `Current` action that clears filtering, expands the live chapter path, reveals it, and restores keyboard focus without moving the rendition.
- [x] Preserve the existing TOC collapse state when filtering clears and keep Page Map/progress/bookmarks untouched.
- [x] Cover desktop/mobile Contents filtering, Bookmarks handoff, focus, and the Reader Escape contract in the real-browser matrix.

## Slice 4 — In-book text search

- [x] Use the existing Contents search surface as the single Reader search entry point, with matching Contents entries listed before whole-book text results; `Ctrl/Cmd+F` opens and focuses the same unified search.
- [x] Search the canonical EPUB spine sequentially through the existing EPUB.js `Book`/`Section` objects rather than creating a second rendition or loading the whole book into the live DOM.
- [x] Generate CFI-backed results with chapter/context excerpts and open them through the existing Reader `navigate()` path.
- [x] Bound expensive searches with a three-character minimum, cancellable sequential scanning, per-section unloading, and a 100-result cap.
- [x] Preserve Page Map, progress, bookmark persistence, Pages/Continuous input ownership, and browser-local reading data.
- [x] Add deterministic query coverage plus real-browser search, result navigation, keyboard shortcut, cap, focus, and Escape behavior.

### Explicitly skipped from v2.8 scope

- Expanded bookmark management beyond the existing save/open/remove behavior. Bookmark data is intentionally browser-local and can disappear when browser site data is cleared, so v2.8 will not add bookmark naming, notes, sorting, bulk management, or related persistence-heavy UI.

## Candidate follow-up scope

- [x] Audit footnote/endnote/pop-up behavior across common EPUB patterns; explicit noterefs now open sanitized Reader-owned popups without moving the live passage, including same-document footnotes and cross-document endnotes.
- [x] Improve resume behavior after orientation changes, reloads, backgrounding, and long idle periods.
- [x] Expand malformed/common-EPUB compatibility fixtures and graceful error presentation.
- [ ] Evaluate reader-history conveniences such as recently read/completion date only if they remain browser-local. Deferred to the cross-release backlog; this is not a v2.8 release blocker.

## v2.8.0 acceptance

- [x] Every new Reader interaction has Chromium/Firefox/WebKit coverage where technically meaningful.
- [x] Pages and Continuous retain their separate input ownership.
- [x] Page Map/progress/bookmarks remain canonical and backward-compatible.
- [x] No live EPUB viewport pinch/pan or Continuous touch interception is reintroduced.

---

# v2.9.0 — Keeper Productivity & Recovery

**Status:** ✅ Done  
**Completed:** 2026-09-03  
**Release record:** [`../releases/v2.9.0.md`](../releases/v2.9.0.md)  
**Goal:** reduce repetitive administration and prove the library can recover from operational mistakes or damaged state.

## 2.9A — Keeper productivity

- [x] Expand safe batch editing for taxonomy/status/translation metadata.
- [x] Add clear metadata diff/preview before high-impact bulk saves.
- [x] Add duplicate/similar-volume detection and upload warnings.
- [x] Improve bulk cover/banner replacement workflows.
- [x] Produce a concise import/preflight report with actionable validation warnings.
- [x] Add one-click fixes only where the transformation is deterministic and reversible.
- [x] Evaluate an operation queue for long maintenance tasks so UI state remains explicit.

## 2.9B — Recovery readiness

- [x] Define catalog snapshot/backup retention policy.
- [x] Verify backup objects/checksums and detect unreadable/incomplete recovery material.
- [x] Document and automate a recovery drill from a damaged/missing catalog to a known-good snapshot.
- [x] Verify Trash/recovery/purge interactions cannot silently destroy the last recoverable catalog state.
- [x] Add a Keeper “recovery readiness” or equivalent maintenance report if it can be computed cheaply and reliably.
- [x] Exercise recovery against local/mocked B2 fixtures in CI; do not make destructive production recovery part of normal CI.

## v2.9.0 acceptance

- [x] A documented recovery drill succeeds from deterministic fixtures.
- [x] High-impact Keeper changes provide preview/confirmation and recoverable history where appropriate.
- [x] Batch operations do not bypass canonical validation, catalog, storage, or admin service owners.

---

# v2.10.0 — Maintenance & Supply Chain

**Status:** ✅ Done  
**Completed:** 2026-09-04  
**Release record:** [`../releases/v2.10.0.md`](../releases/v2.10.0.md)  
**Goal:** keep the mature application healthy without turning maintenance automation into a source of unreviewed changes.

## Scope

- [x] Add controlled dependency update automation for the five direct dependencies and GitHub Actions pins.
- [x] Do not auto-merge EPUB.js, AWS/B2, authentication, or security-sensitive dependency changes without the complete verification matrix.
- [x] Add dependency/audit reporting with an explicit policy for actionable vs non-actionable findings.
- [x] Review Node/npm version policy and lockfile integrity on a regular cadence.
- [x] Add a documentation freshness guard for current version/current roadmap links where practical.
- [x] Keep release notes, package version, lockfile version metadata, and production version metadata synchronized.
- [x] Periodically rerun the security, recovery, browser, accessibility, and realistic-scale performance matrices against the current baseline.

## v2.10.0 acceptance

- [x] Dependency changes are reproducible, reviewable, and covered by the same release gates as product changes.
- [x] Current documentation no longer presents an archived roadmap as active work.
- [x] Operational/security checks remain visible without adding fake client-side protection or unnecessary infrastructure.

v2.10.0 completes the controlled dependency-maintenance, policy-driven audit reporting, reviewed Node/npm and lockfile-integrity, documentation freshness, release-metadata synchronization, and periodic baseline slices. The formal package version, deployment version, lockfile metadata, changelog, and release record now converge at v2.10.0; the permanent exact-main Verify, real-browser, production-deployment, and smoke gates remain authoritative for publication.

---

# Cross-release backlog

These are useful ideas, but they should be pulled into a release only when the active milestone has capacity and the change has a clear owner.

- Richer browser-local “Recently Read” and completion history.
- Better multi-filter composition and saved Library views.
- Additional metadata cleanup tools in Garden Keeper.
- More EPUB compatibility fixtures from real-world failures.
- Optional customer-owned Cloudflare-zone hardening if Shadow Garden ever leaves `pages.dev`.
- Revisit deeper performance engineering only if realistic fixtures or production use expose an actual bottleneck.

## Explicit non-goals for this roadmap

- Another full-codebase refactor.
- A framework rewrite without measured benefit.
- Server-side Reader accounts/history.
- DRM-like client restrictions such as disabling right-click or DevTools.
- Motion for its own sake.
- Engineering for hypothetical 1,000+ series collections without evidence that Shadow Garden needs it.
- Blocking Reader improvements on speculative performance infrastructure.

## Completion rule

This roadmap is complete through v2.10.0. It remains the single current roadmap until superseded; when a successor takes ownership, archive this file and create one new active roadmap rather than accumulating multiple “current” plans.
