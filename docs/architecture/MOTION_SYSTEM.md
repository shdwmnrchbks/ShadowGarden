# Shadow Garden Motion System

Shadow Garden motion is progressive enhancement. It explains where UI came from, where it moved, and what state changed; it never owns navigation, reading state, catalog state, workflow state, API requests, or persistence.

## Timing contract

- `--sg-motion-press` — 110ms for press feedback.
- `--sg-motion-fast` — 160ms for exits and tiny feedback.
- `--sg-motion-ui` — 210ms for ordinary control/state changes.
- `--sg-motion-layout` — 280ms for panels and layout morphs.
- `--sg-motion-page` — 320ms for major continuity transitions.

Opening motion may be slightly gentler than closing motion. Long decorative choreography is intentionally avoided.

## Runtime contract

`assets/js/motion.js` exposes `window.ShadowGardenMotion` with:

- `reduced` — current reduced-motion preference.
- `transition(update, { types })` — uses the View Transition API when available and appropriate, otherwise executes `update` immediately.
- `decorateControls(scope)` — applies the shared restrained press-feedback class to interactive controls.
- `navigationIntent(direction, target)` — records an optional, transient animation hint for a navigation that another owner is already performing.

The runtime observes ordinary same-origin anchor clicks to classify the next transition as `forward`, `backward`, or `lateral`. The hint is stored only in `sessionStorage`, restored on the destination document, and removed after reveal. The runtime never prevents the click, calls a router, or changes the destination.

Feature modules remain responsible for deciding *when* a transition is meaningful. The motion runtime does not become a router or state owner.

## Garden Keeper contract

Garden Keeper loads the shared motion foundation through its existing composition root and then initializes `assets/js/admin/motion.js` as an observer-only workflow. The Keeper motion workflow may observe DOM state and Keeper lifecycle events, decorate presentation classes, and animate state changes. It must not make `AdminClient` requests, open or close dialogs, mutate canonical upload/library state, or persist application data.

Keeper-specific choreography lives in `assets/css/admin-motion.css`. Dialog entrance, busy/settled actions, manager refreshes, maintenance state, and upload completion are optional presentation effects layered over existing Keeper workflows.

## Accessibility

`prefers-reduced-motion: reduce` collapses shared durations to effectively immediate updates, disables press scaling, suppresses View Transition animation duration, and removes Keeper/navigation choreography. Functional state changes and navigation still occur normally.

## Performance

Prefer `transform` and `opacity`. Avoid JavaScript-driven inertia and continuous layout animation. Native scrolling, native scroll snapping, CSS transitions, MutationObserver-based presentation observation, and browser View Transitions are preferred where they fit the interaction.
