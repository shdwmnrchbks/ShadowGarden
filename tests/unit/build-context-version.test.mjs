import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

import { loadBuildContext } from "../../tools/lib/build-context.mjs";

test("build context separates active deployment version from formal release version", async () => {
  const packageJson = JSON.parse(await fs.readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const context = await loadBuildContext();

  assert.equal(context.version, packageJson.deploymentVersion || packageJson.version);
  assert.equal(context.releaseVersion, packageJson.version);
});
