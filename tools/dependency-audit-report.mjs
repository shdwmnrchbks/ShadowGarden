import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SEVERITY_RANK = new Map([
  ["critical", 5],
  ["high", 4],
  ["moderate", 3],
  ["low", 2],
  ["info", 1],
  ["unknown", 0]
]);

const CATEGORY_ORDER = ["action", "review", "monitor"];
const CATEGORY_LABEL = {
  action: "Action required",
  review: "Review required",
  monitor: "Monitor only"
};

function severityOf(vulnerability) {
  const severity = String(vulnerability?.severity || "unknown").toLowerCase();
  return SEVERITY_RANK.has(severity) ? severity : "unknown";
}

function hasFix(vulnerability) {
  return vulnerability?.fixAvailable !== false && vulnerability?.fixAvailable != null;
}

export function classifyVulnerability(vulnerability = {}) {
  const severity = severityOf(vulnerability);
  if (severity === "critical" || severity === "high") return "action";
  if (severity === "moderate" && (Boolean(vulnerability.isDirect) || hasFix(vulnerability))) return "review";
  return "monitor";
}

function advisoryDetails(vulnerability = {}) {
  const entries = Array.isArray(vulnerability.via) ? vulnerability.via : [];
  const seen = new Set();
  const details = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const title = String(entry.title || entry.name || "advisory").trim();
    const url = String(entry.url || "").trim();
    const key = `${title}\n${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    details.push({ title, url });
  }
  return details;
}

function fixLabel(vulnerability = {}) {
  const fix = vulnerability.fixAvailable;
  if (fix === false || fix == null) return "No known npm fix";
  if (fix === true) return "Available";
  if (typeof fix === "object") {
    const name = fix.name ? String(fix.name) : "dependency";
    const version = fix.version ? ` ${fix.version}` : "";
    return fix.isSemVerMajor ? `${name}${version} (major update)` : `${name}${version}`;
  }
  return "Available";
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ").trim();
}

function firstAdvisory(vulnerability) {
  const advisory = advisoryDetails(vulnerability)[0];
  if (!advisory) return "—";
  if (!advisory.url) return advisory.title;
  return `[${advisory.title}](${advisory.url})`;
}

export function summarizeAudit(report) {
  if (!report || typeof report !== "object" || report.auditReportVersion !== 2 || !report.vulnerabilities || typeof report.vulnerabilities !== "object") {
    throw new Error("npm audit did not return a supported auditReportVersion=2 vulnerability report");
  }

  const findings = Object.entries(report.vulnerabilities).map(([name, vulnerability]) => ({
    name,
    severity: severityOf(vulnerability),
    isDirect: Boolean(vulnerability?.isDirect),
    fixAvailable: vulnerability?.fixAvailable ?? false,
    category: classifyVulnerability(vulnerability),
    advisories: advisoryDetails(vulnerability),
    raw: vulnerability
  }));

  findings.sort((a, b) => {
    const categoryDelta = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDelta) return categoryDelta;
    const severityDelta = (SEVERITY_RANK.get(b.severity) || 0) - (SEVERITY_RANK.get(a.severity) || 0);
    if (severityDelta) return severityDelta;
    return a.name.localeCompare(b.name);
  });

  const counts = { action: 0, review: 0, monitor: 0, total: findings.length };
  for (const finding of findings) counts[finding.category] += 1;
  return { findings, counts };
}

export function renderAuditMarkdown(summary, { generatedAt = new Date().toISOString() } = {}) {
  const lines = [
    "# Shadow Garden Dependency Audit Report",
    "",
    `Generated: ${generatedAt}`,
    "",
    "This report covers the production dependency tree (`npm audit --omit=dev`). It is triage evidence, not proof of exploitability or reachability, and it never applies dependency changes automatically.",
    "",
    "## Policy result",
    "",
    "| Classification | Count | Meaning |",
    "| --- | ---: | --- |",
    `| Action required | ${summary.counts.action} | High/critical production finding; triage promptly and track a safe remediation or mitigation. |`,
    `| Review required | ${summary.counts.review} | Moderate direct finding or moderate transitive finding with an npm-reported fix; review runtime relevance and upgrade impact. |`,
    `| Monitor only | ${summary.counts.monitor} | Lower-severity or currently non-fixable transitive finding; reassess on the next audit cycle. |`,
    `| **Total** | **${summary.counts.total}** | |`,
    ""
  ];

  if (!summary.findings.length) {
    lines.push("No production dependency vulnerabilities were reported by npm audit.", "");
  } else {
    for (const category of CATEGORY_ORDER) {
      const findings = summary.findings.filter(finding => finding.category === category);
      if (!findings.length) continue;
      lines.push(`## ${CATEGORY_LABEL[category]}`, "", "| Package | Severity | Direct | Fix | Advisory |", "| --- | --- | --- | --- | --- |");
      for (const finding of findings) {
        lines.push(`| ${escapeCell(finding.name)} | ${escapeCell(finding.severity)} | ${finding.isDirect ? "Yes" : "No"} | ${escapeCell(fixLabel(finding.raw))} | ${firstAdvisory(finding.raw)} |`);
      }
      lines.push("");
    }
  }

  lines.push(
    "## Operator rule",
    "",
    "Do not run `npm audit fix` as an automated remediation. Review the advisory, affected runtime path, dependency/lockfile diff, and Shadow Garden owner boundaries. EPUB.js, AWS/B2, authentication/security, and workflow-execution changes remain high-impact and require the complete verification matrix before merge.",
    ""
  );

  return lines.join("\n");
}

function parseArgs(argv) {
  const options = { input: "npm-audit.json", output: "", failOnAction: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") options.input = argv[++index] || "";
    else if (arg === "--output") options.output = argv[++index] || "";
    else if (arg === "--fail-on-action") options.failOnAction = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.input) throw new Error("--input requires a file path");
  return options;
}

export async function runAuditReport(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const raw = await fs.readFile(options.input, "utf8");
  let report;
  try {
    report = JSON.parse(raw);
  } catch (error) {
    throw new Error(`npm audit output was not valid JSON: ${error.message}`);
  }
  const summary = summarizeAudit(report);
  const markdown = renderAuditMarkdown(summary);
  if (options.output) await fs.writeFile(options.output, markdown, "utf8");
  process.stdout.write(`${markdown}\n`);
  if (options.failOnAction && summary.counts.action > 0) process.exitCode = 2;
  return summary;
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  runAuditReport().catch(error => {
    console.error(`Dependency audit report failed: ${error.message}`);
    process.exitCode = 3;
  });
}
