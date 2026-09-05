import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function requireMatch(source, pattern, message, failures) {
  if (!pattern.test(String(source || ""))) failures.push(message);
}

export function checkBaselineMaintenance({ packageJson = {}, baselineWorkflow = "", e2eWorkflow = "", performanceSource = "" } = {}) {
  const failures = [];

  if (packageJson.scripts?.["performance:sanity"] !== "node tools/performance-sanity.mjs") {
    failures.push("package.json must expose performance:sanity through tools/performance-sanity.mjs");
  }
  if (!String(packageJson.scripts?.check || "").includes("node tools/performance-sanity.mjs")) {
    failures.push("npm run check must own the realistic-scale performance sanity");
  }
  if (packageJson.scripts?.["check:baseline"] !== "node tools/check-baseline-maintenance.mjs") {
    failures.push("package.json must expose check:baseline through tools/check-baseline-maintenance.mjs");
  }

  requireMatch(baselineWorkflow, /workflow_dispatch:\s*(?:\n|$)/, "Baseline Health must support manual dispatch", failures);
  requireMatch(baselineWorkflow, /schedule:\s*(?:\n|$)[\s\S]*cron:\s*['"]0 1 1 \* \*['"]/, "Baseline Health must run monthly at 09:00 Asia/Manila (01:00 UTC on day 1)", failures);
  if (/\n\s*(?:pull_request|push):/.test(baselineWorkflow)) failures.push("Baseline Health must remain a scheduled/manual maintenance workflow, not a PR/push duplicate");
  for (const [pattern, message] of [
    [/node-version:\s*22\.23\.2\b/, "Baseline Health must use the reviewed Node 22.23.2 patch"],
    [/npm ci --no-audit --no-fund --progress=false/, "Baseline Health must install the committed root lockfile with npm ci"],
    [/npm run check\b/, "Baseline Health must run repository contracts including realistic-scale performance sanity"],
    [/npm run check:security\b/, "Baseline Health must rerun security contract checks"],
    [/npm test\b/, "Baseline Health must rerun all deterministic test layers, including recovery tests"],
    [/npm run build:dist\b/, "Baseline Health must rebuild production output after repository checks without rerunning prebuild"]
  ]) requireMatch(baselineWorkflow, pattern, message, failures);

  requireMatch(e2eWorkflow, /workflow_dispatch:\s*(?:\n|$)/, "Real Browser E2E must support manual baseline reruns", failures);
  requireMatch(e2eWorkflow, /schedule:\s*(?:\n|$)[\s\S]*cron:\s*['"]0 2 1 \* \*['"]/, "Real Browser E2E must rerun monthly at 10:00 Asia/Manila (02:00 UTC on day 1)", failures);
  requireMatch(e2eWorkflow, /npx playwright test --project=\$\{\{ matrix\.project \}\}/, "Real Browser E2E monthly baseline must run the complete project suite rather than a filtered spec subset", failures);

  requireMatch(performanceSource, /DEFAULT_SERIES_COUNT\s*=\s*300\b/, "Performance sanity must keep the realistic 300-series catalog baseline", failures);
  requireMatch(performanceSource, /DEFAULT_SEVERE_REGRESSION_MS\s*=\s*5000\b/, "Performance sanity must keep a broad severe-regression ceiling instead of a microbenchmark budget", failures);
  requireMatch(performanceSource, /from "\.\.\/src\/assets\/js\/library-model\.js"/, "Performance sanity must exercise the real Library model", failures);
  requireMatch(performanceSource, /contextualFilterOptions\(/, "Performance sanity must exercise contextual filter computation", failures);
  requireMatch(performanceSource, /filterAndSort\(/, "Performance sanity must exercise Library filtering and sorting", failures);

  return failures;
}

export async function runBaselineMaintenanceCheck(root = process.cwd()) {
  const [packageSource, baselineWorkflow, e2eWorkflow, performanceSource] = await Promise.all([
    fs.readFile(path.join(root, "package.json"), "utf8"),
    fs.readFile(path.join(root, ".github", "workflows", "baseline-health.yml"), "utf8"),
    fs.readFile(path.join(root, ".github", "workflows", "e2e.yml"), "utf8"),
    fs.readFile(path.join(root, "tools", "performance-sanity.mjs"), "utf8")
  ]);
  const packageJson = JSON.parse(packageSource);
  const failures = checkBaselineMaintenance({ packageJson, baselineWorkflow, e2eWorkflow, performanceSource });

  if (failures.length) {
    console.error(`Baseline maintenance check failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
    failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
    return failures;
  }
  console.log("Baseline maintenance check passed: monthly deterministic/security/recovery/performance and full real-browser baselines are scheduled.");
  return [];
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  runBaselineMaintenanceCheck().catch(error => {
    console.error(`Baseline maintenance check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
