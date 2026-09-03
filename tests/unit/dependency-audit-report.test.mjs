import test from "node:test";
import assert from "node:assert/strict";
import { classifyVulnerability, summarizeAudit, renderAuditMarkdown } from "../../tools/dependency-audit-report.mjs";

function report(vulnerabilities = {}) {
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: {} } };
}

test("classifies high and critical production findings as action required", () => {
  assert.equal(classifyVulnerability({ severity: "high", isDirect: false, fixAvailable: false }), "action");
  assert.equal(classifyVulnerability({ severity: "critical", isDirect: true, fixAvailable: false }), "action");
});

test("classifies moderate direct and fixable transitive findings as review required", () => {
  assert.equal(classifyVulnerability({ severity: "moderate", isDirect: true, fixAvailable: false }), "review");
  assert.equal(classifyVulnerability({ severity: "moderate", isDirect: false, fixAvailable: true }), "review");
  assert.equal(classifyVulnerability({ severity: "moderate", isDirect: false, fixAvailable: { name: "parent", version: "2.0.0", isSemVerMajor: true } }), "review");
});

test("classifies lower and non-fixable moderate transitive findings as monitor only", () => {
  assert.equal(classifyVulnerability({ severity: "moderate", isDirect: false, fixAvailable: false }), "monitor");
  assert.equal(classifyVulnerability({ severity: "low", isDirect: true, fixAvailable: true }), "monitor");
  assert.equal(classifyVulnerability({ severity: "info", isDirect: false, fixAvailable: false }), "monitor");
});

test("summarizes findings deterministically by policy and severity", () => {
  const summary = summarizeAudit(report({
    transitiveModerate: { severity: "moderate", isDirect: false, fixAvailable: false, via: [] },
    directModerate: { severity: "moderate", isDirect: true, fixAvailable: false, via: [] },
    criticalThing: { severity: "critical", isDirect: false, fixAvailable: false, via: [] },
    highThing: { severity: "high", isDirect: true, fixAvailable: true, via: [] },
    lowThing: { severity: "low", isDirect: false, fixAvailable: true, via: [] }
  }));

  assert.deepEqual(summary.counts, { action: 2, review: 1, monitor: 2, total: 5 });
  assert.deepEqual(summary.findings.map(finding => [finding.name, finding.category]), [
    ["criticalThing", "action"],
    ["highThing", "action"],
    ["directModerate", "review"],
    ["transitiveModerate", "monitor"],
    ["lowThing", "monitor"]
  ]);
});

test("renders operator policy and advisory details without auto-remediation", () => {
  const summary = summarizeAudit(report({
    vulnerable: {
      severity: "high",
      isDirect: true,
      fixAvailable: { name: "vulnerable", version: "2.0.0", isSemVerMajor: true },
      via: [{ title: "Example advisory", url: "https://example.invalid/advisory" }]
    }
  }));
  const markdown = renderAuditMarkdown(summary, { generatedAt: "2026-09-04T00:00:00.000Z" });
  assert.match(markdown, /Action required \| 1/);
  assert.match(markdown, /Example advisory/);
  assert.match(markdown, /major update/);
  assert.match(markdown, /Do not run `npm audit fix`/);
  assert.match(markdown, /complete verification matrix/);
});

test("rejects unsupported or error-shaped npm audit output", () => {
  assert.throws(() => summarizeAudit({ error: { summary: "registry unavailable" } }), /supported auditReportVersion=2/);
  assert.throws(() => summarizeAudit({ auditReportVersion: 1, vulnerabilities: {} }), /supported auditReportVersion=2/);
});
