import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const LAYERS = Object.freeze(["unit", "service", "dom", "browser"]);
const requested = process.argv.slice(2);
const selected = !requested.length || requested.includes("all") ? LAYERS : requested;

for (const layer of selected) {
  if (!LAYERS.includes(layer)) {
    console.error(`Unknown Shadow Garden test layer: ${layer}. Expected ${LAYERS.join(", ")}, or all.`);
    process.exit(2);
  }
}

async function filesFor(layer) {
  const dir = path.join(ROOT, "tests", layer);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter(entry => entry.isFile() && entry.name.endsWith(".test.mjs"))
    .map(entry => path.join("tests", layer, entry.name)).sort();
}

for (const layer of selected) {
  const files = await filesFor(layer);
  if (!files.length) {
    console.error(`Shadow Garden ${layer} test layer contains no *.test.mjs files.`);
    process.exit(2);
  }
  console.log(`\n=== Shadow Garden ${layer} tests (${files.length} file${files.length === 1 ? "" : "s"}) ===`);
  const run = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...files], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env
  });
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status || 1);
}
