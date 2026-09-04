# v2.11F — CSS, Motion & Accessibility Audit

**Status:** In progress — baseline instrumentation  
**Stack base:** Audit E exact-green head `a239bfe6b3fa7c4d84d4575c0cc8f3829322c51f`  
**Scope:** Authored stylesheet ownership, selector/token maintenance, motion policy, and accessibility presentation contracts

## Audit question

Does the mature CSS/motion layer contain genuinely unused selectors or tokens, conflicting component ownership, specificity escalation, obsolete compatibility styling, or accessibility-policy gaps that justify targeted cleanup?

Audit F remains measurement-first. Static candidates are not deletion evidence by themselves because Shadow Garden creates state classes dynamically in JavaScript and deliberately shares a small set of cross-surface presentation contracts.

## Initial composition inventory

The repository currently contains **36 authored stylesheets** under `src/assets/css/`.

Production composition is intentionally split by surface:

- Library and Adult Library share the public foundation (`site.css`, `nav.css`, `motion.css`, Library/public component sheets) with `adult.css` added only to the restricted surface.
- Series shares the public foundation and public component contracts, then adds `series-extra.css` and `series-motion.css`.
- Reader does not load the public `site.css`/`nav.css` foundation. It owns `reader.css` plus Reader-scoped rail, page-map, completion, end-page, image-focus, notes, a11y, themes, presentation, and motion sheets. It deliberately shares only narrow cross-surface contracts such as `motion.css`, `reading-status.css`, `volume-actions.css`, and `ui-symbols.css`.
- Garden Keeper loads the public shell foundation (`site.css`, `nav.css`, `motion.css`) and a set of Admin-scoped sheets ending with `admin-motion.css`.

This composition is the baseline. File count alone is not evidence for consolidation.

## Report-only ownership instrumentation

`tools/audit-css-ownership.mjs` provides a deterministic static inventory and exits successfully regardless of findings. `npm run audit:css` is run in normal Verify so the audit can capture exact-head evidence without prematurely converting heuristics into policy.

The report measures:

- linked stylesheet composition for Library, Adult Library, Series, Reader, and Garden Keeper;
- class and ID selector ownership across authored CSS files;
- static candidate class selectors with no literal production HTML/JS reference;
- custom-property definitions and candidate unused tokens;
- class tokens styled by multiple files;
- selectors containing IDs or four-plus class/attribute/pseudo components;
- `!important`, keyframe, reduced-motion, forced-colors, and increased-contrast counts.

Static unreferenced-class output is explicitly advisory. Dynamic class construction, runtime state, and compatibility contracts must be traced before any selector is removed.

## Existing behavioral gate retained

Audit F starts with the existing real-browser accessibility suite rather than inventing a parallel harness. Current coverage already exercises bounded accessibility scans across public/Reader/Keeper chrome, 200%/400% equivalent reflow, Reader keyboard focus restoration, forced-colors/increased-contrast visible focus, mobile Reader 44px labelled targets, and browser zoom. Existing deterministic motion tests also cover the shared motion foundation and Library, Series/Reader, and Keeper navigation behavior.

## Decision rule

No broad stylesheet rewrite is justified by this baseline. Audit F will accept changes only where the static report and behavioral evidence identify a concrete ownership, maintenance, motion, or accessibility defect. Candidate cleanup must preserve the public/Keeper versus Reader-scoped boundary and must re-clear the exact-head real-browser matrix.
