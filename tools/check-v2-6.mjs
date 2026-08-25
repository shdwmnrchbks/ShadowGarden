import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = file => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const json = async file => JSON.parse(await read(file));

const [pkg, lock, config, workflow, spec, motion, roadmap] = await Promise.all([
  json('tests/e2e/package.json'),
  json('tests/e2e/package-lock.json'),
  read('tests/e2e/playwright.config.mjs'),
  read('.github/workflows/e2e.yml'),
  read('tests/e2e/specs/library.spec.mjs'),
  read('src/assets/js/motion.js'),
  read('docs/roadmaps/CURRENT_ROADMAP.md')
]);

assert.equal(pkg.devDependencies?.['@playwright/test'], '1.62.1', 'Playwright must stay exactly pinned in the E2E workspace');
assert.equal(lock.packages?.['node_modules/@playwright/test']?.version, '1.62.1', 'E2E lockfile must match the pinned Playwright version');
assert.equal(lock.packages?.['node_modules/playwright-core']?.version, '1.62.1', 'Playwright core must stay locked with the runner');

for (const project of ['chromium-desktop', 'firefox-desktop', 'webkit-desktop', 'chromium-mobile', 'webkit-mobile']) {
  assert.match(config, new RegExp(`name:\\s*['\"]${project}['\"]`), `missing ${project} project`);
}
assert.match(config, /trace:\s*['"]retain-on-failure['"]/);
assert.match(config, /screenshot:\s*['"]only-on-failure['"]/);
assert.match(config, /video:\s*['"]retain-on-failure['"]/);
assert.match(config, /cwd:\s*ROOT/);

assert.match(workflow, /npm ci --prefix tests\/e2e/);
assert.match(workflow, /playwright install --with-deps chromium firefox webkit/);
assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
assert.match(workflow, /permissions:\s*\n\s*contents: read/);

assert.match(spec, /Main and Adult libraries hydrate from isolated fixture catalogs/);
assert.match(spec, /search, compact view, and Back navigation restore rendered Library state/);
assert.match(spec, /mobile navigation remains viewport-owned across resize and reduced motion/);
assert.match(spec, /browserDiagnostics/);
assert.match(spec, /page\.locator\(['"]\.brand-mark['"]\)/, 'mobile navigation E2E must use a stable locator while its accessible name changes');

assert.match(motion, /observeTransitionPromise\(transition\?\.ready\)/, 'View Transition ready rejection must be observed');
assert.match(motion, /observeTransitionPromise\(transition\?\.finished\)/, 'View Transition finished rejection must be observed');
assert.match(motion, /observeTransitionPromise\(transition\?\.updateCallbackDone\)/, 'View Transition update callback rejection must be observed');
assert.match(motion, /guardTransition\(viewTransition\)/, 'cross-document pagereveal transitions must use the same rejection guard');
assert.match(motion, /finished\.then\(clearNavigationHint,clearNavigationHint\)/, 'native View Transition completion and skip rejection must both clear navigation hints');
assert.doesNotMatch(motion, /finished\.finally\(clearNavigationHint\)/, 'do not leave skipped native View Transition rejections unhandled');

assert.match(roadmap, /Active release:\*\* v2\.6\.0 — Reliability & Real-Browser Testing/);
assert.match(roadmap, /# v2\.6\.0 — Reliability & Real-Browser Testing/);

console.log('v2.6 real-browser harness contract OK');
