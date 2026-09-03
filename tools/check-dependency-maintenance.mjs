import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const EXPECTED_DIRECT = [
  "@aws-sdk/client-s3",
  "aws4fetch",
  "epubjs",
  "fast-xml-parser",
  "jszip"
].sort();

const failures = [];
const fail = message => failures.push(message);
const read = file => fs.readFile(path.join(ROOT, file), "utf8");

function updateBlock(source, ecosystem) {
  const marker = `  - package-ecosystem: ${ecosystem}`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const next = source.indexOf("\n  - package-ecosystem:", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}

function sorted(values) {
  return [...values].sort();
}

function sameList(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function requireWeeklyManila(block, ecosystem, expectedTime) {
  if (!/interval:\s*weekly\b/.test(block)) fail(`${ecosystem} Dependabot updates must run weekly`);
  if (!/day:\s*monday\b/.test(block)) fail(`${ecosystem} Dependabot updates must run on Monday`);
  if (!new RegExp(`time:\\s*["']?${expectedTime.replace(":", "\\:")}["']?`).test(block)) fail(`${ecosystem} Dependabot updates must run at ${expectedTime}`);
  if (!/timezone:\s*Asia\/Manila\b/.test(block)) fail(`${ecosystem} Dependabot updates must use Asia/Manila`);
  if (!/open-pull-requests-limit:\s*5\b/.test(block)) fail(`${ecosystem} Dependabot updates must cap open PRs at 5`);
}

function requireAuditWorkflow(audit) {
  if (!/workflow_dispatch:\s*(?:\n|$)/.test(audit)) fail("Dependency audit workflow must support manual dispatch");
  if (!/schedule:\s*(?:\n|$)/.test(audit) || !/cron:\s*["']0 1 \* \* 1["']/.test(audit)) {
    fail("Dependency audit workflow must run Monday at 09:00 Asia/Manila (01:00 UTC)");
  }
  if (/\n\s*pull_request:|\n\s*push:/.test(audit)) fail("Dependency audit workflow must stay separate from pull-request/push Verify gates");
  if (!/npm ci --omit=dev --no-audit/.test(audit)) fail("Dependency audit workflow must install the production tree without install-time audit noise");
  if (!/npm audit --omit=dev --json/.test(audit)) fail("Dependency audit workflow must collect production-only npm audit JSON");
  if (!/dependency-audit-report\.mjs[^\n]*--fail-on-action/.test(audit)) fail("Dependency audit workflow must classify findings with the repository reporter");
  if (!/GITHUB_STEP_SUMMARY/.test(audit)) fail("Dependency audit workflow must publish a human-readable job summary");
  if (/npm\s+audit\s+fix\b/.test(audit)) fail("Dependency audit workflow must never run npm audit fix");
}

async function main() {
  const [packageSource, dependabot, e2e, audit] = await Promise.all([
    read("package.json"),
    read(".github/dependabot.yml"),
    read(".github/workflows/e2e.yml"),
    read(".github/workflows/dependency-audit.yml")
  ]);
  const pkg = JSON.parse(packageSource);
  const direct = sorted(Object.keys(pkg.dependencies || {}));
  if (!sameList(direct, EXPECTED_DIRECT)) {
    fail(`package.json direct dependency set changed; update the controlled allow-list (${direct.join(", ")})`);
  }
  if (pkg.scripts?.["audit:report"] !== "node tools/dependency-audit-report.mjs --input npm-audit.json") {
    fail("package.json must expose the non-mutating audit:report command");
  }

  if (!/^version:\s*2\s*$/m.test(dependabot)) fail("Dependabot config must use version 2");
  const npmBlock = updateBlock(dependabot, "npm");
  const actionsBlock = updateBlock(dependabot, "github-actions");
  if (!npmBlock) fail("Dependabot must configure npm updates");
  if (!actionsBlock) fail("Dependabot must configure GitHub Actions updates");

  if (npmBlock) {
    requireWeeklyManila(npmBlock, "npm", "08:00");
    const allowed = sorted([...npmBlock.matchAll(/dependency-name:\s*["']?([^\s"']+)["']?/g)].map(match => match[1]));
    if (!sameList(allowed, EXPECTED_DIRECT)) {
      fail(`Dependabot npm allow-list must contain exactly the five direct dependencies (${allowed.join(", ")})`);
    }
    const directMarkers = [...npmBlock.matchAll(/dependency-type:\s*direct\b/g)].length;
    if (directMarkers !== EXPECTED_DIRECT.length) fail("Every allowed npm dependency must be marked direct");
  }
  if (actionsBlock) requireWeeklyManila(actionsBlock, "github-actions", "08:20");

  if (!/pull_request:\s*(?:\n|$)/.test(e2e)) fail("Real Browser E2E must run on pull requests");
  const ignored = e2e.match(/paths-ignore:\s*([\s\S]*?)(?=\n\S|\n  push:|$)/)?.[1] || "";
  if (/package(?:-lock)?\.json|\.github\//.test(ignored)) {
    fail("Real Browser E2E must not ignore package metadata or .github workflow/config changes");
  }

  requireAuditWorkflow(audit);

  const workflowDir = path.join(ROOT, ".github", "workflows");
  const workflowNames = (await fs.readdir(workflowDir)).filter(name => /\.ya?ml$/i.test(name)).sort();
  for (const name of workflowNames) {
    const source = await fs.readFile(path.join(workflowDir, name), "utf8");
    const lowered = source.toLowerCase();
    for (const forbidden of ["pull_request_target:", "gh pr merge", "enable-auto-merge", "enable_auto_merge"]) {
      if (lowered.includes(forbidden)) fail(`${name} contains forbidden dependency auto-merge surface: ${forbidden}`);
    }
    for (const match of source.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)) {
      const ref = match[1];
      if (ref.startsWith("./") || ref.startsWith("docker://")) continue;
      const at = ref.lastIndexOf("@");
      const target = at >= 0 ? ref.slice(at + 1) : "";
      if (!/^[0-9a-f]{40}$/i.test(target)) fail(`${name} action is not pinned to a full commit SHA: ${ref}`);
    }
  }

  if (failures.length) {
    console.error(`Dependency maintenance check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
    failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Dependency maintenance check passed: ${EXPECTED_DIRECT.length} allow-listed npm dependencies, scheduled audit policy, and ${workflowNames.length} pinned workflow files.`);
}

await main();
