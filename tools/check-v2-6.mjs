import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = file => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const json = async file => JSON.parse(await read(file));

const [
  e2ePkg,
  e2eLock,
  config,
  e2eWorkflow,
  librarySpec,
  readerSpec,
  readerPagesSpec,
  readerMobileSpec,
  publicLifecycleSpec,
  keeperAuthSpec,
  keeperSeriesSpec,
  keeperUploadSpec,
  keeperOperationsSpec,
  accessibilitySpec,
  readerGenerator,
  fixtures,
  gitignore,
  libraryJs,
  libraryRenderers,
  nav,
  navPinned,
  navCss,
  bookmarks,
  rendition,
  imageFocus,
  imageFocusCss,
  theme,
  motion,
  rootPkg,
  rootLock,
  releaseWorkflow,
  rootReadme,
  changelog,
  docsReadme,
  releaseNotes,
  hotfixNotes,
  containmentNotes,
  hardeningNotes,
  canvasNotes,
  bleedNotes,
  verticalSyncNotes,
  focusSync,
  railCss,
  roadmap,
  testArchitecture,
  accessibilityDoc,
  buildDeployment
] = await Promise.all([
  json('tests/e2e/package.json'),
  json('tests/e2e/package-lock.json'),
  read('tests/e2e/playwright.config.mjs'),
  read('.github/workflows/e2e.yml'),
  read('tests/e2e/specs/library.spec.mjs'),
  read('tests/e2e/specs/reader.spec.mjs'),
  read('tests/e2e/specs/reader-pages.spec.mjs'),
  read('tests/e2e/specs/reader-mobile-reliability.spec.mjs'),
  read('tests/e2e/specs/public-reading-lifecycle.spec.mjs'),
  read('tests/e2e/specs/keeper-auth-dialog.spec.mjs'),
  read('tests/e2e/specs/keeper-series-translation.spec.mjs'),
  read('tests/e2e/specs/keeper-upload.spec.mjs'),
  read('tests/e2e/specs/keeper-operations.spec.mjs'),
  read('tests/e2e/specs/accessibility.spec.mjs'),
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
  read('src/assets/js/reader/theme.js'),
  read('src/assets/js/motion.js'),
  json('package.json'),
  json('package-lock.json'),
  read('.github/workflows/release-v2.yml'),
  read('README.md'),
  read('CHANGELOG.md'),
  read('docs/README.md'),
  read('docs/releases/v2.6.0.md'),
  read('docs/releases/v2.6.1.md'),
  read('docs/releases/v2.6.2.md'),
  read('docs/releases/v2.6.3.md'),
  read('docs/releases/v2.6.4.md'),
  read('docs/releases/v2.6.5.md'),
  read('docs/releases/v2.6.6.md'),
  read('src/assets/js/reader-epub-adapter.js'),
  read('src/assets/css/reader-continuous-rail.css'),
  read('docs/roadmaps/CURRENT_ROADMAP.md'),
  read('docs/architecture/TEST_ARCHITECTURE.md'),
  read('docs/architecture/ACCESSIBILITY_TESTING.md'),
  read('docs/architecture/BUILD_DEPLOYMENT.md')
]);

// Real-browser workspace and CI contract.
assert.equal(e2ePkg.devDependencies?.['@playwright/test'], '1.62.1', 'Playwright must stay exactly pinned in the E2E workspace');
assert.equal(e2eLock.packages?.['node_modules/@playwright/test']?.version, '1.62.1', 'E2E lockfile must match the pinned Playwright version');
assert.equal(e2eLock.packages?.['node_modules/playwright-core']?.version, '1.62.1', 'Playwright core must stay locked with the runner');
assert.equal(e2ePkg.scripts?.pretest, 'node support/build-reader-fixture.mjs', 'Reader EPUB fixture must be generated before every E2E run');

for (const project of ['chromium-desktop', 'firefox-desktop', 'webkit-desktop', 'chromium-mobile', 'webkit-mobile']) {
  assert.match(config, new RegExp(`name:\\s*['\"]${project}['\"]`), `missing ${project} project`);
}
assert.match(config, /trace:\s*['"]retain-on-failure['"]/);
assert.match(config, /screenshot:\s*['"]only-on-failure['"]/);
assert.match(config, /video:\s*['"]retain-on-failure['"]/);
assert.match(config, /cwd:\s*ROOT/);

assert.match(e2eWorkflow, /npm ci --prefix tests\/e2e/);
assert.match(e2eWorkflow, /playwright install --with-deps chromium firefox webkit/);
assert.match(e2eWorkflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
assert.match(e2eWorkflow, /permissions:\s*\n\s*contents: read/);
assert.match(e2eWorkflow, /push:\s*\n\s*branches:\s*\n\s*- main/, 'real-browser suite must run on the releaseable main commit');

// Library/public behavior permanently protected by v2.6.
assert.match(librarySpec, /Main and Adult libraries hydrate from isolated fixture catalogs/);
assert.match(librarySpec, /search, compact view, and Back navigation restore rendered Library state/);
assert.match(librarySpec, /reading suggestion reroll advances and pinned series remain available in the navigation drawer/);
assert.match(librarySpec, /mobile navigation remains viewport-owned across resize and reduced motion/);
assert.match(librarySpec, /browserDiagnostics/);
assert.match(librarySpec, /page\.locator\(['"]\.brand-mark['"]\)/, 'mobile navigation E2E must use a stable locator while its accessible name changes');
assert.match(librarySpec, /localStorage\.setItem\(['"]sg-pinned['"]/, 'real-browser Library coverage must seed and verify pinned-series persistence');
assert.match(librarySpec, /Show another reading suggestion/, 'real-browser Library coverage must exercise suggestion reroll');
assert.match(librarySpec, /headerOwnsTopPoint/, 'real-browser drawer coverage must verify the header is actually painted above the body-level overlay');
assert.doesNotMatch(librarySpec, /headerZ|drawerZ/, 'real-browser drawer coverage must assert actual paint ownership instead of engine-specific computed z-index reporting');
assert.ok(publicLifecycleSpec.length > 3_000, 'public Read → Continue → Finished → Read Again E2E must remain present');
assert.match(publicLifecycleSpec, /Read Again/, 'public lifecycle E2E must retain Read Again coverage');
assert.match(publicLifecycleSpec, /bookmark/i, 'public lifecycle E2E must retain bookmark-preservation coverage');

assert.match(libraryJs, /function suggestionIdentity\(/, 'Library controller must track the current random suggestion identity');
assert.match(libraryJs, /for\(let attempt=0;attempt<17;attempt\+\+\)/, 'Library reroll must search deterministically for a visibly different eligible suggestion');
assert.match(libraryJs, /renderContinue\(\{reroll:true\}\)/, 'suggestion control must use reroll semantics instead of a one-shot random sample');
assert.match(libraryRenderers, /title="Another suggestion">↻<\/button>/, 'suggestion reroll control must remain compact while keeping an accessible label');
assert.match(navPinned, /document\.querySelector\(['"]#siteNav['"]\)/, 'pinned-series renderer must target the canonical body-level navigation drawer');
assert.match(nav, /control\.closest\(['"]\[data-nav-keep-open\]['"]\)/, 'drawer-owned controls must not close the navigation drawer');
assert.match(navCss, /body\.site-nav-open\{padding-top:72px\}/, 'open navigation must preserve the sticky header normal-flow height');
assert.match(navCss, /\.site-nav-open \.site-header\{position:fixed;top:0;left:0;right:0;width:100%;z-index:70!important/, 'open navigation must authoritatively keep the header above later mobile z-index rules and the body-level drawer');
assert.match(navCss, /@media\(max-width:720px\)\{body\.site-nav-open\{padding-top:62px\}/, 'mobile drawer must preserve the 62px header height without a layout jump');

// Generated protected EPUB fixture.
assert.match(readerGenerator, /application\/epub\+zip/);
assert.match(readerGenerator, /META-INF\/container\.xml/);
assert.match(readerGenerator, /OEBPS\/content\.opf/);
assert.match(readerGenerator, /chapter-1\.xhtml/);
assert.match(readerGenerator, /images\/illustration\.svg/);
assert.match(readerGenerator, /Large Chapter/);
assert.match(readerGenerator, /Split Chapter/);
assert.match(readerGenerator, /generateAsync/);
assert.match(gitignore, /tests\/e2e\/\.generated\//, 'generated Reader EPUBs must never be committed');

assert.match(fixtures, /READER_BOOK_ID\s*=\s*['"]bk_1111111111111111111111['"]/);
assert.match(fixtures, /READER_MEDIA_PATH\s*=\s*['"]\/media\/shadow-garden\/books\/e2e-reader\.epub['"]/);
assert.match(fixtures, /page\.route\(['"]\*\*\/book-access['"]/);
assert.match(fixtures, /status:\s*206/);
assert.match(fixtures, /content-range/);
assert.match(fixtures, /media\/shadow-garden\/books\/e2e-reader\.epub\*/);

// Reader persistence, layout, input and accessibility coverage.
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

assert.match(readerPagesSpec, /Pages controls and TOC navigate everywhere/);
assert.match(readerPagesSpec, /mobile Pages swipe policy turns the live rendition without becoming a Continuous-mode owner/);
assert.match(readerPagesSpec, /fullscreen control mirrors fullscreenchange state/);
assert.match(readerPagesSpec, /visual-only, legacy-structure, and large chapters remain readable/);
assert.match(readerPagesSpec, /issue #157: split XHTML continuation keeps the navigation chapter title/);
assert.match(readerPagesSpec, /continuousSwipe\?\.defaultPrevented/);

assert.match(readerMobileSpec, /issue #154/i, 'mobile Reader issue #154 regression must remain in the real-browser suite');
assert.match(readerMobileSpec, /Continuous/i);
assert.match(readerMobileSpec, /single image tap opens focus/i, 'mobile Reader regression must retain one-tap image-focus acceptance');
assert.match(readerMobileSpec, /chrome/i);
assert.match(readerMobileSpec, /pageRight/, 'mobile Reader E2E must compare publication artwork in parent-page coordinates');
assert.match(readerMobileSpec, /seekLeft/, 'mobile Reader E2E must measure the parent-owned Continuous seek rail');
assert.match(readerMobileSpec, /image\.pageRight\)\.toBeLessThanOrEqual\(image\.seekLeft \+ 1\)/, 'issue #160 regression must keep rendered artwork left of the fixed seek rail');

assert.match(bookmarks, /return Number\(bookmark\.localPage\)===Number\(position\.localPage\);/, 'bookmark active-state matching must survive equivalent resumed CFIs on the same rendered section page');
assert.match(rendition, /export function stabilizeContinuousScrollLifecycle\(/, 'rendition lifecycle must defend Continuous scroll callbacks across EPUB.js manager variants');
assert.match(rendition, /if\(manager\.__sgDestroyed\)return;/, 'late Continuous callbacks must stop after manager destruction');
assert.match(rendition, /if\(typeof scrolled==="function"\)scrolled\.apply\(manager,args\)/, 'Continuous debounce must never call a missing manager.scrolled method');
assert.match(imageFocus, /doc\.addEventListener\("pointerdown"/, 'image focus must track a pointer activation fallback inside EPUB documents');
assert.match(imageFocus, /doc\.addEventListener\("pointerup"/, 'image focus must support engines that deliver EPUB document pointer events');
assert.ok(imageFocus.includes('if(Math.hypot((Number(event.clientX)||0)-start.x,(Number(event.clientY)||0)-start.y)>12)return;'), 'pointer fallback must reject drag gestures instead of stealing Reader scrolling');
assert.match(imageFocus, /function needsParentHitTargets\(/, 'WebKit image activation must be detected without enabling scripts inside EPUB content');
assert.match(imageFocus, /reader-image-focus-hit/, 'WebKit must receive a parent-owned image hit target outside the sandboxed EPUB document');
assert.match(imageFocus, /zoomAt\(state\.scale\*Math\.exp\(-delta\.y\*\.0016\)/, 'fine-pointer wheel must zoom the focused image cursor-anchored');
assert.match(imageFocus, /"dblclick"/, 'focused images must return via double-click on fine pointers');
assert.match(imageFocus, /frame\.getBoundingClientRect\(\)/, 'parent-owned image hit targets must follow the rendered EPUB frame geometry');
assert.match(imageFocus, /sourceImage\.getBoundingClientRect\(\)/, 'parent-owned image hit targets must follow source-image geometry');
assert.match(imageFocusCss, /\.reader-image-focus-hit\{position:fixed;z-index:24;/, 'image hit targets must live in Reader chrome rather than changing EPUB sandbox permissions');
assert.match(theme, /function computedStyle\(element, win\)/, 'Reader theme repair must centralize safe computed-style access');
assert.match(theme, /element\.isConnected === false/, 'Reader theme repair must skip EPUB nodes detached during rendition transitions');
assert.match(theme, /try \{ return win\.getComputedStyle\(element\) \|\| null; \} catch \{ return null; \}/, 'Reader theme repair must tolerate engines returning or throwing around detached computed styles');
assert.match(theme, /if \(!style\) return false;/, 'Reader theme inspection must stop when computed style is unavailable');
assert.match(theme, /body\.isConnected === false/, 'Reader theme repair must abandon detached EPUB bodies before traversing descendants');
assert.match(theme, /padding: paginated \? "max\(2\.5em, 60px\) 4vw max\(2\.5em, 54px\) !important" : "2\.5em 0 !important"/, 'Continuous bodies drop horizontal padding so media bleeds to the rail boundary while text selectors carry readable insets');
assert.match(theme, /"p, li, dd, dt, blockquote, figcaption": \{/, 'prose-only inset selectors must exist so full-bleed artwork is never indented');
assert.match(theme, /"padding-left": "14px !important"/, 'prose insets keep readable measure without double-indenting artwork');
assert.match(railCss, /body\.reader-flow-scrolled \.viewer\{right:34px\}/, 'the Continuous reading canvas must structurally end where the 34px seek rail begins (#160 item 2)');
assert.match(railCss, /body\.reader-flow-scrolled \.viewer\{right:22px\}/, 'the Continuous reading canvas must exclude the 22px mobile seek rail column');

// Garden Keeper v2.6 real-browser coverage may not silently disappear.
assert.ok(keeperAuthSpec.length > 4_000, 'Keeper auth/dialog E2E must remain substantive');
assert.match(keeperAuthSpec, /admin-access/);
assert.match(keeperAuthSpec, /session/i);
assert.match(keeperAuthSpec, /focus/i);
assert.ok(keeperSeriesSpec.length > 7_000, 'Keeper Series/translation E2E must remain substantive');
assert.match(keeperSeriesSpec, /update-series/);
assert.match(keeperSeriesSpec, /translations/);
assert.ok(keeperUploadSpec.length > 6_000, 'Keeper upload E2E must remain substantive');
assert.match(keeperUploadSpec, /upload/i);
assert.match(keeperUploadSpec, /retry|error/i);
assert.ok(keeperOperationsSpec.length > 8_000, 'Keeper operations E2E must remain substantive');
assert.match(keeperOperationsSpec, /History/);
assert.match(keeperOperationsSpec, /Trash/);
assert.match(keeperOperationsSpec, /Abuse/);

// Accessibility acceptance and application/publication boundary.
assert.ok(accessibilitySpec.length > 4_000, 'v2.6 accessibility E2E must remain substantive');
assert.match(accessibilitySpec, /400/);
assert.match(accessibilitySpec, /forced-colors/);
assert.match(accessibilitySpec, /contrast/);
assert.match(accessibilitySpec, /touch/i);
assert.match(accessibilityDoc, /Shadow Garden owns the accessibility of its own HTML/);
assert.match(accessibilityDoc, /EPUB publication content is author\/publisher supplied/);

// Motion remains progressive enhancement and observer-only.
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

// v2.6 release reconciliation remains synchronized through the v2.6.1–v2.6.6 hotfixes.
assert.equal(rootPkg.version, '2.6.6', 'root package version must be v2.6.6 for the current v2.6 hotfix');
assert.equal(rootLock.version, rootPkg.version, 'lockfile top-level version must match package.json');
assert.equal(rootLock.packages?.['']?.version, rootPkg.version, 'lockfile workspace version must match package.json');
assert.match(releaseNotes, /^# Shadow Garden v2\.6\.0 — Reliability & Real-Browser Testing/m);
assert.match(releaseNotes, /Real Browser E2E/);
assert.match(releaseNotes, /issue #154/);
assert.match(releaseNotes, /issue #157/);
assert.match(hotfixNotes, /^# Shadow Garden v2\.6\.1 — Continuous Reader Rail Hotfix/m);
assert.match(hotfixNotes, /issue #160/);
assert.match(hotfixNotes, /seek rail/i);
assert.match(containmentNotes, /^# Shadow Garden v2\.6\.2 — Continuous Media Containment Hotfix/m);
assert.match(containmentNotes, /issue #160/);
assert.match(containmentNotes, /content box/i);
assert.match(hardeningNotes, /^# Shadow Garden v2\.6\.3 — Continuous Media Containment Hardening/m);
assert.match(hardeningNotes, /issue #160/);
assert.match(hardeningNotes, /min-width/i);
assert.match(canvasNotes, /^# Shadow Garden v2\.6\.4 — Continuous Canvas Rail Exclusion/m);
assert.match(canvasNotes, /issue #160/);
assert.match(canvasNotes, /canvas/i);
assert.match(bleedNotes, /^# Shadow Garden v2\.6\.5 — Continuous Full-Bleed Canvas/m);
assert.match(bleedNotes, /issue #160/);
assert.match(bleedNotes, /full-bleed/i);
assert.match(verticalSyncNotes, /^# Shadow Garden v2\.6\.6 — Continuous Vertical Sync & Focus Controls/m);
assert.match(verticalSyncNotes, /vertically long/i);
assert.match(focusSync, /syncContinuousFrameHeights/, 'continuous section frames must be reconciled against live document extents');
assert.match(focusSync, /__sgTallSyncTimer/, 'late media growth must schedule staggered reconciliation passes');
assert.match(theme, /"min-width": "0 !important"/, 'Continuous containment must neutralize publication min-width rules that override max-width caps');
assert.match(theme, /position: "static !important"/, 'Continuous containment must keep replaced media statically positioned');
assert.match(theme, /transform: "none !important"/, 'Continuous containment must strip rightward media transforms');
assert.match(changelog, /## 2\.6\.0 — Reliability & Real-Browser Testing/);
assert.match(changelog, /## 2\.5\.0 — Motion & Continuity/, 'changelog must retain the previously omitted v2.5.0 release history');
assert.match(rootReadme, /^# Shadow Garden v2\.6\.[0-6]/m);
assert.match(rootReadme, /tests\/e2e\/.*Playwright/s);
assert.match(docsReadme, /releases\/v2\.6\.0\.md/);
assert.match(docsReadme, /releases\/v2\.6\.1\.md/);
assert.match(docsReadme, /releases\/v2\.6\.2\.md/);
assert.match(docsReadme, /releases\/v2\.6\.3\.md/);
assert.match(docsReadme, /releases\/v2\.6\.4\.md/);
assert.match(docsReadme, /releases\/v2\.6\.5\.md/);
assert.match(docsReadme, /releases\/v2\.6\.6\.md/);
assert.match(docsReadme, /v2\.7\.0 Performance & Scale/);
assert.match(roadmap, /Active release:\*\* v2\.7\.0 — Performance & Scale/);
assert.match(roadmap, /# v2\.6\.0 — Reliability & Real-Browser Testing/);
assert.match(roadmap, /\*\*Status:\*\* ✅ Done/);
assert.match(roadmap, /\*\*v2\.6\.0 — Reliability & Real-Browser Testing\*\* \| ✅ Done/);
assert.match(roadmap, /\*\*v2\.7\.0 — Performance & Scale\*\* \| 🟨 In progress/);
const v26RoadmapSection = roadmap.split('# v2.6.0 — Reliability & Real-Browser Testing')[1]?.split('\n---\n')[0] || '';
assert.ok(v26RoadmapSection, 'v2.6 roadmap section must remain present');
assert.doesNotMatch(v26RoadmapSection, /- \[ \]/, 'completed v2.6 section must not retain unchecked milestone items');
assert.match(testArchitecture, /Real Browser E2E — v2\.6\+/);
assert.match(testArchitecture, /chromium-desktop/);
assert.match(testArchitecture, /webkit-mobile/);
assert.match(buildDeployment, /Verified v2 release contract/);
assert.match(buildDeployment, /Real Browser E2E/);

// The reusable v2 publisher must require exact-main real-browser success before production/release.
assert.match(releaseWorkflow, /permissions:\s*\n\s*actions: read\s*\n\s*contents: write/);
assert.match(releaseWorkflow, /Require matching Real Browser E2E/);
assert.match(releaseWorkflow, /actions\/workflows\/e2e\.yml\/runs/);
assert.match(releaseWorkflow, /-f branch=main/);
assert.match(releaseWorkflow, /-f event=push/);
assert.match(releaseWorkflow, /-f head_sha="\$HEAD_SHA"/);
assert.match(releaseWorkflow, /if \[ "\$conclusion" = "success" \]/);
assert.match(releaseWorkflow, /Real Browser E2E never completed successfully for main commit \$HEAD_SHA/);
assert.match(releaseWorkflow, /deployed_version/);
assert.match(releaseWorkflow, /deployed_commit/);
assert.match(releaseWorkflow, /data-library-scope=\"main\"/);
assert.match(releaseWorkflow, /data-library-scope=\"nsfw\"/);
assert.match(releaseWorkflow, /id=\"seriesRoot\"/);
assert.match(releaseWorkflow, /id=\"viewer\"/);
assert.match(releaseWorkflow, /Disallow: \/media\//);
assert.match(releaseWorkflow, /gh release create/);

console.log('v2.6/v2.6.6 release, real-browser, Library, Reader, Keeper, and accessibility contracts OK');
