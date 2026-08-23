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

  const blocked=[
    ["GPTBot/1.2","ai_crawler"],
    ["ClaudeBot/1.0","ai_crawler"],
    ["curl/8.8.0","script_client"],
    ["python-requests/2.32","script_client"],
    ["Mozilla/5.0 HeadlessChrome/151.0 Safari/537.36","script_client"]
  ];
  for(const [userAgent,category] of blocked){
    const result=classifyAutomatedClient(userAgent);
    if(!result.blocked||result.category!==category)fail(`${userAgent} should be blocked as ${category}`);
  }
  if(!classifyAutomatedClient("").blocked)fail("missing User-Agent should be denied on protected acquisition endpoints");
}

async function checkWiring(){
  const [bookAccess,humanAccess,media,robots,headers,roadmap,guide]=await Promise.all([
    read("functions/book-access.js"),
    read("functions/human-access.js"),
    read("functions/media/[[path]].js"),
    read("src/robots.txt"),
    read("src/_headers"),
    read("SECURITY_ROADMAP.md"),
    read("MILESTONE_6_CRAWLER_POLICY.md")
  ]);

  for(const [name,source] of [["book-access",bookAccess],["human-access",humanAccess]]){
    for(const marker of ["classifyAutomatedClient","automated_access_denied","X-SG-Automation-Policy"]){
      if(!source.includes(marker))fail(`${name} is missing Milestone 6 marker ${marker}`);
    }
  }

  const classifierPos=bookAccess.indexOf("const automation = classifyAutomatedClient");
  const humanPos=bookAccess.indexOf("const human = humanAccessConfig");
  const resolverPos=bookAccess.indexOf("const resolved = await resolveBookReference");
  if(classifierPos<0||humanPos<0||resolverPos<0||classifierPos>humanPos||classifierPos>resolverPos){
    fail("book-access automation screening must run before human-session and catalog resolution work");
  }

  if(media.includes("crawler-policy")||media.includes("classifyAutomatedClient")){
    fail("crawler User-Agent policy must stay out of the EPUB media/Range proxy");
  }

  for(const marker of ["Disallow: /media/","Disallow: /reader.html","Disallow: /book-access","User-agent: GPTBot","User-agent: ClaudeBot","User-agent: Google-Extended"]){
    if(!robots.includes(marker))fail(`robots.txt is missing ${marker}`);
  }
  if(!headers.includes("/reader.html")||!headers.includes("X-Robots-Tag: noindex, nofollow, noarchive")){
    fail("Reader shell must be noindex/nofollow/noarchive");
  }

  if(!roadmap.includes("5. Bulk-download throttling | ✅ Done"))fail("Milestone 5 must be recorded as complete before Milestone 6");
  if(!roadmap.includes("6. Bot and crawler controls | 🟨 In progress"))fail("Milestone 6 must be recorded as in progress");
  for(const marker of ["pages.dev","Bot Fight Mode","AI Crawl Control","AI Labyrinth","optional future hardening"]){
    if(!guide.includes(marker))fail(`Milestone 6 guide is missing ${marker}`);
  }
}

checkClassifier();
await checkWiring();
if(failures.length){
  console.error(`Shadow Garden Milestone 6 check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden Milestone 6 crawler and automation policy checks passed.");
}
