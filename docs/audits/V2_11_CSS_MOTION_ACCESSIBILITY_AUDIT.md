# v2.11F — CSS, Motion & Accessibility Audit

**Status:** Closeout candidate — final exact-head browser gate pending  
**Stack base:** Audit E exact-green head `a239bfe6b3fa7c4d84d4575c0cc8f3829322c51f`  
**Measured CSS/tooling head:** `5b1d7bb4887c9cbcdbbacb759d49c11fbc0d175e`  
**Scope:** Authored stylesheet ownership, selector/token maintenance, motion policy, and accessibility presentation contracts

## Audit question

Does the mature CSS/motion layer contain genuinely unused selectors or tokens, conflicting component ownership, specificity escalation, obsolete compatibility styling, or accessibility-policy gaps that justify targeted cleanup?

Audit F remained measurement-first. Static candidates were never treated as deletion evidence by themselves because Shadow Garden creates state classes dynamically in JavaScript and deliberately shares a small set of cross-surface presentation contracts.

## Composition result

The repository contains **36 authored stylesheets** under `src/assets/css/`.

Production composition remains intentionally split by surface:

- Library and Adult Library share the public foundation (`site.css`, `nav.css`, `motion.css`, Library/public component sheets) with `adult.css` added only to the restricted surface.
- Series shares the public foundation and public component contracts, then adds `series-extra.css` and `series-motion.css`.
- Reader does not load the public `site.css`/`nav.css` foundation. It owns `reader.css` plus Reader-scoped rail, page-map, completion, end-page, image-focus, notes, a11y, themes, presentation, and motion sheets. It deliberately shares only narrow cross-surface contracts such as `motion.css`, `reading-status.css`, `volume-actions.css`, and `ui-symbols.css`.
- Garden Keeper loads the public shell foundation (`site.css`, `nav.css`, `motion.css`) and Admin-scoped workflow/layout/component/presentation/motion sheets.

File count alone does not justify consolidation, and the audit found no cross-surface ownership defect that requires a stylesheet architecture rewrite.

## Ownership instrumentation

`tools/audit-css-ownership.mjs` is run as `npm run audit:css` in normal Verify. It inventories:

- linked stylesheet composition for Library, Adult Library, Series, Reader, and Garden Keeper;
- class and ID selector ownership across authored CSS files;
- static candidate class selectors with no literal production HTML/JS reference;
- custom-property definitions and consumers;
- class tokens styled by multiple files;
- selectors containing IDs or four-plus class/attribute/pseudo components;
- per-file specificity-watch and `!important` concentration;
- `!important`, keyframe, reduced-motion, forced-colors, and increased-contrast coverage.

Class-reference, shared-ownership, and specificity findings remain audit signals rather than generic CI failures. Custom-property ownership is different: an authored custom-property definition with no CSS `var()` or production HTML/JS consumer now fails Audit F's Verify step.

## Accepted cleanup

The static inventory was traced into production ownership and used to remove only selectors/tokens with concrete evidence that their owner had disappeared or been superseded. Accepted cleanup covered:

- unused Adult palette roots;
- unused Reader chrome roots;
- unused public/base background roots;
- obsolete Garden Keeper backup-row and Maintenance state selectors;
- the retired batch empty placeholder;
- unused motion utility selectors;
- the obsolete Reader completion-dialog shell;
- obsolete Library filter-note selectors;
- retired Keeper choice-card presentation;
- unused public compatibility selectors;
- the unused Adult filter-label compatibility selector;
- unused nav-button compatibility selectors.

The resulting measured head has **0 static candidate unreferenced class selectors** and **0 unused custom properties**.

## Final static snapshot

On measured head `5b1d7bb4887c9cbcdbbacb759d49c11fbc0d175e`, normal Verify reports:

- **36** authored stylesheets;
- **2,254** selectors;
- **12** stylesheets intentionally shared by multiple production surfaces;
- **0** static candidate unreferenced class selectors;
- **0** unused custom properties;
- **181** class tokens styled in multiple files;
- **137** specificity-watch selectors containing an ID or four-plus class/attribute/pseudo components;
- **428** `!important` declarations;
- reduced-motion coverage in **20** stylesheets;
- forced-colors coverage in **5** stylesheets;
- increased-contrast coverage in **2** stylesheets;
- **40** keyframe definitions.

The largest specificity-watch owners are `library-layout.css` (24), `admin-presentation.css` (17), `library-features.css` (13), and `public-artwork.css` (12). The largest `!important` owners are `admin-components.css` (102), `reader-interface-themes.css` (68), `library-layout.css` (55), and `public-artwork.css` (41).

## Specificity / `!important` decision

The aggregate counts do not justify a mass cascade rewrite.

Sampling the largest owners shows a deliberate later-layer pattern:

- `admin-components.css` is a late-loaded Keeper workflow/component layer that overrides older public/Admin foundations for the retained New Books/preflight/backup UI.
- `reader-interface-themes.css` is a palette override layer; its job is to force the selected Reader interface theme across chrome, drawers, completion UI, focus presentation, and Continuous controls without importing public CSS ownership into Reader.
- `library-layout.css` is a later compact-layout/skeleton/mobile behavior layer and intentionally overrides the base card/grid presentation.
- `public-artwork.css` is a focused artwork presentation layer shared by public Library/Series surfaces.

The high-specificity list likewise concentrates in explicit Keeper workflow states, Library compact/mobile states, and Series motion/hydration states. No browser or maintenance evidence demonstrates that flattening those contracts would reduce defects enough to justify the regression risk.

One apparently suspicious compatibility selector is intentionally retained: `#openSeries.sg-legacy-open-series`. The reviewed stateful New Books workflow explicitly adds `sg-legacy-open-series` to suppress the old single-upload completion link while the new workflow owns its completion/series chooser. Removing that selector would re-expose a superseded UI owner.

**Disposition:** retain the current layered cascade. Future cleanup must be driven by a concrete conflict or maintenance defect, not by a target `!important` count.

## Motion and accessibility gate

Audit F reuses the existing real-browser accessibility suite rather than introducing a parallel accessibility harness. Current coverage exercises:

- bounded accessibility scans across public, Reader, and Keeper chrome;
- 200%/400% equivalent zoom/reflow behavior;
- Reader keyboard focus restoration;
- forced-colors/increased-contrast visible focus;
- mobile Reader 44px labelled targets;
- browser zoom behavior;
- deterministic reduced-motion and navigation-motion contracts across shared motion, Library, Series/Reader, and Keeper behavior.

The first exact Audit F browser pass was green in Chromium desktop, Firefox desktop, WebKit desktop, and WebKit mobile. Chromium mobile's Audit F accessibility cases also passed, but a later unrelated `public-reading-lifecycle` progress-advance assertion timed out; that job was superseded by the subsequent audit commit before its isolated rerun completed. The final closeout gate is therefore the complete five-project matrix on the final documentation head, not a waiver of the mobile project.

## Decision gate

Audit F found **bounded stale CSS ownership**, not evidence for a stylesheet architecture rewrite or an accessibility/motion redesign.

Accepted work is limited to:

1. deterministic CSS ownership instrumentation in normal Verify;
2. a permanent custom-property consumer guard;
3. evidence-backed retirement of stale selectors/tokens;
4. reporting concentration of shared ownership, specificity, and `!important` pressure so future audits can distinguish real conflicts from intentional override layers.

Keep the current public/Keeper versus Reader-scoped boundary. Do not consolidate stylesheets, flatten Reader themes into public CSS, or bulk-remove `!important`/high-specificity selectors without a demonstrated defect.

Audit F closes only after Verify, production build, Cloudflare preview, and Chromium desktop/mobile, Firefox desktop, and WebKit desktop/mobile are green on the exact final head.
