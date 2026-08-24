# Module Naming and Ownership Conventions

**Refactor milestone:** R1 — Repository and tooling hygiene  
**Applies to:** authored browser JavaScript/CSS, Pages Functions helpers, and tooling added after R1

Shadow Garden's v1 source accumulated corrective layers such as `*-polish.js`, `*-current.css`, version-named files, and post-render observers. Those files are grandfathered until the milestone that owns their replacement, but they are not the naming model for new code.

## One owner per responsibility

Every new module should have a primary responsibility that can be described without the words "fix", "patch", "polish", or "overhaul".

Prefer names that describe the owned domain or role:

- `catalog.js`, `reading-state.js`, `book-identity.js` for domain/service modules;
- `library-controller.js`, `filter-controller.js`, `completion-controller.js` for orchestration;
- `volume-card.js`, `continue-banner.js`, `version-footer.js` for components/renderers;
- `admin-api-client.js`, `book-session.js`, `media-service.js` for integration boundaries;
- `storage.js`, `urls.js`, `format.js`, `validation.js` for narrowly scoped utilities.

A module that only mutates DOM or state already owned elsewhere is architectural debt unless it is explicitly temporary and linked to a removal milestone.

## Forbidden names for new permanent source

Do not introduce new permanent files matching these patterns:

- `*-polish.js` / `*-polish.css`
- `*-fix.js` / `*-fix.css`
- `*-patch.js` / `*-patch.css`
- version-named source such as `feature-v1.2.js`, `site-v1.9.4.css`, or equivalent
- vague replacement layers such as `*-current.*` when a domain/role name is available

Temporary migration files are allowed only when all of the following are true:

1. the file is named for the migration rather than a version when practical;
2. its owner and deletion milestone are documented in the active roadmap/PR;
3. it does not become a second permanent owner for the same state or UI;
4. it is added to the explicit legacy/temporary exception manifest and removed when the migration closes.

R1's checker grandfathered only files that already existed at the frozen v1.15.14 baseline. Adding another patch-style filename without updating the architectural exception record is a CI failure by design.

## Dependency direction

New browser code should move toward this direction:

```text
page bootstrap/controller
  -> domain/state/service modules
  -> renderer/component modules
  -> browser APIs / network boundary
```

Avoid sideways dependencies where two UI scripts observe and repair one another. Avoid global `window` state unless the owning boundary is documented and a legacy integration requires it.

New Pages Functions code should move toward:

```text
route handler
  -> validation/auth/domain service
  -> B2/http transport
```

Route files should not become new general-purpose utility modules.

## DOM ownership

- The code that renders an element owns its visible state whenever possible.
- A later script should not mirror a button state onto another control when both can be rendered from the same action model.
- MutationObserver is appropriate for genuinely external/async DOM, not as a default replacement for direct ownership.
- Event delegation is preferred over cloning listeners manually when cloned content is an intentional part of a feature.

## State ownership

- Persistent browser state must go through the canonical service that owns that state once R2 introduces it.
- Until R2, existing v1 keys and compatibility aliases remain frozen by `PERSISTENCE_CONTRACTS.md` and `check-r0.mjs`.
- UI modules must not invent a fourth reading state beyond Unread / In Progress / Finished.
- Security state remains server-authoritative; UI state is never authorization.

## CSS ownership

R7 will perform the large stylesheet consolidation. Until then:

- new styles should be placed in the stylesheet owned by the relevant surface/component when safe;
- do not create another version-specific override sheet just to beat cascade order;
- avoid new `!important` rules unless required for an external/embedded document boundary;
- theme differences should be expressed as variants/tokens rather than copied business logic.

## File placement

- Browser source: `src/assets/js/` and `src/assets/css/`.
- Reader submodules: `src/assets/js/reader/` until R4 establishes the final layout.
- Pages Functions route handlers: `functions/`.
- Shared backend helpers/services: `functions/_lib/` until R6 establishes the final service directories.
- Build/validation utilities: `tools/`; reusable tool helpers may live under `tools/lib/`.
- Architecture/security/style documentation: `docs/` through the single `docs/README.md` index.

These rules intentionally constrain new debt without forcing premature renames of v1 files. Existing patch layers are removed only in the milestone that can prove behavior parity.
