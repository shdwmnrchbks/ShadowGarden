import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const VERSION_PATTERN = "([0-9]+\\.[0-9]+\\.[0-9]+)";
const RETIRED_EXECUTABLE_PATHS = Object.freeze([
  ...Array.from({ length: 11 }, (_, index) => `tools/check-r${index}.mjs`),
  "tools/check-r4-1.mjs",
  ...Array.from({ length: 5 }, (_, index) => `tools/check-m${index + 5}.mjs`),
  "tools/check-v2-6.mjs",
  "tools/check-reading-status.mjs"
]);

function versionFrom(text, pattern, label, failures) {
  const match = String(text || "").match(pattern);
  if (!match) {
    failures.push(`${label} is missing`);
    return "";
  }
  return match[1];
}

function expectVersion(actual, expected, label, failures) {
  if (actual && actual !== expected) failures.push(`${label} is v${actual}; expected v${expected}`);
}

function requireText(text, marker, label, failures) {
  if (!String(text || "").includes(marker)) failures.push(`${label} is missing ${marker}`);
}

function rejectRetiredExecutableClaims(documents, failures) {
  for (const [label, source] of Object.entries(documents)) {
    for (const retired of RETIRED_EXECUTABLE_PATHS) {
      if (String(source || "").includes(retired)) failures.push(`${label} still references retired executable ${retired}`);
    }
  }
}

export function checkDocumentationFreshness({
  packageJson = {},
  currentRoadmap = "",
  docsIndex = "",
  versioningContract = "",
  architectureIndex = "",
  buildContract = "",
  buildDeployment = "",
  testArchitecture = "",
  maintenanceBaseline = "",
  designSystem = "",
  postAudit = ""
} = {}) {
  const failures = [];
  const formalVersion = String(packageJson.version || "").trim();
  const deploymentVersion = String(packageJson.deploymentVersion || formalVersion).trim();

  if (!formalVersion) failures.push("package.json#version is missing");
  if (!deploymentVersion) failures.push("package.json#deploymentVersion is missing");
  if (!formalVersion || !deploymentVersion) return failures;

  const roadmapActive = versionFrom(
    currentRoadmap,
    new RegExp(`\\*\\*Active release:\\*\\*\\s*v${VERSION_PATTERN}`),
    "CURRENT_ROADMAP active release marker",
    failures
  );
  expectVersion(roadmapActive, deploymentVersion, "CURRENT_ROADMAP active release", failures);
  requireText(currentRoadmap, `# v${deploymentVersion}`, "CURRENT_ROADMAP release section", failures);
  requireText(currentRoadmap, "v2.11H", "CURRENT_ROADMAP Audit H status", failures);

  const docsActive = versionFrom(
    docsIndex,
    new RegExp(`\\*\\*Active deployment/product line:\\*\\*\\s*v${VERSION_PATTERN}`),
    "docs index active deployment marker",
    failures
  );
  expectVersion(docsActive, deploymentVersion, "docs index active deployment", failures);
  const docsFormal = versionFrom(
    docsIndex,
    new RegExp(`\\*\\*Latest formal release:\\*\\*\\s*v${VERSION_PATTERN}`),
    "docs index formal release marker",
    failures
  );
  expectVersion(docsFormal, formalVersion, "docs index formal release", failures);
  requireText(docsIndex, "(./roadmaps/CURRENT_ROADMAP.md)", "docs index current-roadmap link", failures);

  const contractActive = versionFrom(
    versioningContract,
    new RegExp(`\\*\\*Active deployment/product version:\\*\\*\\s*v${VERSION_PATTERN}`),
    "VERSIONING_CONTRACT active deployment marker",
    failures
  );
  expectVersion(contractActive, deploymentVersion, "VERSIONING_CONTRACT active deployment", failures);
  const contractFormal = versionFrom(
    versioningContract,
    new RegExp(`\\*\\*Formal release source version:\\*\\*\\s*v${VERSION_PATTERN}`),
    "VERSIONING_CONTRACT formal release marker",
    failures
  );
  expectVersion(contractFormal, formalVersion, "VERSIONING_CONTRACT formal release", failures);

  requireText(architectureIndex, `v${deploymentVersion}`, "architecture index active version", failures);
  requireText(architectureIndex, `v${formalVersion}`, "architecture index formal version", failures);

  const buildActive = versionFrom(
    buildDeployment,
    new RegExp(`\\*\\*Active deployment/product version:\\*\\*\\s*v${VERSION_PATTERN}`),
    "BUILD_DEPLOYMENT active deployment marker",
    failures
  );
  expectVersion(buildActive, deploymentVersion, "BUILD_DEPLOYMENT active deployment", failures);
  const buildFormal = versionFrom(
    buildDeployment,
    new RegExp(`\\*\\*Latest formal release:\\*\\*\\s*v${VERSION_PATTERN}`),
    "BUILD_DEPLOYMENT formal release marker",
    failures
  );
  expectVersion(buildFormal, formalVersion, "BUILD_DEPLOYMENT formal release", failures);

  requireText(buildContract, "npm@10.9.8", "BUILD_CONTRACT package-manager policy", failures);
  requireText(buildDeployment, "npm run build:dist", "BUILD_DEPLOYMENT post-check build primitive", failures);
  requireText(testArchitecture, "npm run build:dist", "TEST_ARCHITECTURE post-check build primitive", failures);
  requireText(maintenanceBaseline, "npm run build:dist", "MAINTENANCE_BASELINE post-check build primitive", failures);
  if (/^- `npm run performance:sanity`/m.test(maintenanceBaseline)) {
    failures.push("MAINTENANCE_BASELINE still documents a duplicate standalone performance:sanity workflow step");
  }
  requireText(designSystem, "audit:css", "DESIGN_SYSTEM current CSS audit owner", failures);
  requireText(postAudit, "v2.11G", "POST_V2_10_AUDIT Audit G disposition", failures);

  rejectRetiredExecutableClaims({
    "architecture index": architectureIndex,
    "build contract": buildContract,
    "build/deployment contract": buildDeployment,
    "test architecture": testArchitecture,
    "maintenance baseline": maintenanceBaseline,
    "design system": designSystem
  }, failures);

  return failures;
}

export async function runDocumentationFreshnessCheck(root = process.cwd()) {
  const files = {
    currentRoadmap: ["docs", "roadmaps", "CURRENT_ROADMAP.md"],
    docsIndex: ["docs", "README.md"],
    versioningContract: ["docs", "architecture", "VERSIONING_CONTRACT.md"],
    architectureIndex: ["docs", "architecture", "README.md"],
    buildContract: ["docs", "architecture", "BUILD_CONTRACT.md"],
    buildDeployment: ["docs", "architecture", "BUILD_DEPLOYMENT.md"],
    testArchitecture: ["docs", "architecture", "TEST_ARCHITECTURE.md"],
    maintenanceBaseline: ["docs", "architecture", "MAINTENANCE_BASELINE.md"],
    designSystem: ["docs", "architecture", "DESIGN_SYSTEM.md"],
    postAudit: ["docs", "audits", "POST_V2_10_AUDIT.md"]
  };
  const packageSource = await fs.readFile(path.join(root, "package.json"), "utf8");
  const entries = await Promise.all(Object.entries(files).map(async ([key, parts]) => [key, await fs.readFile(path.join(root, ...parts), "utf8")]));
  const failures = checkDocumentationFreshness({ packageJson: JSON.parse(packageSource), ...Object.fromEntries(entries) });
  if (failures.length) {
    console.error(`Documentation freshness check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
    failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
    return failures;
  }
  const packageJson = JSON.parse(packageSource);
  console.log(`Documentation freshness check passed: deployment v${packageJson.deploymentVersion || packageJson.version}, formal release v${packageJson.version}; current architecture docs match retired-tool ownership.`);
  return [];
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  runDocumentationFreshnessCheck().catch(error => {
    console.error(`Documentation freshness check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
