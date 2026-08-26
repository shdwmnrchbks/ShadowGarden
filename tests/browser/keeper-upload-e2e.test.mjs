import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('v2.6 Keeper upload preflight and completion remain canonical real-browser contracts', async () => {
  const [spec, batch, workflow, core, fixtures] = await Promise.all([
    read('tests/e2e/specs/keeper-upload.spec.mjs'),
    read('src/assets/js/admin-batch.js'),
    read('src/assets/js/admin-upload-workflow.js'),
    read('src/assets/js/admin/core.js'),
    read('tests/e2e/support/fixtures.mjs')
  ]);

  for (const marker of [
    'Garden Keeper performs real EPUB preflight → reviewed upload → completion once while busy',
    'Garden Keeper upload failure preserves the reviewed queue and restores retry controls',
    "page.locator('#epubFile').setInputFiles(epubPath)",
    "page.locator('#preflightState')",
    "page.locator('#uploadReviewSummary')",
    "button.click(); button.click();",
    'state.uploadCount',
    'state.catalogCount',
    "page.locator('#workflowNextBatch')",
    "window.ShadowGardenKeeper?.state?.batch?.running",
    'sourceUrl',
    '/assets/js/admin-batch.js',
    'toBeLessThanOrEqual(1)'
  ]) assert.ok(spec.includes(marker), marker);

  assert.match(batch, /JSZip\.loadAsync\(bytes\)/, 'EPUB preflight must continue to inspect the real archive locally');
  assert.match(batch, /async function addFiles\(files\)/, 'batch owner must retain file selection and inspection');
  assert.match(batch, /if\(q\.running\|\|!state\.unlocked\)return/, 'upload owner must reject re-entry while busy or locked');
  assert.match(batch, /q\.running=true;state\.uploading=true;batchUpload\.disabled=true/, 'busy state must be established before upload awaits');
  assert.match(batch, /await uploadObject\(epubKey,item\.file,"application\/epub\+zip"\)/, 'EPUB bytes must continue through the canonical upload helper');
  assert.match(batch, /api\("\/admin-api\/catalog",\{method:"POST"/, 'catalog finalization must remain the canonical metadata mutation');
  assert.match(batch, /finally\{\s*q\.running=false;state\.uploading=false/, 'upload busy state must always recover in finally');

  assert.match(workflow, /function renderComplete\(successes,failures\)/, 'reviewed upload workflow must own success and partial completion presentation');
  assert.match(workflow, /if\(success\)clearSuccessfulQueue\(\)/, 'full success must clear the completed queue');
  assert.match(workflow, /Failed\/reviewable entries remain in the queue/, 'partial failure must preserve reviewable queue entries');
  assert.match(workflow, /if\(mode==='uploading'\)return/, 'presentation workflow must ignore duplicate upload-mode transitions');
  assert.match(workflow, /function finishSettledBatch\(\)/, 'presentation must recover a settled batch even if the base state pill is overwritten');
  assert.match(workflow, /if\(mode!=='uploading'\|\|q\.running\)return false/, 'settled-batch recovery must wait until the canonical batch owner releases busy state');
  assert.match(workflow, /setUploadState\(failures\.length\?'COMPLETE WITH ERRORS':'COMPLETE'/, 'settled recovery must restore the terminal upload label before rendering completion');
  assert.match(workflow, /else if\(typeof setUploadState==='function'\)\{const ready=actionable\(\)\.length;setUploadState\(ready\?'READY':'WAITING'/, 'returning to the reviewed editor must explicitly leave terminal state');

  assert.match(fixtures, /message\.location\(\)/, 'browser diagnostics must retain console source locations for engine-independent error classification');
  assert.match(fixtures, /sourceUrl:\s*location\.url\s*\|\|\s*''/, 'console diagnostics must expose the source URL without changing the public fixture API');

  assert.match(core, /class AdminClient/, 'Keeper upload requests must continue through the single AdminClient');
  assert.match(core, /async uploadObject\(key,blob,type\)/, 'AdminClient must remain upload-object owner');
  assert.match(core, /this\.request\(`\/admin-api\/upload\?key=/, 'AdminClient upload helper must retain the protected upload endpoint');
});
