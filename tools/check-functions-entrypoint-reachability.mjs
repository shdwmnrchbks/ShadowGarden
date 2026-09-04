import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FUNCTIONS_ROOT = path.join(ROOT, "functions");
const SERVICES_ROOT = path.join(FUNCTIONS_ROOT, "services") + path.sep;
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

function importSpecifiers(source) {
  const values = [];
  for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/g)) values.push(match[1]);
  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) values.push(match[1]);
  return values;
}

function collectImports(source, fromFile) {
  const targets = new Set();
  for (const value of importSpecifiers(source)) {
    const target = functionTarget(value, fromFile);
    if (target) targets.add(target);
  }
  return [...targets];
}

function exportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of source.matchAll(/\bexport\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of source.matchAll(/\bexport\s*\{([^}]+)\}\s*;?/g)) {
    if (/\bfrom\s*["']/.test(match[0])) continue;
    for (const item of match[1].split(",")) {
      const local = item.trim().split(/\s+as\s+/i)[0]?.trim();
      if (local) names.add(local);
    }
  }
  return names;
}

function recordNamedConsumers(source, fromFile, consumers) {
  for (const match of source.matchAll(/\b(?:import|export)\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g)) {
    const target = functionTarget(match[2], fromFile);
    if (!target || target === fromFile) continue;
    if (!consumers.has(target)) consumers.set(target, new Set());
    const names = consumers.get(target);
    for (const item of match[1].split(",")) {
      const imported = item.trim().split(/\s+as\s+/i)[0]?.trim();
      if (imported) names.add(imported);
    }
  }

  for (const match of source.matchAll(/\b(?:import\s*\*\s+as\s+[A-Za-z_$][\w$]*\s+from|export\s*\*)\s*["']([^"']+)["']/g)) {
    const target = functionTarget(match[1], fromFile);
    if (!target || target === fromFile) continue;
    if (!consumers.has(target)) consumers.set(target, new Set());
    consumers.get(target).add("*");
  }

  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const target = functionTarget(match[1], fromFile);
    if (!target || target === fromFile) continue;
    if (!consumers.has(target)) consumers.set(target, new Set());
    consumers.get(target).add("*");
  }
}

const DIRECT_DELEGATION = /export\s+async\s+function\s+onRequest(?:Get|Post|Put|Patch|Delete|Head|Options)?\s*\(\s*context\s*\)\s*\{\s*return\s+[A-Za-z_$][\w$]*\s*\(\s*context\s*\)\s*;?\s*\}/g;

function routeRemainder(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*import\s+[^;]+;\s*$/gm, "")
    .replace(/^\s*export\s*\{[^}]+\};\s*$/gm, "")
    .replace(DIRECT_DELEGATION, "")
    .replace(/[\s;]/g, "");
}

const allFiles = await walk(FUNCTIONS_ROOT, file => file.endsWith(".js"));
const allSet = new Set(allFiles);
const internalRoots = [path.join(FUNCTIONS_ROOT, "_lib") + path.sep, SERVICES_ROOT];
const routeRoots = allFiles.filter(file => !internalRoots.some(prefix => file.startsWith(prefix)));
const serviceFiles = allFiles.filter(file => file.startsWith(SERVICES_ROOT));

if (!routeRoots.length) failures.push("no Pages Function route entrypoints were discovered");

for (const file of routeRoots) {
  const source = await fs.readFile(file, "utf8");
  const bytes = Buffer.byteLength(source, "utf8");
  if (bytes > 1024) failures.push(`${rel(file)} is ${bytes} bytes; Pages Function routes must stay thin adapters`);

  for (const specifier of importSpecifiers(source)) {
    const target = functionTarget(specifier, file);
    if (!target || !target.startsWith(SERVICES_ROOT)) {
      failures.push(`${rel(file)} imports ${specifier}; route adapters may depend only on functions/services/`);
    }
  }

  const wrappers = [...source.matchAll(DIRECT_DELEGATION)];
  if (!wrappers.length) failures.push(`${rel(file)} has no direct onRequest → service-handler delegation`);
  if (routeRemainder(source)) failures.push(`${rel(file)} contains route-owned executable logic outside direct service delegation`);
}

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

const consumerRoots = [FUNCTIONS_ROOT, path.join(ROOT, "tests"), path.join(ROOT, "tools")];
const consumerFiles = (await Promise.all(consumerRoots.map(root => walk(root, file => /\.(?:js|mjs)$/.test(file))))).flat();
const consumers = new Map();
for (const file of consumerFiles) recordNamedConsumers(await fs.readFile(file, "utf8"), file, consumers);

let serviceExportCount = 0;
for (const file of serviceFiles) {
  const names = exportedNames(await fs.readFile(file, "utf8"));
  serviceExportCount += names.size;
  const used = consumers.get(file) || new Set();
  if (used.has("*")) continue;
  for (const name of names) {
    if (!used.has(name)) failures.push(`Functions service export has no repository consumer: ${rel(file)}#${name}`);
  }
}

if (failures.length) {
  console.error(`Functions entrypoint/ownership check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Functions entrypoint/ownership check passed: ${routeRoots.length} thin route roots reach all ${allFiles.length} Functions sources; ${serviceExportCount} service exports have consumers.`);
}
