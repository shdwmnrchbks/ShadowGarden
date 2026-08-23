/* Shadow Garden Security Milestone 6 — low-cost automation/crawler screening.
 *
 * This is deliberately an additive deterrent, not authentication. User-Agent strings
 * are spoofable, so signed tickets, Turnstile sessions, and acquisition throttling
 * remain the real authorization boundary. The policy only prevents well-behaved AI
 * crawlers and obvious script/headless clients from reaching protected acquisition
 * endpoints in the first place.
 */

const AI_CRAWLER_SIGNATURES = [
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "claude-web",
  "anthropic-ai",
  "perplexitybot",
  "bytespider",
  "ccbot",
  "google-extended",
  "amazonbot",
  "meta-externalagent",
  "facebookbot",
  "applebot-extended",
  "cohere-ai",
  "youbot",
  "diffbot",
  "imagesiftbot",
  "omgilibot"
];

const SCRIPT_CLIENT_SIGNATURES = [
  "curl/",
  "wget/",
  "python-requests",
  "python-httpx",
  "aiohttp/",
  "scrapy/",
  "go-http-client/",
  "libwww-perl/",
  "okhttp/",
  "postmanruntime/",
  "powershell/",
  "node-fetch",
  "undici",
  "axios/",
  "headlesschrome/",
  "phantomjs/"
];

function cleanUserAgent(value) {
  return String(value || "").trim().slice(0, 1024);
}

function firstSignature(userAgent, signatures) {
  const lowered = userAgent.toLowerCase();
  return signatures.find(signature => lowered.includes(signature)) || "";
}

export function classifyAutomatedClient(requestOrUserAgent) {
  const raw = typeof requestOrUserAgent === "string"
    ? requestOrUserAgent
    : requestOrUserAgent?.headers?.get?.("user-agent");
  const userAgent = cleanUserAgent(raw);
  if (!userAgent) {
    return { blocked: true, category: "automation", reason: "missing_user_agent", signature: "" };
  }

  const ai = firstSignature(userAgent, AI_CRAWLER_SIGNATURES);
  if (ai) return { blocked: true, category: "ai_crawler", reason: "known_ai_crawler", signature: ai };

  const script = firstSignature(userAgent, SCRIPT_CLIENT_SIGNATURES);
  if (script) return { blocked: true, category: "script_client", reason: "known_script_client", signature: script };

  return { blocked: false, category: "browser_or_unknown", reason: "", signature: "" };
}

export function crawlerPolicyResponseHeaders(result) {
  return result?.blocked ? { "X-SG-Automation-Policy": "blocked" } : { "X-SG-Automation-Policy": "pass" };
}
