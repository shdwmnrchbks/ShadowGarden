import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const V2_VERSION = /^2\.\d+\.\d+$/;

function firstVersion(source, pattern) {
  return String(source || "").match(pattern)?.[1] || "";
}

export function checkReleaseMetadata({
  packageJson = {},
  packageLock = {},
  changelog = "",
  releaseNotes = "",
  releaseWorkflow = "",
  buildContextSource = ""
} = {}) {
  const failures = [];
  const formalVersion = String(packageJson.version || "").trim();
  const deploymentVersion = String(packageJson.deploymentVersion || formalVersion).trim();

  if (!V2_VERSION.test(formalVersion)) failures.push(`package.json#version must be a v2 semver release, found ${formalVersion || "missing"}`);
  if (!V2_VERSION.test(deploymentVersion)) failures.push(`package.json#deploymentVersion must be a v2 semver release, found ${deploymentVersion || "missing"}`);
  if (!formalVersion || !deploymentVersion) return failures;

  if (packageLock.version !== formalVersion) failures.push(`package-lock.json version is ${packageLock.version || "missing"}; expected ${formalVersion}`);
  if (packageLock?.packages?.[""]?.version !== formalVersion) failures.push(`package-lock.json root package version is ${packageLock?.packages?.[""]?.version || "missing"}; expected ${formalVersion}`);

  const changelogVersion = firstVersion(changelog, /^##\s+([0-9]+\.[0-9]+\.[0-9]+)\b/m);
  if (!changelogVersion) failures.push("CHANGELOG.md is missing a release heading");
  else if (changelogVersion !== formalVersion) failures.push(`CHANGELOG.md latest release is ${changelogVersion}; expected ${formalVersion}`);

  const notesVersion = firstVersion(releaseNotes, /^#\s+Shadow Garden v([0-9]+\.[0-9]+\.[0-9]+)\b/m);
  if (!releaseNotes) failures.push(`docs/releases/v${formalVersion}.md is missing`);
  else if (!notesVersion) failures.push(`docs/releases/v${formalVersion}.md is missing the canonical Shadow Garden version heading`);
  else if (notesVersion !== formalVersion) failures.push(`release notes heading is v${notesVersion}; expected v${formalVersion}`);

  const workflowRules = [
    [/jq -r ['"]\.version['"] package\.json/, "release-v2.yml must source the formal release from package.json#version"],
    [/NOTES="docs\/releases\/v\$\{VERSION\}\.md"/, "release-v2.yml must derive release notes from the formal version"],
    [/deployed_version.*= "\$VERSION"/s, "release-v2.yml must require production deployment version to match the formal release"],
    [/deployed_commit.*= "\$HEAD_SHA"/s, "release-v2.yml must require production deployment commit to match the verified main commit"]
  ];
  for (const [pattern, message] of workflowRules) {
    if (!pattern.test(String(releaseWorkflow))) failures.push(message);
  }

  if (!/const releaseVersion = String\(pkg\.version/.test(String(buildContextSource))) {
    failures.push("build context must source releaseVersion from package.json#version");
  }
  if (!/const version = String\(pkg\.deploymentVersion \|\| releaseVersion\)/.test(String(buildContextSource))) {
    failures.push("build context must source deployment version from deploymentVersion with formal-version fallback");
  }

  return failures;
}

async function readJson(root, relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
}

export async function runReleaseMetadataCheck(root = process.cwd()) {
  const packageJson = await readJson(root, "package.json");
  const formalVersion = String(packageJson.version || "").trim();
  const notesPath = path.join(root, "docs", "releases", `v${formalVersion}.md`);

  const [packageLock, changelog, releaseWorkflow, buildContextSource, releaseNotes] = await Promise.all([
    readJson(root, "package-lock.json"),
    fs.readFile(path.join(root, "CHANGELOG.md"), "utf8"),
    fs.readFile(path.join(root, ".github", "workflows", "release-v2.yml"), "utf8"),
    fs.readFile(path.join(root, "tools", "lib", "build-context.mjs"), "utf8"),
    fs.readFile(notesPath, "utf8").catch(error => error?.code === "ENOENT" ? "" : Promise.reject(error))
  ]);

  const failures = checkReleaseMetadata({ packageJson, packageLock, changelog, releaseNotes, releaseWorkflow, buildContextSource });
  if (failures.length) {
    console.error(`Release metadata check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
    failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
    return failures;
  }

  console.log(`Release metadata check passed: formal v${formalVersion}, deployment v${packageJson.deploymentVersion || formalVersion}.`);
  return [];
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  runReleaseMetadataCheck().catch(error => {
    console.error(`Release metadata check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
