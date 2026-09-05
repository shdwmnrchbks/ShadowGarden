# v2.11C — Library, Series & Browser-Local Domain Audit

> **Status:** ✅ Implementation complete; final PR-head verification required before merge  
> **Measured code head:** `f64fa1ea4e74287146800687ca9d2e27efa6e9c3`  
> **Measurement fixture:** 300 series / 1,950 volumes  
> **Date:** 2026-09-04

Audit C revalidated the public Library, Series page, and browser-local reading/preferences domain at the roadmap's realistic upper-bound fixture. The audit found several repeated state/render/read owners worth fixing, but it did **not** find evidence for a Library/Series architecture rewrite, virtualization, a framework change, or server-side reading history.

## Ownership conclusion

The accepted ownership remains:

- `domain/catalog.js` owns catalog normalization and public catalog meaning.
- `data-source.js` owns public catalog source/network acquisition. It coalesces concurrent requests and permits one successful startup snapshot to pass from a cache-tolerant sibling owner (pinned navigation) to the page controller; ordinary later loads remain fresh.
- `library-model.js` owns Library filtering, contextual facet counts, validation, and sorting. Browser-local Finished state is evaluated only when the active reading-status filter actually requires it.
- `domain/reading-state.js` owns volume/series reading state, progress interpretation, Finished state, and Library banner selection.
- `library-renderers.js` owns presentation and derives card state from the already-materialized volume entries supplied by the domain path; it does not launch a second persisted-state scan.
- `library.js` owns URL/control/render orchestration and performs one canonical catalog render per user action.
- `domain/progress.js`, `domain/bookmarks.js`, and `domain/preferences.js` remain the canonical browser-local persistence owners.
- Series rendering/navigation remains a separate public controller surface and did not demonstrate a structural or runtime problem.

## Findings and decisions

| ID | Finding | Evidence | Decision |
| --- | --- | --- | --- |
| C-001 | Contextual Library filtering read Finished state even when no reading-status filter was active. | Baseline hydration performed 121,905 localStorage reads; the interaction workload performed 314,387. The dominant category was Finished-state lookup multiplied through contextual facet evaluation. | ⚡ Evaluate `seriesFinished()` only when `readingStatus` is active; regression-test blank-filter laziness. |
| C-002 | Card and banner paths repeatedly rebuilt the same per-volume reading state. | Series cards independently scanned whole-series Finished state and then rebuilt volume entries; `volumeEntries()` itself could reread progress; Library banner selection rebuilt volume entries for continue/next/random candidate passes. | ⚡ Materialize volume state once per render/decision path and derive downstream state from those entries. |
| C-003 | Library startup had two catalog request owners. | Measured public navigation was Library=2 requests / Series=1 because pinned navigation and the page controller could miss the in-flight coalescing window. | 🧹 Keep `data-source.js` as network owner; add bounded one-shot startup sharing. Final measured ownership is Library=1 / Series=1. |
| C-004 | Some Library actions had duplicate render ownership. | Active filter handling and the Recent “View all” path could trigger repeated `apply()`/catalog insertion passes; initial filter collection also duplicated work already owned by `apply()`. | 🧹 Keep one canonical `apply()` per action and browser-test catalog insertion ownership. |
| C-005 | Realistic 300-series rendering might require virtualization. | Final fixture hydrates 36 cards, reaches 120 rendered cards after interaction, keeps 2 Documents / 61 listeners on Library, and completes the measured Series page with zero long tasks. | ⏭ No virtualization or framework rewrite. Existing incremental rendering is adequate for the intended personal-library scale. |
| C-006 | Browser-local domain/Series ownership might require consolidation. | Progress, bookmarks, Finished state, pinned/preferences, URL state, volume actions, catalog meaning, and Series rendering each retain one explicit owner; no duplicate business-rule owner was found after the targeted fixes. | ⏭ Keep the current module boundaries. |

## Before/after evidence

The most important optimization was removing unnecessary persisted-state work rather than changing the DOM architecture.

| Workload | Initial reads | Final reads | Reduction |
| --- | ---: | ---: | ---: |
| Library hydration | 121,905 | 14,211 | 88.3% |
| Library interaction sequence | 314,387 | 11,645 | 96.3% |
| Series page | ~322 initial observation | 274 final | bounded / already small |

Final localStorage read composition:

- **Hydration:** 14,211 total = 4,717 Finished-index + 4,716 Finished-marker + 4,732 progress + 41 pinned + 5 other Shadow Garden reads.
- **Interactions:** 11,645 total = 3,794 Finished-index + 3,794 Finished-marker + 3,794 progress + 263 pinned.
- **Series:** 274 total = 98 Finished-index + 98 Finished-marker + 74 progress + 3 pinned + 1 other Shadow Garden read.

The remaining reads correspond to actual rendered/card/banner state and reading-status work. The audit does not justify adding a new cache/index layer merely to chase lower synthetic counters.

## Final Chromium measurement

The final pre-documentation runtime measurement on the 300-series / 1,950-volume fixture reported:

- hydration: **441.3 ms**;
- unique search: **321.1 ms**;
- search clear: **254.4 ms**;
- author filter: **113.9 ms**;
- title sort: **347.3 ms**;
- grid → compact: **1,033.4 ms**;
- incremental 60 → 120 load: **149.9 ms**;
- 12-volume Series page: **358.3 ms**;
- catalog requests: **2 total — Library 1, Series 1**;
- active-filter catalog insertion passes: **1**;
- Library long tasks: **4**, 444 ms total, 152 ms maximum;
- Series long tasks: **0**.

The slower individual clear/filter/view measurements vary materially between CI runs while storage counters and ownership remain stable. The evidence therefore supports structural single-owner assertions rather than runner-sensitive millisecond ceilings.

### Library resource shape

After hydration:

- 2 Documents;
- 61 JS event listeners;
- 3,259 Nodes;
- 781 DOM elements;
- 36 rendered series cards;
- ~2.84 MiB JS heap used.

After the measured interaction sequence and incremental load:

- 2 Documents;
- 61 JS event listeners;
- 7,513 Nodes;
- 1,873 DOM elements;
- 120 rendered series cards;
- ~4.02 MiB JS heap used.

The unchanged Document/listener counts and expected DOM growth with intentionally rendered cards do not indicate a leak or a need for virtualization.

### Series resource shape

The 12-volume Series page measured:

- 1 Document;
- 41 JS event listeners;
- 948 Nodes;
- 201 DOM elements;
- 12 volume cards;
- ~2.65 MiB JS heap used;
- zero long tasks.

## Regression contracts added

- blank reading-status filtering must not invoke `seriesFinished()`;
- `volumeEntries()` performs one progress lookup pass per volume;
- Library cards derive whole-series Finished state from their existing volume entries;
- Library banner selection shares one materialized volume-state pass across continue/next/random decisions;
- active filter removal performs one canonical catalog insertion pass;
- Recent “View all” clears filters through one canonical catalog insertion pass;
- the public runtime audit requires exactly one catalog request for Library and exactly one for Series;
- catalog startup sharing is deterministic and one-shot: the page owner can consume the pinned-nav startup result once, while a later normal load must fetch fresh.

## Verification evidence

The measured catalog/state implementation on `a8094738021a92f1c2438bd3f3379d629012656e` passed Chromium desktop/mobile, Firefox desktop, WebKit desktop/mobile, with the runtime audit reporting Library=1 / Series=1. The final code head `f64fa1ea4e74287146800687ca9d2e27efa6e9c3` additionally removes the Recent “View all” double render and has a green Verify/build result. PR-head five-browser verification remains the final closure gate for the documentation/test-only tail of this audit.

## Disposition

Audit C supports **targeted optimization and cleanup only**. The observed cost came from repeated browser-local state scans and duplicate owners, not from the overall Library/Series architecture.

Do not:

- add Library virtualization for the intended ~300-series scale;
- introduce a framework/bundler rewrite for this surface;
- move progress, bookmarks, Finished state, or preferences server-side;
- add a broad persisted-state cache without a new measured need;
- merge Library and Series controllers merely to reduce file count.

The accepted outcome is the existing ownership model with the measured duplicate reads, requests, and renders removed.
