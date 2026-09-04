import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const JS_ROOT = path.join(SRC, "assets", "js");
const retiredBrowserScripts = ["src/assets/js/reading-status.js"];
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

function stripUrl(value) {
  return String(value || "").trim().split("#")[0].split("?")[0];
}

function browserScriptTarget(value, fromFile) {
  const clean = stripUrl(value);
  if (!clean || !clean.endsWith(".js")) return null;
  if (clean.startsWith("/assets/js/")) return path.join(SRC, clean.slice(1));
  if (clean.startsWith("./") || clean.startsWith("../")) return path.resolve(path.dirname(fromFile), clean);
  return null;
}

function collectScriptRefs(source, fromFile) {
  const targets = new Set();
  const add = value => {
    const target = browserScriptTarget(value, fromFile);
    if (target && target.startsWith(JS_ROOT)) targets.add(target);
  };

  for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/g)) add(match[1]);
  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) add(match[1]);
  for (const match of source.matchAll(/["'`](\/assets\/js\/[A-Za-z0-9_./-]+\.js(?:\?[^"'`\s)]*)?)["'`]/g)) add(match[1]);
  return [...targets];
}

for (const retired of retiredBrowserScripts) {
  if (fssync.existsSync(path.join(ROOT, retired))) failures.push(`retired browser compatibility script returned: ${retired}`);
}

const allScripts = await walk(JS_ROOT, file => file.endsWith(".js"));
const allSet = new Set(allScripts);
const roots = new Set();
const htmlFiles = await walk(SRC, file => file.endsWith(".html"));

for (const htmlFile of htmlFiles) {
  const html = await fs.readFile(htmlFile, "utf8");
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const target = browserScriptTarget(match[1], htmlFile);
    if (target && target.startsWith(JS_ROOT)) roots.add(target);
  }
}

const reachable = new Set();
const queue = [...roots];
while (queue.length) {
  const file = queue.shift();
  if (reachable.has(file)) continue;
  if (!allSet.has(file)) {
    failures.push(`browser composition references missing script ${rel(file)}`);
    continue;
  }
  reachable.add(file);
  const source = await fs.readFile(file, "utf8");
  for (const target of collectScriptRefs(source, file)) {
    if (!allSet.has(target)) failures.push(`${rel(file)} references missing browser script ${rel(target)}`);
    else if (!reachable.has(target)) queue.push(target);
  }
}

const unreachable = allScripts.filter(file => !reachable.has(file)).sort((a, b) => rel(a).localeCompare(rel(b)));
for (const file of unreachable) failures.push(`browser script is unreachable from production HTML composition: ${rel(file)}`);

if (!roots.size) failures.push("no production browser script roots were discovered in src HTML");

if (failures.length) {
  console.error(`Browser entrypoint reachability check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Browser entrypoint reachability check passed: ${roots.size} HTML script roots reach all ${allScripts.length} browser scripts.`);
}
