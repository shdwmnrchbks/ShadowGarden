import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = file => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const json = async file => JSON.parse(await read(file));

const [pkg, lock, config, workflow, librarySpec, readerSpec, readerGenerator, fixtures, gitignore, libraryJs, libraryRenderers, nav, navPinned, navCss, bookmarks, rendition, imageFocus, imageFocusCss, motion, roadmap] = await Promise.all([
  json('tests/e2e/package.json'),
  json('tests/e2e/package-lock.json'),
  read('tests/e2e/playwright.config.mjs'),
  read('.github/workflows/e2e.yml'),
  read('tests/e2e/specs/library.spec.mjs'),
  read('tests/e2e/specs/reader.spec.mjs'),
  read('tests/e2e/support/build-reader-fixture.mjs'),
  read('tests/e2e/support/fixtures.mjs'),
  read('.gitignore'),
  read('src/assets/js/library.js'),
  read('src/assets/js/library-renderers.js'),
  read('src/assets/js/nav.js'),
  read('src/assets/js/nav-pinned.js'),
  read('src/assets/css/nav.css'),
  read('src/assets/js/reader/bookmarks-controller.js'),
  read('src/assets/js/reader/rendition.js'),
  read('src/assets/js/reader/image-focus.js'),
  read('src/assets/css/reader-image-focus.css'),
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
assert.match(librarySpec, /reading suggestion reroll advances and pinned series remain available in the navigation drawer/);
assert.match(librarySpec, /mobile navigation remains viewport-owned across resize and reduced motion/);
assert.match(librarySpec, /browserDiagnostics/);
assert.match(librarySpec, /page\.locator\(['"]\.brand-mark['"]\)/, 'mobile navigation E2E must use a stable locator while its accessible name changes');
assert.match(librarySpec, /localStorage\.setItem\(['"]sg-pinned['"]/, 'real-browser Library coverage must seed and verify pinned-series persistence');
assert.match(librarySpec, /Show another reading suggestion/, 'real-browser Library coverage must exercise suggestion reroll');
assert.match(librarySpec, /headerOwnsTopPoint/, 'real-browser drawer coverage must verify the header is actually painted above the body-level overlay');

assert.match(libraryJs, /function suggestionIdentity\(/, 'Library controller must track the current random suggestion identity');
assert.match(libraryJs, /for\(let attempt=0;attempt<17;attempt\+\+\)/, 'Library reroll must search deterministically for a visibly different eligible suggestion');
assert.match(libraryJs, /renderContinue\(\{reroll:true\}\)/, 'suggestion control must use reroll semantics instead of a one-shot random sample');
assert.match(libraryRenderers, /title="Another suggestion">↻<\/button>/, 'suggestion reroll control must remain compact while keeping an accessible label');
assert.match(navPinned, /document\.querySelector\(['"]#siteNav['"]\)/, 'pinned-series renderer must target the canonical body-level navigation drawer');
assert.match(nav, /control\.closest\(['"]\[data-nav-keep-open\]['"]\)/, 'drawer-owned controls must not close the navigation drawer');
assert.match(navCss, /body\.site-nav-open\{padding-top:72px\}/, 'open navigation must preserve the sticky header normal-flow height');
assert.match(navCss, /\.site-nav-open \.site-header\{position:fixed;top:0;left:0;right:0;width:100%;z-index:70!important/, 'open navigation must authoritatively keep the header above later mobile z-index rules and the body-level drawer');
assert.match(navCss, /@media\(max-width:720px\)\{body\.site-nav-open\{padding-top:62px\}/, 'mobile drawer must preserve the 62px header height without a layout jump');

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
assert.match(readerSpec, /toBe\(bookmarkedCfi\)/, 'bookmark reload must wait for the restored EPUB CFI rather than Page Map generation');
assert.doesNotMatch(readerSpec, /waitForPageMap/, 'bookmark reload must not depend on asynchronous device Page Map completion');
assert.match(readerSpec, /function intersectBoxes\(/, 'image-focus E2E must distinguish iframe-local visibility from the real Reader viewport');
assert.match(readerSpec, /page\.locator\(['"]#viewerShell['"]\)/, 'image-focus E2E must intersect the EPUB image with the Reader viewport before activation');
assert.match(readerSpec, /revealAndClickRenderedCenter/, 'image-focus E2E must page forward until the image is actually reachable');
assert.match(readerSpec, /EPUB illustration never entered the visible Reader viewport/, 'image-focus E2E must fail clearly when paginated geometry never exposes the image');
assert.doesNotMatch(readerSpec, /async function clickRenderedCenter/, 'do not regress to blindly clicking an iframe-local image that may be clipped off the mobile Reader viewport');
assert.match(readerSpec, /selectOption\(['"]scrolled-doc['"]\)/);
assert.match(readerSpec, /toBeGreaterThan\(0\)/, 'Continuous Reader coverage must allow the multiple live EPUB iframes EPUB.js legitimately renders');
assert.match(readerSpec, /#imageFocus/);
assert.match(bookmarks, /return Number\(bookmark\.localPage\)===Number\(position\.localPage\);/, 'bookmark active-state matching must survive equivalent resumed CFIs on the same rendered section page');
assert.match(rendition, /export function stabilizeContinuousScrollLifecycle\(/, 'rendition lifecycle must defend Continuous scroll callbacks across EPUB.js manager variants');
assert.match(rendition, /if\(manager\.__sgDestroyed\)return;/, 'late Continuous callbacks must stop after manager destruction');
assert.match(rendition, /if\(typeof scrolled==="function"\)scrolled\.apply\(manager,args\)/, 'Continuous debounce must never call a missing manager.scrolled method');
assert.match(imageFocus, /doc\.addEventListener\("pointerdown"/, 'image focus must track a pointer activation fallback inside EPUB documents');
assert.match(imageFocus, /doc\.addEventListener\("pointerup"/, 'image focus must support engines that deliver EPUB document pointer events');
assert.ok(imageFocus.includes('if(Math.hypot((Number(event.clientX)||0)-start.x,(Number(event.clientY)||0)-start.y)>12)return;'), 'pointer fallback must reject drag gestures instead of stealing Reader scrolling');
assert.match(imageFocus, /function needsParentHitTargets\(/, 'WebKit image activation must be detected without enabling scripts inside EPUB content');
assert.match(imageFocus, /reader-image-focus-hit/, 'WebKit must receive a parent-owned image hit target outside the sandboxed EPUB document');
assert.match(imageFocus, /frame\.getBoundingClientRect\(\)/, 'parent-owned image hit targets must follow the rendered EPUB frame geometry');
assert.match(imageFocus, /sourceImage\.getBoundingClientRect\(\)/, 'parent-owned image hit targets must follow source-image geometry');
assert.match(imageFocusCss, /\.reader-image-focus-hit\{position:fixed;z-index:24;/, 'image hit targets must live in Reader chrome rather than changing EPUB sandbox permissions');

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

console.log('v2.6 real-browser, Library, and Reader reliability contracts OK');