import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = file => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const json = async file => JSON.parse(await read(file));

const [pkg, lock, config, workflow, librarySpec, readerSpec, readerGenerator, fixtures, gitignore, motion, roadmap] = await Promise.all([
  json('tests/e2e/package.json'),
  json('tests/e2e/package-lock.json'),
  read('tests/e2e/playwright.config.mjs'),
  read('.github/workflows/e2e.yml'),
  read('tests/e2e/specs/library.spec.mjs'),
  read('tests/e2e/specs/reader.spec.mjs'),
  read('tests/e2e/support/build-reader-fixture.mjs'),
  read('tests/e2e/support/fixtures.mjs'),
  read('.gitignore'),
  read('src/assets/js/motion.js'),
  read('docs/roadmaps/CURRENT_ROADMAP.md')
]);

assert.equal(pkg.devDependencies?.['@playwright/test'], '1.62.1', 'Playwright must stay exactly pinned in the E2E workspace');
assert.equal(lock.packages?.['node_modules/@playwright/test']?.version, '1.62.1', 'E2E lockfile must match the pinned Playwright version');
assert.equal(lock.packages?.['node_modules/playwright-core']?.version, '1.62.1', 'Playwright core must stay locked with the runner');
assert.equal(pkg.scripts?.pretest, 'node support/build-reader-fixture.mjs', 'Reader EPUB fixture must be generated before every E2E run');

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

assert.match(librarySpec, /Main and Adult libraries hydrate from isolated fixture catalogs/);
assert.match(librarySpec, /search, compact view, and Back navigation restore rendered Library state/);
assert.match(librarySpec, /mobile navigation remains viewport-owned across resize and reduced motion/);
assert.match(librarySpec, /browserDiagnostics/);
assert.match(librarySpec, /page\.locator\(['"]\.brand-mark['"]\)/, 'mobile navigation E2E must use a stable locator while its accessible name changes');

assert.match(readerGenerator, /application\/epub\+zip/);
assert.match(readerGenerator, /META-INF\/container\.xml/);
assert.match(readerGenerator, /OEBPS\/content\.opf/);
assert.match(readerGenerator, /chapter-1\.xhtml/);
assert.match(readerGenerator, /images\/illustration\.svg/);
assert.match(readerGenerator, /generateAsync/);
assert.match(gitignore, /tests\/e2e\/\.generated\//, 'generated Reader EPUBs must never be committed');

assert.match(fixtures, /READER_BOOK_ID\s*=\s*['"]bk_1111111111111111111111['"]/);
assert.match(fixtures, /READER_MEDIA_PATH\s*=\s*['"]\/media\/shadow-garden\/books\/e2e-reader\.epub['"]/);
assert.match(fixtures, /page\.route\(['"]\*\*\/book-access['"]/);
assert.match(fixtures, /status:\s*206/);
assert.match(fixtures, /content-range/);
assert.match(fixtures, /media\/shadow-garden\/books\/e2e-reader\.epub\*/);

assert.match(readerSpec, /protected Reader session opens the deterministic EPUB in a real rendition/);
assert.match(readerSpec, /Pages progress and bookmark persist through a full Reader reload/);
assert.match(readerSpec, /flow switching, image focus, and resize preserve a usable Reader location/);
assert.match(readerSpec, /sg-progress:/);
assert.match(readerSpec, /sg-bookmarks:/);
assert.match(readerSpec, /selectOption\(['"]scrolled-doc['"]\)/);
assert.match(readerSpec, /#imageFocus/);

assert.match(motion, /observeTransitionPromise\(transition\?\.ready\)/, 'same-document View Transition ready rejection must be observed');
assert.match(motion, /observeTransitionPromise\(transition\?\.finished\)/, 'same-document View Transition finished rejection must be observed');
assert.match(motion, /observeTransitionPromise\(transition\?\.updateCallbackDone\)/, 'same-document View Transition update callback rejection must be observed');
assert.match(motion, /event\?\.activation\?\.navigationType!==["']traverse["']/, 'cross-document Back/Forward detection must use navigationType traverse');
assert.match(motion, /transition\.skipTransition\(\)/, 'cross-document Back/Forward transitions must be explicitly skipped');
assert.match(motion, /observeCrossDocumentFinished\(event\.viewTransition\)/, 'normal cross-document transitions may observe finished only');
assert.doesNotMatch(motion, /guardTransition\(event\.viewTransition\)/, 'cross-document transitions must not read ready/updateCallbackDone on already-skipped Chromium transitions');
assert.doesNotMatch(motion, /guardTransition\(viewTransition\)/, 'pagereveal must not apply the same-document promise guard to cross-document transitions');
assert.match(motion, /finished\.then\(clearNavigationHint,clearNavigationHint\)/, 'cross-document completion or skip must clear navigation hints');
assert.doesNotMatch(motion, /finished\.finally\(clearNavigationHint\)/, 'do not leave skipped View Transition rejections unhandled');

assert.match(roadmap, /Active release:\*\* v2\.6\.0 — Reliability & Real-Browser Testing/);
assert.match(roadmap, /# v2\.6\.0 — Reliability & Real-Browser Testing/);

console.log('v2.6 real-browser and Reader reliability contracts OK');
