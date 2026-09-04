# Shadow Garden Engineering Audit Contract

**Status:** Active for v2.11.0  
**Roadmap:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)  
**Formal release baseline:** v2.10.0

This document defines how Shadow Garden audits architecture and performance before deciding whether refactoring or optimization is justified. The audit is evidence-first: healthy areas are recorded and left alone, and conditional implementation work is created only for demonstrated problems.

## Audit principles

1. **No change is a valid result.** The audit is not successful only when it produces code changes.
2. **Behavior outranks aesthetics.** A cleaner-looking abstraction is not sufficient reason to move ownership.
3. **Realistic scale outranks hypothetical scale.** Use roughly 250–300 series, representative large EPUBs, and realistic Keeper operations.
4. **One owner per responsibility remains the architectural target.** Findings should distinguish true duplicate ownership from intentional adapters/facades.
5. **Measure before optimizing.** Performance work requires a reproduced cost and comparable before/after evidence.
6. **Preserve security, recovery, accessibility, and browser-local Reader data.** Audit/refactor work cannot weaken established contracts.
7. **Prefer deletion and simplification before new infrastructure.** New frameworks, bundlers, caches, queues, or abstraction layers require their own demonstrated need.

## Required audit evidence

The committed audit report should include, where applicable:

- source/module inventory and major dependency direction;
- large/high-coupling modules and why their size/coupling is or is not a problem;
- duplicate parsing, formatting, state, workflow, network, persistence, and rendering ownership;
- compatibility layers/aliases and the supported state that still requires them;
- unused exports, unreachable paths, dead CSS/selectors, and obsolete documentation/comments;
- test architecture seams that rely on implementation text instead of behavior when a safer behavior-level owner exists;
- realistic Library/Reader/Keeper performance observations;
- build/check/test hotspots only where they materially affect maintenance iteration;
- a disposition for every material finding.

## Finding record

Use this minimum shape for material findings:

```text
ID:
Area:
Problem:
Evidence:
Risk/impact:
Disposition: no-action | cleanup | targeted-refactor | measured-optimization | deferred
Proposed owner/change (if any):
Acceptance coverage:
Before/after measurement (optimization only):
PR/commit (when implemented):
```

## Refactor threshold

A targeted refactor is justified only when the audit can show a material maintenance, reliability, testability, or ownership problem. Typical qualifying evidence includes:

- two or more active owners can write or interpret the same state/workflow independently;
- a module combines unrelated responsibilities that repeatedly change independently or obscure failure handling;
- a compatibility path exists for a state/version that no supported runtime can still produce;
- dependency direction is reversed/circular in a way that makes ownership ambiguous or testing unsafe;
- repeated logic can diverge and already requires synchronized changes or duplicate regressions;
- the current seam prevents adequate deterministic or real-browser verification.

File length, coding style preference, abstraction taste, or the existence of an older implementation are not sufficient on their own.

If no finding crosses this threshold, the refactor phase is marked **deferred / no refactor needed**.

## Optimization threshold

A targeted optimization is justified only when:

1. the cost reproduces on a realistic fixture/path;
2. the cost is material to user experience or maintenance iteration;
3. the suspected mechanism can be explained;
4. the change can be measured against the same baseline;
5. the optimization does not weaken behavior/security/accessibility/browser coverage.

Prefer removing repeated work, redundant I/O, unnecessary DOM churn, accidental recomputation, or avoidable serialization before adding architectural machinery.

If realistic use remains healthy, the optimization phase is marked **deferred / no optimization needed**.

## Areas to audit

### Shared domain and public UI

- domain/state single ownership;
- Library model/filter/sort/render pipeline;
- Series rendering and volume-action sharing;
- persistence and navigation restoration boundaries.

### Reader

- book/session bootstrap;
- rendition adapters and Page Map/progress ownership;
- Pages versus Continuous input ownership;
- image focus isolation;
- TOC/search/notes compatibility hooks;
- resume/ticket-renewal lifecycle;
- EPUB.js compatibility layers and supported failure cases.

### Garden Keeper

- shell/client/session ownership;
- Library/Series/upload/maintenance/history/trash/recovery/abuse workflows;
- batch-operation serialization and repeated network/catalog work;
- busy/error lifecycle consistency.

### Pages Functions and storage

- thin-route versus service responsibility;
- auth/media/catalog/storage/validation/abuse/http/admin boundaries;
- duplicate object-key, request, error, or response handling;
- local AWS/B2 operator-tool boundaries versus production `aws4fetch` storage ownership.

### CSS/design system

- duplicate selectors/tokens;
- obsolete compatibility selectors;
- specificity/cascade workarounds;
- feature versus component ownership;
- accessibility and reduced-motion variants.

### Tooling and tests

- obsolete milestone-only checks versus permanent contracts;
- duplicate fixture generation;
- source-text assertions that should be behavior-level where practical;
- generated/authored boundary leakage;
- dependency/runtime/install/build repetition that materially slows iteration.

## Performance baseline rules

Use existing deterministic and Playwright fixtures whenever possible. New fixtures should be synthetic, deterministic, and safe to commit. Do not profile production user data or require production secrets for the core audit.

Broad tripwires are acceptable for severe regressions; brittle microbenchmarks are not. Record environment/context with measurements so small timing differences are not overinterpreted.

## Completion

The audit is complete when every major area has an evidence-backed outcome, every material finding has a disposition, conditional refactor/optimization slices are either implemented or explicitly skipped/deferred, and the permanent Verify, test, build, security/recovery, and five-project browser gates remain green.
