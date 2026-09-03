import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPECTED_NODE_ENGINE,
  EXPECTED_NODE_PIN,
  EXPECTED_PACKAGE_MANAGER,
  validateAuditLockExercise,
  validateManifestLock,
  validateWorkflowNodePins
} from "../../tools/check-runtime-lockfiles.mjs";

function manifest() {
  return {
    name: "fixture",
    version: "1.2.3",
    packageManager: EXPECTED_PACKAGE_MANAGER,
    engines: { node: EXPECTED_NODE_ENGINE },
    dependencies: { alpha: "^1.0.0" }
  };
}

function lock() {
  return {
    name: "fixture",
    version: "1.2.3",
    lockfileVersion: 3,
    packages: {
      "": {
        name: "fixture",
        version: "1.2.3",
        engines: { node: EXPECTED_NODE_ENGINE },
        dependencies: { alpha: "^1.0.0" }
      },
      "node_modules/alpha": {
        version: "1.0.1",
        resolved: "https://registry.npmjs.org/alpha/-/alpha-1.0.1.tgz",
        integrity: "sha512-fixture"
      }
    }
  };
}

test("accepts synchronized manifest and lock metadata", () => {
  const result = validateManifestLock(manifest(), lock(), { label: "fixture", dependencyField: "dependencies" });
  assert.deepEqual(result.errors, []);
  assert.equal(result.registryPackages, 1);
});

test("detects engine, version, and dependency drift", () => {
  const pkg = manifest();
  const pkgLock = lock();
  pkg.engines.node = ">=20";
  pkgLock.version = "1.2.2";
  pkgLock.packages[""].dependencies = { alpha: "^2.0.0" };
  const result = validateManifestLock(pkg, pkgLock, { label: "fixture", dependencyField: "dependencies" });
  assert.ok(result.errors.some(error => error.includes("engines.node")));
  assert.ok(result.errors.some(error => error.includes("lockfile version")));
  assert.ok(result.errors.some(error => error.includes("dependencies must match")));
});

test("rejects old lockfile formats and missing direct package entries", () => {
  const pkgLock = lock();
  pkgLock.lockfileVersion = 2;
  delete pkgLock.packages["node_modules/alpha"];
  const result = validateManifestLock(manifest(), pkgLock, { label: "fixture", dependencyField: "dependencies" });
  assert.ok(result.errors.some(error => error.includes("lockfileVersion must be 3")));
  assert.ok(result.errors.some(error => error.includes("missing direct package entry alpha")));
});

test("rejects non-npm resolutions and weak or missing integrity", () => {
  const pkgLock = lock();
  pkgLock.packages["node_modules/alpha"].resolved = "https://example.invalid/alpha.tgz";
  pkgLock.packages["node_modules/alpha"].integrity = "sha1-old";
  const result = validateManifestLock(manifest(), pkgLock, { label: "fixture", dependencyField: "dependencies" });
  assert.ok(result.errors.some(error => error.includes("resolves outside")));
  assert.ok(result.errors.some(error => error.includes("sha512 integrity")));
});

test("requires exact Node patch pins in setup-node workflows", () => {
  const good = `steps:\n  - uses: actions/setup-node@${"a".repeat(40)}\n    with:\n      node-version: ${EXPECTED_NODE_PIN}\n`;
  const bad = `steps:\n  - uses: actions/setup-node@${"a".repeat(40)}\n    with:\n      node-version: 22\n`;
  const valid = validateWorkflowNodePins({ "verify.yml": good, "e2e.yml": good, "dependency-audit.yml": good });
  assert.deepEqual(valid.errors, []);
  const invalid = validateWorkflowNodePins({ "verify.yml": bad, "e2e.yml": good, "dependency-audit.yml": good });
  assert.ok(invalid.errors.some(error => error.includes(`pin node-version to ${EXPECTED_NODE_PIN}`)));
});

test("requires the weekly audit workflow to exercise both lockfiles", () => {
  const valid = `run: npm ci --omit=dev --no-audit --no-fund\nrun: npm run check:runtime\nrun: npm ci --prefix tests/e2e --ignore-scripts --no-audit --no-fund\n`;
  assert.deepEqual(validateAuditLockExercise(valid), []);
  const invalid = `run: npm ci --omit=dev --no-audit --package-lock=false\n`;
  const errors = validateAuditLockExercise(invalid);
  assert.ok(errors.some(error => error.includes("E2E lockfile")));
  assert.ok(errors.some(error => error.includes("deterministic runtime/lockfile guard")));
  assert.ok(errors.some(error => error.includes("must not bypass package-lock")));
});
