import fs from "node:fs/promises";
import path from "node:path";
import { classifyAutomatedClient } from "../functions/_lib/crawler-policy.js";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");

function checkClassifier(){
  const browser="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0 Safari/537.36";
  if(classifyAutomatedClient(browser).blocked)fail("normal browser User-Agent must not be blocked");
  const blocked=[["GPTBot/1.2","ai_crawler"],["ClaudeBot/1.0","ai_crawler"],["curl/8.8.0","script_client"],["python-requests/2.32","script_client"],["Mozilla/5.0 HeadlessChrome/151.0 Safari/537.36","script_client"]];
  for(const [userAgent,category] of blocked){const result=classifyAutomatedClient(userAgent);if(!result.blocked||result.category!==category)fail(`${userAgent} should be blocked as ${category}`)}
  if(!classifyAutomatedClient("").blocked)fail("missing User-Agent should be denied on protected acquisition endpoints");
}

async function checkWiring(){
  const [bookRoute,humanRoute,mediaRoute,media,auth,robots,headers,roadmap,guide]=await Promise.all([
    read("functions/book-access.js"),read("functions/human-access.js"),read("functions/media/[[path]].js"),read("functions/services/media.js"),read("functions/services/auth.js"),read("src/robots.txt"),read("src/_headers"),read("docs/roadmaps/SECURITY_ROADMAP.md"),read("docs/security/MILESTONE_6_CRAWLER_POLICY.md")
  ]);
  if(!bookRoute.includes("handleBookAccess")||!humanRoute.includes("handleHumanAccess")||!mediaRoute.includes("handleMediaRequest"))fail("M6 endpoints must remain R6 service adapters");
  for(const marker of ["classifyAutomatedClient","automated_access_denied","X-SG-Automation-Policy"]){if(!media.includes(marker))fail(`book-access media service is missing Milestone 6 marker ${marker}`)}
  for(const marker of ["classifyAutomatedClient","automated_access_denied","X-SG-Automation-Policy"]){if(!auth.includes(marker))fail(`human-access auth service is missing Milestone 6 marker ${marker}`)}

  const classifierPos=media.indexOf("const automation = classifyAutomatedClient"),humanPos=media.indexOf("const human = humanAccessConfig"),resolverPos=media.indexOf("const resolved = await resolveBookReference");
  if(classifierPos<0||humanPos<0||resolverPos<0||classifierPos>humanPos||classifierPos>resolverPos)fail("book-access automation screening must run before human-session and catalog resolution work");
  const proxy=media.slice(media.indexOf("export async function handleMediaRequest"));
  if(proxy.includes("classifyAutomatedClient")||proxy.includes("crawlerPolicyResponseHeaders"))fail("crawler User-Agent policy must stay out of the EPUB media/Range proxy");

  for(const marker of ["Disallow: /media/","Disallow: /reader.html","Disallow: /book-access","User-agent: GPTBot","User-agent: ClaudeBot","User-agent: Google-Extended"]){if(!robots.includes(marker))fail(`robots.txt is missing ${marker}`)}
  if(!headers.includes("/reader.html")||!headers.includes("X-Robots-Tag: noindex, nofollow, noarchive"))fail("Reader shell must be noindex/nofollow/noarchive");
  if(!roadmap.includes("5. Bulk-download throttling | ✅ Done"))fail("Milestone 5 must remain recorded as complete");
  if(!roadmap.includes("6. Bot and crawler controls | ✅ Done"))fail("Milestone 6 must be recorded as complete after Milestone 9 acceptance");
  for(const marker of ["pages.dev","Bot Fight Mode","AI Crawl Control","AI Labyrinth","optional future hardening"]){if(!guide.includes(marker))fail(`Milestone 6 guide is missing ${marker}`)}
}

checkClassifier();
await checkWiring();
if(failures.length){console.error(`Shadow Garden Milestone 6 check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);failures.forEach(message=>console.error(`- ${message}`));process.exitCode=1}
else console.log("Shadow Garden Milestone 6 crawler and automation policy checks passed.");
