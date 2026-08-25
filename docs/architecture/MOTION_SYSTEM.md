# Shadow Garden Motion System

Shadow Garden motion is progressive enhancement. It explains where UI came from, where it moved, and what state changed; it never owns navigation, reading state, catalog state, or persistence.

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

Feature modules remain responsible for deciding *when* a transition is meaningful. The motion runtime does not intercept links globally.

## Accessibility

`prefers-reduced-motion: reduce` collapses shared durations to effectively immediate updates, disables press scaling, and suppresses View Transition animation duration. Functional state changes still occur normally.

## Performance

Prefer `transform` and `opacity`. Avoid JavaScript-driven inertia and continuous layout animation. Native scrolling, native scroll snapping, and browser View Transitions are preferred where they fit the interaction.
