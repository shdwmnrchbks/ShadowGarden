import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FUNCTIONS_ROOT = path.join(ROOT, "functions");
const failures = [];

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

async function walk(dir, predicate = () => true) {
  if (!fssync.existsSync(dir)) return [];
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(file, predicate));
    else if (entry.isFile() && predicate(file)) out.push(file);
  }
  return out;
}

function cleanSpecifier(value) {
  return String(value || "").trim().split("#")[0].split("?")[0];
}

function functionTarget(value, fromFile) {
  const clean = cleanSpecifier(value);
  if (!clean || (!clean.startsWith("./") && !clean.startsWith("../"))) return null;
  let target = path.resolve(path.dirname(fromFile), clean);
  if (!path.extname(target)) target += ".js";
  return target.startsWith(FUNCTIONS_ROOT) ? target : null;
}

function collectImports(source, fromFile) {
  const targets = new Set();
  const add = value => {
    const target = functionTarget(value, fromFile);
    if (target) targets.add(target);
  };
  for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/g)) add(match[1]);
  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) add(match[1]);
  return [...targets];
}

const allFiles = await walk(FUNCTIONS_ROOT, file => file.endsWith(".js"));
const allSet = new Set(allFiles);
const internalRoots = [path.join(FUNCTIONS_ROOT, "_lib") + path.sep, path.join(FUNCTIONS_ROOT, "services") + path.sep];
const routeRoots = allFiles.filter(file => !internalRoots.some(prefix => file.startsWith(prefix)));

if (!routeRoots.length) failures.push("no Pages Function route entrypoints were discovered");

const reachable = new Set();
const queue = [...routeRoots];
while (queue.length) {
  const file = queue.shift();
  if (reachable.has(file)) continue;
  if (!allSet.has(file)) {
    failures.push(`Functions composition references missing source ${rel(file)}`);
    continue;
  }
  reachable.add(file);
  const source = await fs.readFile(file, "utf8");
  for (const target of collectImports(source, file)) {
    if (!allSet.has(target)) failures.push(`${rel(file)} imports missing Functions source ${rel(target)}`);
    else if (!reachable.has(target)) queue.push(target);
  }
}

const unreachable = allFiles.filter(file => !reachable.has(file)).sort((a, b) => rel(a).localeCompare(rel(b)));
for (const file of unreachable) failures.push(`Functions source is unreachable from a Pages Function route: ${rel(file)}`);

if (failures.length) {
  console.error(`Functions entrypoint reachability check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Functions entrypoint reachability check passed: ${routeRoots.length} route roots reach all ${allFiles.length} Functions sources.`);
}
