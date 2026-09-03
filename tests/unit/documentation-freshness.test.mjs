import assert from "node:assert/strict";
import test from "node:test";

import { checkDocumentationFreshness } from "../../tools/check-documentation-freshness.mjs";

function fixture(overrides = {}) {
  return {
    packageJson: { version: "2.9.0", deploymentVersion: "2.10.0" },
    currentRoadmap: "**Active release:** v2.10.0 — Maintenance & Supply Chain\n\n# v2.10.0 — Maintenance & Supply Chain\n",
    docsIndex: [
      "[`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md) — **the single active roadmap**.",
      "**Active deployment/product line:** v2.10.0 — Maintenance & Supply Chain.",
      "**Latest formal release:** v2.9.0 — Keeper Productivity & Recovery."
    ].join("\n"),
    versioningContract: [
      "**Active deployment/product version:** v2.10.0 — Maintenance & Supply Chain",
      "**Formal release source version:** v2.9.0"
    ].join("\n"),
    ...overrides
  };
}

test("documentation freshness accepts synchronized active and formal versions", () => {
  assert.deepEqual(checkDocumentationFreshness(fixture()), []);
});

test("documentation freshness reports roadmap deployment drift", () => {
  const failures = checkDocumentationFreshness(fixture({
    currentRoadmap: "**Active release:** v2.9.0 — Keeper Productivity & Recovery\n\n# v2.9.0 — Keeper Productivity & Recovery\n"
  }));
  assert.ok(failures.some(message => message.includes("CURRENT_ROADMAP active release is v2.9.0; expected v2.10.0")));
  assert.ok(failures.some(message => message.includes("missing the v2.10.0 release section")));
});

test("documentation freshness reports stale docs index versions", () => {
  const failures = checkDocumentationFreshness(fixture({
    docsIndex: [
      "[`roadmaps/CURRENT_ROADMAP.md`](./roadmaps/CURRENT_ROADMAP.md) — **the single active roadmap**.",
      "**Active deployment/product line:** v2.8.0 — Reader Experience.",
      "**Latest formal release:** v2.8.0 — Reader Experience."
    ].join("\n")
  }));
  assert.ok(failures.some(message => message.includes("docs index active deployment is v2.8.0; expected v2.10.0")));
  assert.ok(failures.some(message => message.includes("docs index formal release is v2.8.0; expected v2.9.0")));
});

test("documentation freshness requires the canonical current-roadmap link", () => {
  const failures = checkDocumentationFreshness(fixture({
    docsIndex: [
      "**Active deployment/product line:** v2.10.0 — Maintenance & Supply Chain.",
      "**Latest formal release:** v2.9.0 — Keeper Productivity & Recovery."
    ].join("\n")
  }));
  assert.ok(failures.some(message => message.includes("must link to ./roadmaps/CURRENT_ROADMAP.md")));
});

test("documentation freshness reports versioning-contract drift", () => {
  const failures = checkDocumentationFreshness(fixture({
    versioningContract: [
      "**Active deployment/product version:** v2.9.0 — Keeper Productivity & Recovery",
      "**Formal release source version:** v2.8.0"
    ].join("\n")
  }));
  assert.ok(failures.some(message => message.includes("VERSIONING_CONTRACT active deployment is v2.9.0; expected v2.10.0")));
  assert.ok(failures.some(message => message.includes("VERSIONING_CONTRACT formal release is v2.8.0; expected v2.9.0")));
});
