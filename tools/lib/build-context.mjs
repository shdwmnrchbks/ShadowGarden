import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

function epochToIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error("SOURCE_DATE_EPOCH must be a non-negative Unix timestamp.");
  return new Date(seconds * 1000).toISOString();
}

export async function loadBuildContext() {
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
  const version = String(pkg.version || "").trim();
  if (!version) throw new Error("package.json version is required for deployment metadata.");

  const commit = String(
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    git(["rev-parse", "HEAD"]) ||
    ""
  ).trim();

  const branch = String(
    process.env.CF_PAGES_BRANCH ||
    process.env.GITHUB_REF_NAME ||
    git(["rev-parse", "--abbrev-ref", "HEAD"]) ||
    ""
  ).trim();

  let builtAt = epochToIso(process.env.SOURCE_DATE_EPOCH);
  if (!builtAt && commit) builtAt = git(["show", "-s", "--format=%cI", commit]);
  if (!builtAt) builtAt = git(["show", "-s", "--format=%cI", "HEAD"]);
  if (!builtAt) builtAt = new Date().toISOString();

  return {
    name: "Shadow Garden",
    version,
    commit: commit || null,
    shortCommit: commit ? commit.slice(0, 7) : null,
    branch: branch || null,
    builtAt
  };
}
