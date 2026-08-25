import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const failures = [];
const fail = message => failures.push(message);
const read = file => fs.readFile(path.join(ROOT, file), "utf8");
const exists = async file => { try { await fs.access(path.join(ROOT, file)); return true; } catch { return false; } };
const semverAtLeast = (current, minimum) => {
  const parse = value => String(value || "").split(".").slice(0, 3).map(item => Number.parseInt(item, 10) || 0);
  const a = parse(current), b = parse(minimum);
  for (let i = 0; i < 3; i++) { if (a[i] > b[i]) return true; if (a[i] < b[i]) return false; }
  return true;
};

const layerFiles = {
  unit: ["tests/unit/catalog-model.test.mjs", "tests/unit/reading-state.test.mjs", "tests/unit/reader-input.test.mjs"],
  service: ["tests/service/media-ticket.test.mjs", "tests/service/validation.test.mjs", "tests/service/admin-auth.test.mjs"],
  dom: ["tests/dom/public-renderers.test.mjs"],
  browser: ["tests/browser/entrypoints.test.mjs", "tests/browser/reading-flow.test.mjs", "tests/browser/reader-interactions.test.mjs", "tests/browser/keeper-smoke.test.mjs", "tests/browser/mobile-nav-viewport.test.mjs", "tests/browser/library-filter-ux.test.mjs"]
};
const fixtures = [
  "tests/fixtures/catalog-main.json", "tests/fixtures/catalog-adult.json", "tests/fixtures/reading-states.json",
  "tests/fixtures/media-ticket-scenarios.json", "tests/fixtures/visual-pages.json",
  "tests/fixtures/epub/cover.xhtml", "tests/fixtures/epub/map.xhtml", "tests/fixtures/epub/illustration.xhtml", "tests/fixtures/epub/chapter.xhtml"
];
const helpers = ["tests/helpers/browser-env.mjs", "tests/helpers/fake-dom.mjs", "tools/run-tests.mjs"];
for (const file of [...Object.values(layerFiles).flat(), ...fixtures, ...helpers]) if (!(await exists(file))) fail(`R8 required test artifact is missing: ${file}`);

const [pkgText, roadmap, architecture, docsIndex, architectureIndex, workflow, runner] = await Promise.all([
  read("package.json"), read("docs/roadmaps/REFACTOR_ROADMAP.md"), read("docs/architecture/TEST_ARCHITECTURE.md"),
  read("docs/README.md"), read("docs/architecture/README.md"), read(".github/workflows/verify.yml"), read("tools/run-tests.mjs")
]);
const pkg = JSON.parse(pkgText);

const expectedScripts = {
  "test": "node tools/run-tests.mjs all",
  "test:unit": "node tools/run-tests.mjs unit",
  "test:service": "node tools/run-tests.mjs service",
  "test:dom": "node tools/run-tests.mjs dom",
  "test:browser": "node tools/run-tests.mjs browser"
};
for (const [name, command] of Object.entries(expectedScripts)) if (pkg.scripts?.[name] !== command) fail(`package.json ${name} must be exactly: ${command}`);
if (!String(pkg.scripts?.check || "").includes("check-r8.mjs")) fail("tools/check-r8.mjs must be part of npm run check");
if (!String(pkg.scripts?.check || "").includes("npm test")) fail("the full R8 layered suite must run inside npm run check");
if (!workflow.includes("run: npm run check") || !workflow.includes("run: npm run build")) fail("CI must run repository tests/checks and the production build");
for (const marker of ["unit", "service", "dom", "browser", "--test", "--test-concurrency=1", "tests", ".test.mjs"]) if (!runner.includes(marker)) fail(`layered test runner is missing ${marker}`);

const fixtureMain = JSON.parse(await read("tests/fixtures/catalog-main.json"));
const fixtureAdult = JSON.parse(await read("tests/fixtures/catalog-adult.json"));
const fixtureStates = JSON.parse(await read("tests/fixtures/reading-states.json"));
const fixtureTickets = JSON.parse(await read("tests/fixtures/media-ticket-scenarios.json"));
const fixtureVisual = JSON.parse(await read("tests/fixtures/visual-pages.json"));
const mainSeries = Array.isArray(fixtureMain.series) ? fixtureMain.series : [];
const adultSeries = Array.isArray(fixtureAdult.series) ? fixtureAdult.series : [];
if (!mainSeries.some(series => Array.isArray(series.volumes) && series.volumes.length === 1)) fail("Main fixture must include a single-volume series");
if (!mainSeries.some(series => Array.isArray(series.volumes) && series.volumes.length > 1)) fail("Main fixture must include a multi-volume series");
if (!mainSeries.some(series => String(series.description || "").length > 180 && String(series.title || "").length > 80)) fail("Main fixture must include deliberately long metadata");
if (!adultSeries.length || !adultSeries.every(series => String(series.id || "").startsWith("adult-") && series.nsfw === true)) fail("Adult fixture must remain explicitly scoped and NSFW-marked");
const states = new Set((fixtureStates.cases || []).map(item => item.expectedState));
for (const state of ["unread", "in-progress", "finished"]) if (!states.has(state)) fail(`reading-state fixture is missing ${state}`);
if (fixtureStates.readAgain?.preserveBookmarks !== true || fixtureStates.readAgain?.restartQuery !== "restart=1") fail("Read Again fixture must preserve bookmarks and require restart=1");
const ticketScenarios = new Set((fixtureTickets.scenarios || []).map(item => item.name));
for (const name of ["valid", "tampered signature", "tampered path", "expired"]) if (!ticketScenarios.has(name)) fail(`media ticket fixture is missing scenario: ${name}`);
const visualKinds = new Map((fixtureVisual.spine || []).map(item => [item.kind, Boolean(item.visualOnly)]));
for (const kind of ["cover", "map", "illustration"]) if (visualKinds.get(kind) !== true) fail(`visual EPUB fixture must mark ${kind} as visual-only`);
if (visualKinds.get("chapter") !== false) fail("visual EPUB fixture must retain a normal reflowable chapter control");

const readingFlow = await read("tests/browser/reading-flow.test.mjs");
for (const marker of ["Read → Continue → Finished → Read Again", "preserves bookmarks", "resetFinishedVolume", "restart: true", "catalog-adult.json"]) if (!readingFlow.includes(marker)) fail(`priority browser reading flow test is missing ${marker}`);
const readerInteractions = await read("tests/browser/reader-interactions.test.mjs");
for (const marker of ["paginated", "scrolled-doc", "touchmove", "mode:\"pinch\"", "mode:\"pan\"", "externalHttpHref", "externalLinkDialog", "noopener,noreferrer"]) if (!readerInteractions.includes(marker)) fail(`Reader interaction smoke is missing ${marker}`);
const mediaTest = await read("tests/service/media-ticket.test.mjs");
for (const marker of ["tampered signatures", "expired signed media tickets", "verifyMediaTicketCookie", "canonicalMediaCacheUrl"]) if (!mediaTest.includes(marker)) fail(`media-ticket integration coverage is missing ${marker}`);
const adminTest = await read("tests/service/admin-auth.test.mjs");
for (const marker of ["both bearer token and signed session", "adminAuthorized", "issueAdminSession"]) if (!adminTest.includes(marker)) fail(`Keeper authorization integration coverage is missing ${marker}`);
const keeperSmoke = await read("tests/browser/keeper-smoke.test.mjs");
for (const marker of ["admin/auth-session.js", "verifySession", "admin-api", "admin/core.js", "admin/app.js"]) if (!keeperSmoke.includes(marker)) fail(`Keeper browser smoke is missing ${marker}`);
const mobileNavSmoke = await read("tests/browser/mobile-nav-viewport.test.mjs");
for (const marker of ["position:fixed!important", "top:62px;bottom:0;height:auto", "overflow-y:auto", "100dvh"]) if (!mobileNavSmoke.includes(marker)) fail(`mobile navigation viewport smoke is missing ${marker}`);
const libraryFilterSmoke = await read("tests/browser/library-filter-ux.test.mjs");
for (const marker of ["writeCollapsed", "mobile-results-focus", "active-filter-pill-label", "volumeRange", "readingStatus", "Recently Added"]) if (!libraryFilterSmoke.includes(marker)) fail(`mobile Library filter smoke is missing ${marker}`);

for (const marker of ["Shadow Garden Test Architecture", "Unit", "Service / integration", "DOM", "Browser smoke", "Shared fixtures", "Read → Continue → Finished → Read Again", "Permanent R8 guard"]) if (!architecture.includes(marker)) fail(`TEST_ARCHITECTURE.md is missing ${marker}`);
if (!docsIndex.includes("TEST_ARCHITECTURE.md") || !architectureIndex.includes("TEST_ARCHITECTURE.md")) fail("documentation indexes must include TEST_ARCHITECTURE.md");
if (!roadmap.includes("R8. Test architecture and fixtures | ✅ Done")) fail("Refactor roadmap must record R8 complete");
if (!roadmap.includes("R9. Build and deployment cleanup |")) fail("R9 milestone must remain present after R8");
if (!semverAtLeast(pkg.version, "1.23.0")) fail(`R8 requires v1.23.0 or newer, found ${pkg.version}`);

if (failures.length) {
  console.error(`Shadow Garden R8 test-architecture check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("Shadow Garden R8 layered unit, service, DOM, browser-smoke, fixture, and priority-flow contracts passed.");
}
