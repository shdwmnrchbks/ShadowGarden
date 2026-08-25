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

const required = [
  "package-lock.json",
  "tools/lib/build-context.mjs",
  "tools/preview.mjs",
  "docs/architecture/BUILD_DEPLOYMENT.md"
];
for (const file of required) if (!(await exists(file))) fail(`R9 required artifact is missing: ${file}`);

const [pkgText, lockText, workflow, build, writeSource, buildContext, preview, buildContract, architecture, docsIndex, architectureIndex, roadmap, gitignore] = await Promise.all([
  read("package.json"),
  read("package-lock.json"),
  read(".github/workflows/verify.yml"),
  read("tools/build.mjs"),
  read("tools/write-source.mjs"),
  read("tools/lib/build-context.mjs"),
  read("tools/preview.mjs"),
  read("docs/architecture/BUILD_CONTRACT.md"),
  read("docs/architecture/BUILD_DEPLOYMENT.md"),
  read("docs/README.md"),
  read("docs/architecture/README.md"),
  read("docs/roadmaps/REFACTOR_ROADMAP.md"),
  read(".gitignore")
]);

const pkg = JSON.parse(pkgText);
const lock = JSON.parse(lockText);
if (!semverAtLeast(pkg.version, "1.24.0")) fail(`R9 requires v1.24.0 or newer, found ${pkg.version}`);
if (pkg.engines?.node !== "22.x") fail("package.json must pin the project engine to Node 22.x");
if (pkg.scripts?.preview !== "node tools/preview.mjs") fail("npm preview must use the dependency-free tools/preview.mjs owner");
if (!String(pkg.scripts?.check || "").includes("node tools/check-r9.mjs")) fail("tools/check-r9.mjs must remain in npm run check");

if (lock.lockfileVersion !== 3) fail(`package-lock.json must use lockfileVersion 3, found ${lock.lockfileVersion}`);
if (lock.name !== pkg.name || lock.version !== pkg.version) fail("package-lock root name/version must match package.json");
const rootLock = lock.packages?.[""] || {};
if (rootLock.name !== pkg.name || rootLock.version !== pkg.version) fail("package-lock packages[''] name/version must match package.json");
if (rootLock.engines?.node !== pkg.engines?.node) fail("package-lock Node engine must match package.json");
const manifestDeps = pkg.dependencies || {}, lockDeps = rootLock.dependencies || {};
if (JSON.stringify(manifestDeps) !== JSON.stringify(lockDeps)) fail("package-lock direct dependency declarations must match package.json exactly");

const expectedDependencies = ["@aws-sdk/client-s3", "aws4fetch", "epubjs", "fast-xml-parser", "jszip"];
for (const dep of expectedDependencies) if (!Object.hasOwn(manifestDeps, dep)) fail(`R9 dependency audit must retain owned dependency: ${dep}`);
const forbiddenBundlers = ["vite", "webpack", "rollup", "esbuild", "parcel", "@parcel/core"];
for (const dep of forbiddenBundlers) if (Object.hasOwn(manifestDeps, dep) || Object.hasOwn(pkg.devDependencies || {}, dep)) fail(`R9 no-bundler decision forbids direct dependency: ${dep}`);

for (const marker of [
  "permissions:\n  contents: read",
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  "node-version: 22",
  "cache: npm",
  "npm ci --no-audit --no-fund --progress=false",
  "run: npm run check",
  "run: npm run build"
]) if (!workflow.includes(marker)) fail(`Verify workflow is missing R9 marker: ${marker}`);
for (const retired of ["npm install --no-audit", "contents: write", "upload-artifact", "Commit initial R9 lockfile", "Export initial R9 lockfile"]) if (workflow.includes(retired)) fail(`Verify workflow still contains temporary/pre-R9 behavior: ${retired}`);

for (const marker of ["SOURCE_DATE_EPOCH", "CF_PAGES_COMMIT_SHA", "GITHUB_SHA", "CF_PAGES_BRANCH", "GITHUB_REF_NAME", "--format=%cI", "package.json", "builtAt"]) if (!buildContext.includes(marker)) fail(`build-context owner is missing ${marker}`);
if (!build.includes('from "./lib/build-context.mjs"') || !build.includes("const buildContext=await loadBuildContext()")) fail("tools/build.mjs must consume the shared build context");
if (!build.includes("generatedAt=buildContext.builtAt")) fail("local catalog generatedAt must use the shared deterministic build timestamp");
if (build.includes("generatedAt=new Date().toISOString()")) fail("tools/build.mjs must not generate catalog time directly from the wall clock");
if (!writeSource.includes("from './lib/build-context.mjs'") || !writeSource.includes("const versionInfo=await loadBuildContext()")) fail("tools/write-source.mjs must consume the shared build context");
if (writeSource.includes("builtAt:new Date().toISOString()")) fail("tools/write-source.mjs must not own an independent build timestamp");

for (const marker of ["node:http", "dist/ is missing", "GET", "HEAD", "Cache-Control", "no-store", "application/epub+zip", "127.0.0.1", "4173"]) if (!preview.includes(marker)) fail(`dependency-free preview server is missing ${marker}`);
if (pkg.scripts?.preview?.includes("npx") || pkg.scripts?.preview?.includes("serve")) fail("preview must not resolve an undeclared CLI through npx");

for (const marker of [
  "Shadow Garden Build & Deployment Layer",
  "Deliberate no-bundler decision",
  "Dependency audit",
  "Lockfile and install contract",
  "Deterministic build context",
  "Local preview",
  "Cloudflare Pages contract",
  "Permanent R9 guard",
  "@aws-sdk/client-s3",
  "aws4fetch",
  "epubjs",
  "fast-xml-parser",
  "jszip"
]) if (!architecture.includes(marker)) fail(`BUILD_DEPLOYMENT.md is missing ${marker}`);
if (!buildContract.includes("package-lock.json") || !buildContract.includes("npm ci") || !buildContract.includes("BUILD_DEPLOYMENT.md")) fail("BUILD_CONTRACT.md must record the finalized R9 lockfile/install boundary");
if (!docsIndex.includes("BUILD_DEPLOYMENT.md") || !architectureIndex.includes("BUILD_DEPLOYMENT.md")) fail("documentation indexes must include BUILD_DEPLOYMENT.md");
if (!roadmap.includes("R9. Build and deployment cleanup | ✅ Done")) fail("Refactor roadmap must record R9 complete");
if (!roadmap.includes("R10. Final cutover and legacy removal | ⬜ Planned")) fail("R10 must remain the next planned refactor milestone");
if (!roadmap.includes("**Release:** v1.24.0")) fail("Refactor roadmap must record the R9 v1.24.0 release");
if (!gitignore.split(/\r?\n/).includes("dist/")) fail("dist/ must remain ignored/generated");
if (!gitignore.split(/\r?\n/).includes("node_modules/")) fail("node_modules/ must remain ignored/generated");

if (failures.length) {
  console.error(`Shadow Garden R9 build/deployment check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("Shadow Garden R9 locked dependencies, deterministic build context, read-only CI, preview, no-bundler, and deployment contracts passed.");
}
