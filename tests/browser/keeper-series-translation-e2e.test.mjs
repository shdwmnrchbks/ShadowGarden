import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('v2.6 Keeper Series and translation real-browser contract keeps one save owner per mutation', async () => {
  const [spec, library, translations, interactions, core] = await Promise.all([
    read('tests/e2e/specs/keeper-series-translation.spec.mjs'),
    read('src/assets/js/admin/library-workflow.js'),
    read('src/assets/js/admin/translation-workflow.js'),
    read('src/assets/js/admin/editor-interactions.js'),
    read('src/assets/js/admin/core.js')
  ]);

  for (const marker of [
    'Garden Keeper series and translation saves remain single-owner, single-submit real-browser flows',
    "page.goto('/admin.html')",
    "page.locator('#manageTitle')",
    "page.locator('#manageTranslationStatus')",
    "page.locator('#addTranslationCredit')",
    "page.locator('#saveSeries')",
    "controls.seriesSaveCount",
    "firstVolume.locator('[data-save-volume-translation]')",
    "controls.volumeSaveCount",
    "entry.path === '/admin-api/library' && entry.method === 'POST'",
    "entry.path === '/admin-api/translations' && entry.method === 'POST'",
    'expect(browserDiagnostics).toEqual([])'
  ]) assert.ok(spec.includes(marker), marker);

  assert.match(
    library,
    /const translationPayload=keeper\.workflows\.get\("translations"\)\?\.instance\?\.seriesPayload\?\.\(\)\|\|\{\}/,
    'Series save must obtain translation metadata from the registered translation workflow'
  );
  assert.match(
    library,
    /client\.request\("\/admin-api\/library",\{method:"POST"[\s\S]*action:"update-series"[\s\S]*\.\.\.translationPayload/,
    'Series metadata and translation metadata must remain one canonical library mutation'
  );
  assert.match(
    translations,
    /client\.request\("\/admin-api\/translations",\{method:"POST"[\s\S]*target:"volume"/,
    'Volume translation overrides must remain owned by the translations endpoint'
  );
  assert.match(
    translations,
    /button\.disabled=true;button\.textContent="Saving…"/,
    'Volume translation saves must establish busy state before awaiting the request'
  );
  assert.match(interactions, /kind:"manager-open",value:target\.dataset\.managerOpen/, 'Series editor focus return must remember stable manager identity');
  assert.match(interactions, /document\.contains\(remembered\.element\)/, 'Focus return must prefer the original opener while it remains live');
  assert.match(interactions, /document\.querySelectorAll\(`\[\$\{attribute\}\]`\)/, 'Focus return must resolve a replacement manager control after rerender');
  assert.match(interactions, /target\.focus\(\{preventScroll:true\}\)/, 'Resolved Keeper focus targets must receive focus without scroll jumps');
  assert.match(core, /class AdminClient/, 'Keeper mutations must continue through the single AdminClient');
  assert.match(core, /headers\.set\("authorization",`Bearer \$\{this\.token\(\)\}`\)/, 'AdminClient must remain the authorization header owner');
});
