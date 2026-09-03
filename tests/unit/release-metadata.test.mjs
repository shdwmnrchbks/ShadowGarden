import assert from "node:assert/strict";
import test from "node:test";

import { checkReleaseMetadata } from "../../tools/check-release-metadata.mjs";

function fixture(overrides = {}) {
  return {
    packageJson: { version: "2.9.0", deploymentVersion: "2.10.0" },
    packageLock: { version: "2.9.0", packages: { "": { version: "2.9.0" } } },
    changelog: "# Shadow Garden Changelog\n\n## 2.9.0 — Keeper Productivity & Recovery\n",
    releaseNotes: "# Shadow Garden v2.9.0 — Keeper Productivity & Recovery\n",
    releaseWorkflow: [
      "VERSION=\"$(jq -r '.version' package.json)\"",
      "NOTES=\"docs/releases/v${VERSION}.md\"",
      "if [ \"$deployed_version\" = \"$VERSION\" ] && [ \"$deployed_commit\" = \"$HEAD_SHA\" ]; then"
    ].join("\n"),
    buildContextSource: [
      "const releaseVersion = String(pkg.version || \"\").trim();",
      "const version = String(pkg.deploymentVersion || releaseVersion).trim();"
    ].join("\n"),
    ...overrides
  };
}

test("release metadata accepts synchronized formal and deployment ownership", () => {
  assert.deepEqual(checkReleaseMetadata(fixture()), []);
});

test("release metadata rejects package-lock formal-version drift", () => {
  const failures = checkReleaseMetadata(fixture({
    packageLock: { version: "2.8.0", packages: { "": { version: "2.8.0" } } }
  }));
  assert.ok(failures.some(message => message.includes("package-lock.json version is 2.8.0; expected 2.9.0")));
  assert.ok(failures.some(message => message.includes("root package version is 2.8.0; expected 2.9.0")));
});

test("release metadata rejects stale changelog and release-note versions", () => {
  const failures = checkReleaseMetadata(fixture({
    changelog: "# Shadow Garden Changelog\n\n## 2.8.0 — Reader Experience\n",
    releaseNotes: "# Shadow Garden v2.8.0 — Reader Experience\n"
  }));
  assert.ok(failures.some(message => message.includes("CHANGELOG.md latest release is 2.8.0; expected 2.9.0")));
  assert.ok(failures.some(message => message.includes("release notes heading is v2.8.0; expected v2.9.0")));
});

test("release metadata requires matching formal release notes", () => {
  const failures = checkReleaseMetadata(fixture({ releaseNotes: "" }));
  assert.ok(failures.some(message => message.includes("docs/releases/v2.9.0.md is missing")));
});

test("release metadata pins publisher version, notes, production version, and commit ownership", () => {
  const failures = checkReleaseMetadata(fixture({ releaseWorkflow: "VERSION=2.9.0\n" }));
  assert.ok(failures.some(message => message.includes("source the formal release from package.json#version")));
  assert.ok(failures.some(message => message.includes("derive release notes from the formal version")));
  assert.ok(failures.some(message => message.includes("production deployment version")));
  assert.ok(failures.some(message => message.includes("production deployment commit")));
});

test("release metadata pins build-context version ownership", () => {
  const failures = checkReleaseMetadata(fixture({ buildContextSource: "const version = pkg.version;" }));
  assert.ok(failures.some(message => message.includes("source releaseVersion from package.json#version")));
  assert.ok(failures.some(message => message.includes("source deployment version from deploymentVersion")));
});
