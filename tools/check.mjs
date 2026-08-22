import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const failures = [];
const stats = { scripts: 0, json: 0, html: 0, refs: 0 };

const retiredPaths = [
  ".cloudflare-deploy-trigger",
  "src/assets/js/reader-continuous-anchor-fix.js",
  "src/assets/js/reader-stability.js",
  "src/assets/js/reader-seek-neighborhood.js",
  "src/assets/js/admin-upload-workflow-v1.7.0.js",
  "src/assets/js/admin-upload-completion-v1.7.1.js",
  "src/assets/js/admin-v1.7.2.js",
  "src/assets/js/admin-backup-history-v1.7.4.js",
  "src/assets/css/reader-stability.css",
  "src/assets/css/v1-polish.css",
  "src/assets/css/site-v1.5.css",
  "src/assets/css/site-v1.6.css",
  "src/assets/css/admin-v1.7.css",
  "src/assets/css/admin-v1.7.1.css",
  "src/assets/css/admin-v1.7.2.css",
  "src/assets/css/admin-backup-history-v1.7.4.css"
];

const ignoredAssetPrefixes = [
  "/assets/vendor/",
  "/data/",
  "/books/",
  "/covers/",
  "/media/",
  "/admin-api/"
];

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function fail(message) {
  failures.push(message);
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

function shouldIgnoreRef(value) {
  if (!value || value === "/") return true;
  if (/^(?:https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(value)) return true;
  return ignoredAssetPrefixes.some(prefix => value.startsWith(prefix));
}

function sourcePathForRef(value, fromFile) {
  const clean = stripUrl(value);
  if (shouldIgnoreRef(clean)) return null;
  if (clean.startsWith("/")) return path.join(SRC, clean.slice(1));
  return path.resolve(path.dirname(fromFile), clean);
}

function assertLocalRef(value, fromFile) {
  const target = sourcePathForRef(value, fromFile);
  if (!target) return;
  stats.refs += 1;
  if (!fssync.existsSync(target)) fail(`${rel(fromFile)} references missing ${stripUrl(value)}`);
}

async function checkScripts() {
  const roots = [path.join(SRC, "assets", "js"), path.join(ROOT, "functions"), path.join(ROOT, "tools")];
  const files = (await Promise.all(roots.map(root => walk(root, file => /\.(?:js|mjs)$/.test(file))))).flat();
  for (const file of files) {
    stats.scripts += 1;
    try {
      execFileSync(process.execPath, ["--check", file], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      const detail = String(error?.stderr || error?.message || error).trim().split("\n").slice(-4).join(" ");
      fail(`${rel(file)} failed syntax check: ${detail}`);
    }
  }
}

async function checkJson() {
  const roots = [SRC, path.join(ROOT, "functions"), path.join(ROOT, "library")];
  const files = (await Promise.all(roots.map(root => walk(root, file => file.endsWith(".json"))))).flat();
  files.push(path.join(ROOT, "package.json"));
  const seen = new Set();
  for (const file of files) {
    if (seen.has(file) || !fssync.existsSync(file)) continue;
    seen.add(file);
    stats.json += 1;
    try {
      JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      fail(`${rel(file)} is invalid JSON: ${error.message}`);
    }
  }
}

async function checkHtml() {
  const files = await walk(SRC, file => file.endsWith(".html"));
  for (const file of files) {
    stats.html += 1;
    const html = await fs.readFile(file, "utf8");

    const ids = new Map();
    for (const match of html.matchAll(/\bid=["']([^"']+)["']/gi)) {
      ids.set(match[1], (ids.get(match[1]) || 0) + 1);
    }
    for (const [id, count] of ids) {
      if (count > 1) fail(`${rel(file)} contains duplicate id="${id}" (${count} occurrences)`);
    }

    for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
      assertLocalRef(match[1], file);
    }
  }
}

async function checkRuntimeAssetRefs() {
  const files = await walk(path.join(SRC, "assets", "js"), file => file.endsWith(".js"));
  const assetPattern = /["'`](\/assets\/[A-Za-z0-9_./-]+(?:\?[^"'`\s)]*)?)["'`]/g;
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    for (const match of source.matchAll(assetPattern)) assertLocalRef(match[1], file);
  }

  const headers = path.join(SRC, "_headers");
  if (fssync.existsSync(headers)) {
    const source = await fs.readFile(headers, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const value = line.trim();
      if (value.startsWith("/assets/")) assertLocalRef(value, headers);
    }
  }
}

function checkRetiredFiles() {
  for (const item of retiredPaths) {
    if (fssync.existsSync(path.join(ROOT, item))) fail(`retired compatibility asset returned: ${item}`);
  }
}

async function main() {
  checkRetiredFiles();
  await checkScripts();
  await checkJson();
  await checkHtml();
  await checkRuntimeAssetRefs();

  if (failures.length) {
    console.error(`Shadow Garden check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
    failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Shadow Garden check passed: ${stats.scripts} scripts, ${stats.json} JSON files, ${stats.html} HTML files, ${stats.refs} local references.`);
}

await main();
