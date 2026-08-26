# Accessibility testing contract

Shadow Garden treats accessibility as a functional reliability requirement for application chrome. Real-browser tests verify the public Library, Series, Reader chrome, and Garden Keeper in Chromium, Firefox, and WebKit projects.

## Automated coverage

The bounded browser scan checks visible interactive controls for accessible names, visible images for explicit `alt` handling, open dialogs for names, and duplicate IDs. This is intentionally deterministic and repository-owned; it supplements keyboard interaction tests rather than pretending to replace assistive-technology testing.

The E2E matrix also verifies:

- keyboard-only Reader drawer operation and focus restoration;
- visible focus under `forced-colors: active` and `prefers-contrast: more`;
- 200% and 400% reflow equivalents using 640px and 320px effective CSS viewports from a 1280px baseline;
- labelled 44px mobile Reader navigation targets;
- reduced-motion behavior in the existing public navigation suite;
- Reader fullscreen-state feedback and Pages-mode swipe behavior;
- visual-only, unusually structured legacy, and large-chapter EPUB fixtures.

## Responsibility boundary

Shadow Garden owns the accessibility of its own HTML, controls, dialogs, navigation, Reader chrome, focus behavior, and presentation around the EPUB rendition.

EPUB publication content is author/publisher supplied. Shadow Garden must preserve useful publication semantics and must not deliberately strip accessibility information, but it cannot guarantee that every EPUB has correct headings, language metadata, image alternatives, reading order, table semantics, or other publication-level accessibility metadata. Fixture EPUBs are used to make the Reader resilient to common structures; they are not a claim that malformed or inaccessible publication content becomes conformant merely by opening in Shadow Garden.

When an accessibility defect is in Shadow Garden chrome, fix it in Shadow Garden. When the defect originates inside a publication, preserve the content as faithfully as practical and document the limit rather than silently rewriting book semantics.
