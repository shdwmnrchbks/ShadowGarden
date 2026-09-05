import assert from "node:assert/strict";
import test from "node:test";

import { checkDocumentationFreshness } from "../../tools/check-documentation-freshness.mjs";

function fixture(overrides = {}) {
  return {
    packageJson: { version: "2.10.0", deploymentVersion: "2.11.0" },
    currentRoadmap: "**Active release:** v2.11.0 — Engineering Audit\n\n# v2.11.0 — Engineering Audit\n\n## v2.11H — Documentation & repository hygiene\n",
    docsIndex: [
      "[`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md) — current roadmap.",
      "**Active deployment/product line:** v2.11.0 — Engineering Audit.",
      "**Latest formal release:** v2.10.0 — Maintenance."
    ].join("\n"),
    versioningContract: [
      "**Active deployment/product version:** v2.11.0 — Engineering Audit",
      "**Formal release source version:** v2.10.0"
    ].join("\n"),
    architectureIndex: "Active v2.11.0 architecture; latest formal release v2.10.0.",
    buildContract: "Node 22 · npm@10.9.8 · current build contract.",
    buildDeployment: [
      "**Active deployment/product version:** v2.11.0 — Engineering Audit",
      "**Latest formal release:** v2.10.0 — Maintenance",
      "post-check CI uses npm run build:dist"
    ].join("\n"),
    testArchitecture: "Verify checks once, then uses npm run build:dist.",
    maintenanceBaseline: "Baseline runs repository checks and then npm run build:dist.",
    designSystem: "Current CSS ownership measurement runs through npm run audit:css.",
    postAudit: "v2.11A through v2.11G have explicit evidence-backed outcomes.",
    ...overrides
  };
}

test("documentation freshness accepts synchronized current architecture documentation", () => {
  assert.deepEqual(checkDocumentationFreshness(fixture()), []);
});

test("documentation freshness reports roadmap deployment drift", () => {
  const failures = checkDocumentationFreshness(fixture({
    currentRoadmap: "**Active release:** v2.10.0 — Maintenance\n\n# v2.10.0 — Maintenance\n\n## v2.11H — Documentation & repository hygiene\n"
  }));
  assert.ok(failures.some(message => message.includes("CURRENT_ROADMAP active release is v2.10.0; expected v2.11.0")));
  assert.ok(failures.some(message => message.includes("missing # v2.11.0")));
});

test("documentation freshness reports stale docs index versions", () => {
  const failures = checkDocumentationFreshness(fixture({
    docsIndex: [
      "[`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md)",
      "**Active deployment/product line:** v2.8.0 — Reader Experience.",
      "**Latest formal release:** v2.8.0 — Reader Experience."
    ].join("\n")
  }));
  assert.ok(failures.some(message => message.includes("docs index active deployment is v2.8.0; expected v2.11.0")));
  assert.ok(failures.some(message => message.includes("docs index formal release is v2.8.0; expected v2.10.0")));
});

test("documentation freshness reports stale build/deployment version", () => {
  const failures = checkDocumentationFreshness(fixture({
    buildDeployment: [
      "**Active deployment/product version:** v2.8.0 — Reader Experience",
      "**Latest formal release:** v2.6.7",
      "npm run build:dist"
    ].join("\n")
  }));
  assert.ok(failures.some(message => message.includes("BUILD_DEPLOYMENT active deployment is v2.8.0; expected v2.11.0")));
  assert.ok(failures.some(message => message.includes("BUILD_DEPLOYMENT formal release is v2.6.7; expected v2.10.0")));
});

test("documentation freshness rejects retired executable claims in current contracts", () => {
  const failures = checkDocumentationFreshness(fixture({
    testArchitecture: "npm run build:dist\nPermanent guard: tools/check-v2-6.mjs"
  }));
  assert.ok(failures.some(message => message.includes("test architecture still references retired executable tools/check-v2-6.mjs")));
});

test("documentation freshness permits current retired-tool absence guards", () => {
  const data = fixture({
    architectureIndex: "v2.11.0 / v2.10.0 · tools/check-retired-milestone-checkers.mjs · tools/check-retired-release-tools.mjs"
  });
  assert.deepEqual(checkDocumentationFreshness(data), []);
});

test("documentation freshness rejects duplicate Baseline performance invocation", () => {
  const failures = checkDocumentationFreshness(fixture({
    maintenanceBaseline: "- `npm run performance:sanity`\n- `npm run build:dist`"
  }));
  assert.ok(failures.some(message => message.includes("duplicate standalone performance:sanity")));
});
