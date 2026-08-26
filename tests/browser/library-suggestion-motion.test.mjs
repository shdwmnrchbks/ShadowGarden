import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('Library suggestion refresh stays controller-owned while motion adds transition and exhaustion feedback', async () => {
  const [motion, css, library, spec] = await Promise.all([
    read('src/assets/js/library-motion.js'),
    read('src/assets/css/library-motion.css'),
    read('src/assets/js/library.js'),
    read('tests/e2e/specs/library.spec.mjs')
  ]);

  assert.match(library, /renderContinue\(\{reroll:true\}\)/, 'canonical Library controller must continue to own suggestion rerolls');
  assert.match(motion, /raw\.closest\("\[data-another-suggestion\]"\)/, 'motion adapter must observe the existing reroll control');
  assert.match(motion, /viewTransitionName="library-suggestion"/, 'recommendation panel must receive a bounded transition identity');
  assert.match(motion, /viewTransitionName="library-suggestion-art"/, 'banner artwork must transition with the recommendation');
  assert.match(motion, /motion\.reduced\|\|typeof document\.startViewTransition!=="function"/, 'reduced motion and unsupported browsers must bypass View Transitions');
  assert.match(motion, /The Garden has no other path to suggest just now\./, 'same-candidate rerolls must provide themed local feedback');
  assert.match(motion, /notice\.setAttribute\("role","status"\)/, 'reroll exhaustion feedback must be announced accessibly');
  assert.match(motion, /after===before/, 'feedback must depend on the canonical reroll returning the same identity');

  assert.match(css, /::view-transition-group\(library-suggestion\)/, 'suggestion panel View Transition choreography must remain declared');
  assert.match(css, /::view-transition-group\(library-suggestion-art\)/, 'suggestion artwork View Transition choreography must remain declared');
  assert.match(css, /\.suggestion-notice\.is-visible/, 'local exhaustion feedback must have an explicit visible state');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'suggestion motion must retain the reduced-motion contract');
  assert.match(css, /\.continue-panel\.suggestion-refreshed.*animation:none!important/s, 'fallback suggestion animation must be disabled for reduced motion');

  assert.ok(spec.includes('reading suggestion reroll advances and pinned series remain available in the navigation drawer'), 'real-browser suite must preserve the canonical changing-suggestion contract');
  assert.ok(spec.includes('reading suggestion reroll explains when the Garden has no alternate path'), 'real-browser suite must cover same-result feedback');
  assert.ok(spec.includes("toHaveText('The Garden has no other path to suggest just now.')"), 'real-browser suite must assert themed exhaustion copy');
});
