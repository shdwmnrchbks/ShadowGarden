import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const VERSION_PATTERN = "([0-9]+\\.[0-9]+\\.[0-9]+)";

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

export function checkDocumentationFreshness({ packageJson = {}, currentRoadmap = "", docsIndex = "", versioningContract = "" } = {}) {
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

  if (!String(currentRoadmap).includes(`# v${deploymentVersion}`)) {
    failures.push(`CURRENT_ROADMAP is missing the v${deploymentVersion} release section`);
  }

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

  if (!String(docsIndex).includes("(./roadmaps/CURRENT_ROADMAP.md)")) {
    failures.push("docs index must link to ./roadmaps/CURRENT_ROADMAP.md as the current roadmap");
  }

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

  return failures;
}

export async function runDocumentationFreshnessCheck(root = process.cwd()) {
  const [packageSource, currentRoadmap, docsIndex, versioningContract] = await Promise.all([
    fs.readFile(path.join(root, "package.json"), "utf8"),
    fs.readFile(path.join(root, "docs", "roadmaps", "CURRENT_ROADMAP.md"), "utf8"),
    fs.readFile(path.join(root, "docs", "README.md"), "utf8"),
    fs.readFile(path.join(root, "docs", "architecture", "VERSIONING_CONTRACT.md"), "utf8")
  ]);

  const packageJson = JSON.parse(packageSource);
  const failures = checkDocumentationFreshness({ packageJson, currentRoadmap, docsIndex, versioningContract });
  if (failures.length) {
    console.error(`Documentation freshness check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
    failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
    return failures;
  }

  console.log(`Documentation freshness check passed: deployment v${packageJson.deploymentVersion || packageJson.version}, formal release v${packageJson.version}.`);
  return [];
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  runDocumentationFreshnessCheck().catch(error => {
    console.error(`Documentation freshness check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
