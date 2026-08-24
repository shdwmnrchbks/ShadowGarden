import fs from "node:fs/promises";
import path from "node:path";
import {
  issueMediaTicket,
  normalizeBookPath,
  ticketCookie,
  verifyMediaTicket,
  verifyMediaTicketCookie
} from "../functions/_lib/media-ticket.js";
import {
  bookIdForFile,
  isBookId,
  persistentVolumeBookId,
  publicCatalogShape
} from "../functions/_lib/book-id.js";
import {
  HUMAN_ACCESS_ACTION,
  HUMAN_SESSION_TTL_SECONDS,
  humanAccessConfig,
  humanSessionCookie,
  issueHumanSession,
  verifyHumanSession
} from "../functions/_lib/human-session.js";

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");
const signing="shadow-garden-ci-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";

async function checkTickets(){
  const env={SG_MEDIA_SIGNING_SECRET:signing};
  const origin="https://shadow.example/book-access";
  const book="/media/shadow-garden/books/example/volume.epub";
  const ticket=await issueMediaTicket(env,book,origin,600);
  if(!ticket?.url?.includes("exp=")||!ticket.url.includes("sig="))fail("media ticket must contain exp and sig");
  if(!(await verifyMediaTicket(env,new URL(ticket.url,origin).toString())).valid)fail("fresh media ticket did not verify");
  const cookie=ticketCookie(ticket);
  for(const marker of ["HttpOnly","Secure","SameSite=Strict",`Path=${book}`])if(!cookie.includes(marker))fail(`media ticket cookie is missing ${marker}`);
  if(!(await verifyMediaTicketCookie(env,new URL(book,origin).toString(),cookie.split(";")[0])).valid)fail("media ticket cookie did not verify");
  if(normalizeBookPath("https://elsewhere.example/book.epub",origin))fail("cross-origin EPUB path must be rejected");
  if(normalizeBookPath("/media/not-shadow-garden/book.epub",origin))fail("out-of-namespace EPUB path must be rejected");
}

async function checkOpaqueIds(){
  const first="/media/shadow-garden/books/example/volume-01.epub";
  const second="/media/shadow-garden/books/example/volume-02.epub";
  const a=await bookIdForFile(first),b=await bookIdForFile(second);
  if(!isBookId(a)||!isBookId(b)||a===b)fail("opaque book IDs must be valid and path-distinct");
  if(await persistentVolumeBookId({file:first},second)!==a)fail("EPUB replacement must preserve a stable book ID");
  const publicView=await publicCatalogShape({generatedAt:"test",series:[{id:"example",volumes:[{title:"Volume 1",file:first,sha256:"a".repeat(64),originalFilename:"secret.epub"}]}]});
  const volume=publicView?.series?.[0]?.volumes?.[0]||{};
  if(!isBookId(volume.bookId))fail("public catalog volume must expose an opaque bookId");
  if("file" in volume||"sha256" in volume||"originalFilename" in volume)fail("public catalog must redact private EPUB fields");
}

async function checkHumanSessions(){
  const inactive=humanAccessConfig({SG_MEDIA_SIGNING_SECRET:signing});
  if(inactive.mode!=="inactive")fail("Turnstile must remain inactive when both Turnstile variables are absent");
  const partial=humanAccessConfig({SG_MEDIA_SIGNING_SECRET:signing,SG_TURNSTILE_SITE_KEY:"site-key"});
  if(partial.mode!=="misconfigured")fail("partial Turnstile configuration must fail closed");
  const env={SG_MEDIA_SIGNING_SECRET:signing,SG_TURNSTILE_SITE_KEY:"site-key",SG_TURNSTILE_SECRET_KEY:"secret-key"};
  if(humanAccessConfig(env).mode!=="active")fail("Turnstile must activate only with both keys");
  if(HUMAN_SESSION_TTL_SECONDS!==43200||HUMAN_ACCESS_ACTION!=="book_access")fail("human-session defaults changed unexpectedly");
  const session=await issueHumanSession(env,1_000_000);
  const cookie=humanSessionCookie(session);
  for(const marker of ["HttpOnly","Secure","SameSite=Strict","Path=/book-access","Max-Age=43200"]){
    if(!cookie.includes(marker))fail(`human access cookie is missing ${marker}`);
  }
  if(!(await verifyHumanSession(env,cookie,1_000_060)).valid)fail("fresh human session did not verify");
  if((await verifyHumanSession(env,cookie,session.expiresAt+1)).valid)fail("expired human session must not verify");
}

async function checkWiring(){
  const [routesText,reader,series,client,bootstrap,bookAccess,humanAccess,humanHelper,media,mediaTicket,resolver,dataSource,domainCatalog,domainIdentity,headers,robots]=await Promise.all([
    read("src/_routes.json"),
    read("src/reader.html"),
    read("src/series.html"),
    read("src/assets/js/book-access.js"),
    read("src/assets/js/reader-bootstrap.js"),
    read("functions/book-access.js"),
    read("functions/human-access.js"),
    read("functions/_lib/human-session.js"),
    read("functions/media/[[path]].js"),
    read("functions/_lib/media-ticket.js"),
    read("functions/_lib/book-resolver.js"),
    read("src/assets/js/data-source.js"),
    read("src/assets/js/domain/catalog.js"),
    read("src/assets/js/domain/book-identity.js"),
    read("src/_headers"),
    read("src/robots.txt")
  ]);
  const routes=JSON.parse(routesText);
  for(const route of ["/book-access","/human-access","/admin-access"]){if(!routes.include?.includes(route))fail(`_routes.json is missing ${route}`)}
  for(const marker of ["/book-access","/human-access","turnstile.render","bookId","migrateLegacyState","sourcePath"]){if(!client.includes(marker))fail(`book-access client is missing ${marker}`)}
  if(!reader.includes("/assets/js/book-access.js")||!reader.includes("/assets/js/reader-bootstrap.js"))fail("Reader security/bootstrap scripts are not wired");
  if(!series.includes("/assets/js/book-access.js"))fail("Series page must load book-access.js for protected downloads");
  if(!/import\(["']\/assets\/js\/reader\.js(?:\?v=\d+\.\d+\.\d+)?["']\)/.test(bootstrap))fail("Reader bootstrap must import reader.js through the local asset pipeline");
  for(const marker of ["issueMediaTicket","ticketCookie","resolveBookReference","verifyHumanSession","human_verification_required"]){if(!bookAccess.includes(marker))fail(`book-access endpoint is missing ${marker}`)}
  for(const marker of ["verifyTurnstileToken","issueHumanSession","humanSessionCookie"]){if(!humanAccess.includes(marker))fail(`human-access endpoint is missing ${marker}`)}
  for(const marker of ["SG_TURNSTILE_SITE_KEY","SG_TURNSTILE_SECRET_KEY","turnstile/v0/siteverify","result?.hostname","SameSite=Strict"]){if(!humanHelper.includes(marker))fail(`human-session helper is missing ${marker}`)}
  if(media.includes("Turnstile")||media.includes("sg_human_session"))fail("human verification must stay out of the media Range proxy");
  for(const marker of ["verifyMediaTicket","verifyMediaTicketCookie","ticketingEnabled(env)","publicCatalogShape"]){if(!media.includes(marker))fail(`media boundary is missing ${marker}`)}
  for(const marker of ["SG_MEDIA_SIGNING_SECRET","HMAC","SHA-256","sg-media-ticket-v1"]){if(!mediaTicket.includes(marker))fail(`media-ticket helper is missing ${marker}`)}
  for(const marker of ["resolveBookReference","byId","byFile"]){if(!resolver.includes(marker))fail(`book resolver is missing ${marker}`)}
  if(!dataSource.includes("domain.catalog.normalizeCatalog"))fail("public data adapter must delegate normalization to the R2 catalog domain");
  for(const marker of ["bookId","migrateLegacyState"]){if(!domainCatalog.includes(marker))fail(`catalog domain is missing ${marker}`)}
  for(const marker of ["shadow-garden-book-id-v1","BOOK_ID_PATTERN","bookIdForLegacyPath"]){if(!domainIdentity.includes(marker))fail(`book identity domain is missing ${marker}`)}
  if(!headers.includes("/reader.html")||!headers.includes("X-Robots-Tag: noindex, nofollow, noarchive"))fail("Reader noindex headers are missing");
  for(const marker of ["Disallow: /media/","Disallow: /admin-api/","Disallow: /book-access","Disallow: /human-access","Disallow: /admin-access"]){if(!robots.includes(marker))fail(`robots.txt is missing ${marker}`)}
}

await checkTickets();
await checkOpaqueIds();
await checkHumanSessions();
await checkWiring();
if(failures.length){
  console.error(`Shadow Garden core security check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden core signed-media, opaque-ID, human-session, and protected-route checks passed.");
}
