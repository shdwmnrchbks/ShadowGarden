import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const AUTHORED_EXTENSIONS = new Set([".css", ".html", ".js", ".mjs"]);
const LOCAL_VERSION_QUERY = /(?:(?:\.\.\/|\.\/)|(?:\/(?:assets|data)\/)|(?:\b(?:assets|data)\/))[^"'`\s)\]]*\?v=[^"'`\s)&]+/g;

async function authoredFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (AUTHORED_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
    }
  }
  await walk(path.join(root, "src"));
  return files;
}

export async function checkAuthoredCacheVersions(root = process.cwd()) {
  const failures = [];
  for (const file of await authoredFiles(root)) {
    const source = await fs.readFile(file, "utf8");
    for (const match of source.matchAll(LOCAL_VERSION_QUERY)) {
      const line = source.slice(0, match.index).split("\n").length;
      failures.push(`${path.relative(root, file)}:${line} contains authored local cache history ${match[0]}`);
    }
  }
  return failures;
}

export async function runAuthoredCacheVersionCheck(root = process.cwd()) {
  const failures = await checkAuthoredCacheVersions(root);
  if (failures.length) {
    console.error(`Authored cache-version check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
    failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
    return failures;
  }
  console.log("Authored cache-version check passed: local asset cache versions are build-owned.");
  return [];
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  runAuthoredCacheVersionCheck().catch(error => {
    console.error(`Authored cache-version check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
