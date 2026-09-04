# v2.11D — Garden Keeper & Operational Workflows Audit

> **Status:** ✅ Audit complete on measured product head `78ceaff278cfbb56a808ab91030eda182cc917b4`  
> **Stacked PR:** #226 (`audit/v2.11-keeper-runtime-ownership`)  
> **Audit date:** 2026-09-05  
> **Roadmap:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)

Audit D revalidated the retained Garden Keeper workflows after Batch Edit and Batch Artwork retirement. The result is two targeted request-ownership optimizations. Existing workflow decomposition, security boundaries, sequential recovery-sensitive operations, and retry/error ownership remain in place.

## Scope

Reviewed retained browser owners and their real-browser regressions:

- Authentication/session
- Library and Series management
- fan-translation editing
- New Books / multi-EPUB Upload
- Maintenance / Garden Health
- Catalog History
- Trash & Recovery
- Abuse Watch
- Recovery Readiness

The retired catalog-wide Batch Edit and Batch Artwork features remain absent. `admin-batch.js` and `admin-batch-editor.js` are retained because they belong to the live New Books multi-EPUB queue; `admin-batch-editor.js` is only the queued-EPUB editor selector, not the retired catalog-wide feature.

## D-001 — Maintenance snapshot request ownership

### Baseline

The initial Chromium audit opened and reopened the Maintenance dialog after Keeper unlock. Each open caused three identical maintenance-snapshot reads:

- `GET /admin-api/maintenance`: **3**
- `GET /admin-api/abuse`: **1**

The three maintenance reads came from Maintenance, History, and Trash independently responding to `maintenance:opened`. Resource shape stayed flat across reopen, so the defect was duplicate network ownership rather than a document/listener leak.

Baseline measurement commit: `f9edfe0e7b3c34f2feb1c5b692ea239bc4bdcf94`.

### Change

- `admin/maintenance-workflow.js` remains the canonical dialog-hydration owner and already publishes its full server result as `maintenance:data`.
- History and Trash now consume `maintenance:data` instead of independently GETting the same endpoint when the dialog opens.
- Trash restore/purge reuses the fresh maintenance snapshot returned by its own mutation.
- A plain external `trash:changed` invalidation still performs one fresh maintenance load because the originating workflow supplied no replacement maintenance data.

### Result

On the final measured product head:

- first Maintenance open: **1** `GET /admin-api/maintenance` + **1** `GET /admin-api/abuse`
- Maintenance reopen: **1** `GET /admin-api/maintenance` + **1** `GET /admin-api/abuse`
- Documents: **1 → 1 → 1**
- event listeners: **185 → 185 → 185**
- rendered node shape settles after the first open rather than growing on reopen.

The browser regression also proves that Trash's own mutation snapshot causes **0 follow-up maintenance GETs**, while an external Trash invalidation causes exactly **1**.

First fully validated maintenance-ownership head: `7f276c178b2a8936bc12d6201898e476f9bdaa1e`.

Decision: **⚡ measured optimization justified and implemented**. Separate Maintenance, History, and Trash presentation/action owners are retained.

## D-002 — Upload duplicate-detection catalog ownership

### Baseline

The Library workflow already loads `/admin-api/library` on `session:unlocked` and stores the result in canonical `state.management`. The batch engine's first EPUB preflight nevertheless initialized its private duplicate-detection snapshot with another GET.

Chromium baseline on `ba649fa4e4abca03ef65491fe4e69549ea01c202`:

- after unlock: **1** Library GET
- after first EPUB preflight: **2** Library GETs
- preflight delta: **+1**

### Change

`admin/upload-events.js` is the existing Upload lifecycle bridge, so it now mirrors canonical `library:changed` data into the batch engine's read-only `q.library` snapshot. It also clears that snapshot on session lock.

This does not create another catalog owner:

- Library still owns server fetch/mutation and `state.management`.
- Upload only derives a batch-local lookup snapshot for duplicate detection.
- normal Library mutations already publish `library:changed`, so the batch snapshot stays current.
- `admin-batch.js` retains its existing GET fallback when no Library snapshot is available, preserving correctness if preflight races unlock-time Library hydration.
- terminal upload/reset continues to clear batch-local Library state.

### Result

Chromium on measured product head `78ceaff278cfbb56a808ab91030eda182cc917b4`:

**Materialized snapshot path**

- after unlock: **1** Library GET
- after first EPUB preflight: **1** Library GET
- preflight delta: **0**

**Fallback path with canonical snapshot deliberately absent**

- after unlock: **1** Library GET
- after first EPUB preflight: **2** Library GETs
- preflight delta: **+1**

Decision: **⚡ measured optimization justified and implemented**. The fallback is retained rather than assuming Library hydration always wins the race.

## Areas revalidated with no change

### Authentication/session

`admin/auth-session.js` remains the sole browser session owner. Unlock still orders Turnstile challenge → `/admin-access` verification → protected `/admin-api/status` validation → client authorization latch. Lock closes both browser and server session state. No duplicate session owner was found.

### Library / Series / translations

`admin/library-workflow.js` remains the canonical management owner. Mutations reuse their returned management payloads and publish `library:changed`. `admin/translation-workflow.js` reads canonical management state, owns only translation mutation, and invalidates Library once after a volume override save. No independent catalog refresh loop was found.

### Abuse Watch

Abuse Watch remains a separate security-telemetry owner. One `/admin-api/abuse` GET on Maintenance open/explicit refresh is intentional; its mutation response is rendered directly. Folding abuse telemetry into the maintenance snapshot would weaken rather than clarify ownership.

### Recovery Readiness

Recovery Readiness remains on-demand and single-submit. It performs one `/admin-api/recovery-readiness` request only when the Keeper asks for a check and invalidates its previous report after History, Trash, Library, or session changes so stale READY state cannot survive relevant mutation.

### Sequential maintenance and upload work

The audit did not parallelize recovery-sensitive work without evidence:

- deep B2 verification remains sequential in bounded 25-object batches;
- cover optimization remains one candidate at a time;
- multi-EPUB upload keeps deterministic queue/order semantics and preserves failed/reviewable items for retry.

Existing operation-queue, upload-success/failure, preflight-report, similar-volume, recovery-readiness, auth/session, translation, and abuse-failure browser regressions cover these paths. The measured problem was duplicate snapshot ownership, not sequential execution cost.

## Verification

Measured product head `78ceaff278cfbb56a808ab91030eda182cc917b4`:

- Verify / `npm run check` / production build: **pass**
- Chromium desktop: **55 passed, 7 skipped** on the full 62-test project; both new Upload audit contracts pass
- Chromium mobile: **pass**
- Firefox desktop: **pass**
- WebKit projects on that run were cancelled only because a subsequent documentation commit superseded the branch run; they were not test failures.

The final documentation head must therefore complete a fresh five-project Real Browser E2E run before PR #226 is considered exact-head green.

## Audit D disposition

Audit D found **two bounded request-ownership defects**, not evidence for a Garden Keeper rewrite:

1. Maintenance/History/Trash performed three identical maintenance snapshot GETs per dialog open → reduced to one canonical Maintenance GET.
2. first Upload preflight re-fetched a Library snapshot already materialized during unlock → reduced to zero extra GETs while retaining the one-GET fallback when canonical data is absent.

Keep the existing workflow decomposition, single `AdminClient`, security/session boundary, recovery-sensitive ordering, and explicit invalidation events. No speculative batching, broad caching layer, or Keeper framework rewrite is justified by the audit evidence.
