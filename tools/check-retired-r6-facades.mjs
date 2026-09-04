import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const retiredFacades = [
  "functions/_lib/b2.js",
  "functions/_lib/garden-maintenance.js"
];
const retiredSet = new Set(retiredFacades);
const scanRoots = ["functions", "src", "tests", "tools"];
const failures = [];

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

async function walk(dir) {
  if (!fssync.existsSync(dir)) return [];
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(file));
    else if (entry.isFile() && /\.(?:js|mjs|cjs)$/.test(file)) out.push(file);
  }
  return out;
}

function importedSpecifierTargets(file, specifier) {
  const clean = String(specifier || "").split("#")[0].split("?")[0];
  if (!clean) return "";
  if (clean.startsWith(".")) return rel(path.resolve(path.dirname(file), clean));
  if (clean.startsWith("/")) return clean.slice(1);
  return "";
}

for (const facade of retiredFacades) {
  if (fssync.existsSync(path.join(ROOT, facade))) {
    failures.push(`retired R6 compatibility facade returned: ${facade}`);
  }
}

const files = (await Promise.all(scanRoots.map(root => walk(path.join(ROOT, root))))).flat();
const importPattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;

for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const target = importedSpecifierTargets(file, match[1]);
    if (retiredSet.has(target)) {
      failures.push(`${rel(file)} imports retired R6 compatibility facade ${target}`);
    }
  }
}

if (failures.length) {
  console.error(`Retired R6 facade check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("Retired R6 facade check passed: compatibility facades are absent and unreferenced.");
}
