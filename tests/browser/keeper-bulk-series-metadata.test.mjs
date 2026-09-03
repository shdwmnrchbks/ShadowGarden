import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('v2.9 Keeper bulk series metadata keeps preview, backup, and canonical mutation ownership', async () => {
  const [app, workflow, spec, css] = await Promise.all([
    read('src/assets/js/admin/app.js'),
    read('src/assets/js/admin/bulk-edit-workflow.js'),
    read('tests/e2e/specs/keeper-bulk-series-metadata.spec.mjs'),
    read('src/assets/css/admin-bulk-edit.css')
  ]);

  for (const marker of [
    '"/assets/js/admin/bulk-edit-workflow.js"',
    '"bulkEdit"'
  ]) assert.ok(app.includes(marker), marker);

  for (const marker of [
    'keeper.registerWorkflow("bulkEdit"',
    'data-bulk-series-select',
    'bulkSeriesPreview',
    'normalizeGenres',
    'normalizeTags',
    'normalizeSeriesStatus',
    'action:"create-backup",reason:"before-bulk-series-metadata"',
    'action:"update-series"',
    'for(const item of changed)',
    'if(saving)return;',
    'setBusy(true);',
    'No further series were changed.',
    'keeper.events.dispatchEvent(new Event("library:invalidate"))'
  ]) assert.ok(workflow.includes(marker), marker);

  assert.ok(
    workflow.indexOf('setBusy(true);') < workflow.indexOf('const result=await plans()'),
    'Bulk save must establish its busy guard before asynchronous preview planning so rapid repeat activation cannot duplicate the batch'
  );
  assert.ok(
    workflow.indexOf('action:"create-backup",reason:"before-bulk-series-metadata"') < workflow.indexOf('for(const item of changed)'),
    'A catalog backup must be created before any selected series is mutated'
  );
  assert.match(
    workflow,
    /return\{action:"update-series",id:series\.id,title:series\.title\|\|"",author:series\.author\|\|"",year:series\.year\|\|"",status:after\.status,genres:after\.genres,tags:after\.tags,description:series\.description\|\|"",audioAlignedUrl:series\.audioAlignedUrl\|\|"",adult:entry\.scope==="adult",translationStatus:after\.translationStatus,translations:after\.translations\}/,
    'Bulk edits must preserve unrelated canonical series metadata while patching only staged fields'
  );

  for (const marker of [
    'Garden Keeper bulk series metadata previews diffs, backs up first, and keeps canonical saves single-submit',
    "page.locator('[data-bulk-series-select]')",
    "page.locator('#bulkSeriesPreview')",
    "page.locator('#saveBulkSeriesEdit')",
    "controls.backupCount",
    "controls.updateBodies",
    "reason: 'before-bulk-series-metadata'",
    "entry.path === '/admin-api/library' && entry.body?.action === 'update-series'",
    'expect(browserDiagnostics).toEqual([])'
  ]) assert.ok(spec.includes(marker), marker);

  assert.match(css, /\.manager-bulk-select/, 'Series selection must have a dedicated Keeper presentation');
  assert.match(css, /\.bulk-edit-preview-item/, 'Per-series diff rows must remain visually distinct before save');
});
