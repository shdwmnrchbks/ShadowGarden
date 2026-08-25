import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { loadBuildContext } from "../../tools/lib/build-context.mjs";

const KEYS = ["CF_PAGES_COMMIT_SHA", "GITHUB_SHA", "CF_PAGES_BRANCH", "GITHUB_REF_NAME", "SOURCE_DATE_EPOCH"];
const pkg = JSON.parse(await fs.readFile(new URL("../../package.json", import.meta.url), "utf8"));

async function withEnv(values, fn) {
  const previous = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
  try {
    for (const key of KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    return await fn();
  } finally {
    for (const key of KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("build context honors explicit deployment identity and SOURCE_DATE_EPOCH", async () => {
  await withEnv({
    CF_PAGES_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567",
    CF_PAGES_BRANCH: "main",
    SOURCE_DATE_EPOCH: "0"
  }, async () => {
    const context = await loadBuildContext();
    assert.equal(context.name, "Shadow Garden");
    assert.equal(context.version, pkg.version);
    assert.equal(context.commit, "0123456789abcdef0123456789abcdef01234567");
    assert.equal(context.shortCommit, "0123456");
    assert.equal(context.branch, "main");
    assert.equal(context.builtAt, "1970-01-01T00:00:00.000Z");
  });
});

test("build context rejects malformed SOURCE_DATE_EPOCH", async () => {
  await withEnv({ SOURCE_DATE_EPOCH: "not-a-timestamp" }, async () => {
    await assert.rejects(loadBuildContext(), /SOURCE_DATE_EPOCH must be a non-negative Unix timestamp/);
  });
});
