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

const ROOT=process.cwd();
const failures=[];
const fail=message=>failures.push(message);
const read=relative=>fs.readFile(path.join(ROOT,relative),"utf8");

async function checkTicketCrypto(){
  const env={SG_MEDIA_SIGNING_SECRET:"shadow-garden-ci-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ"};
  const requestUrl="https://shadow.example/book-access";
  const book="/media/shadow-garden/books/example/volume.epub";
  const ticket=await issueMediaTicket(env,book,requestUrl,600);
  if(!ticket?.url?.includes("exp=")||!ticket.url.includes("sig="))fail("media ticket issuer must return exp and sig parameters");
  if(ticket?.path!==book)fail("media ticket issuer must preserve the stable EPUB path");

  const valid=await verifyMediaTicket(env,new URL(ticket.url,requestUrl).toString());
  if(!valid.valid)fail("fresh signed media ticket did not verify");

  const tampered=new URL(ticket.url,requestUrl);
  tampered.pathname="/media/shadow-garden/books/example/other.epub";
  if((await verifyMediaTicket(env,tampered.toString())).valid)fail("ticket signature must be bound to the EPUB path");

  const cookie=ticketCookie(ticket);
  for(const marker of ["HttpOnly","Secure","SameSite=Strict",`Path=${book}`])if(!cookie.includes(marker))fail(`ticket cookie is missing ${marker}`);
  if(!(await verifyMediaTicketCookie(env,new URL(book,requestUrl).toString(),cookie.split(";")[0])).valid)fail("path-scoped reader ticket cookie did not verify");

  if(normalizeBookPath("https://elsewhere.example/book.epub",requestUrl))fail("book access must reject cross-origin EPUB paths");
  if(normalizeBookPath("/media/not-shadow-garden/book.epub",requestUrl))fail("book access must reject EPUB paths outside the Shadow Garden namespace");
}

async function checkOpaqueBookIds(){
  const first="/media/shadow-garden/books/example/volume-01.epub";
  const second="/media/shadow-garden/books/example/volume-02.epub";
  const a=await bookIdForFile(first),again=await bookIdForFile(first),b=await bookIdForFile(second);
  if(!isBookId(a))fail("bookIdForFile must return an opaque bk_ identifier");
  if(a!==again)fail("book IDs must be deterministic for legacy catalog migration");
  if(a===b)fail("different EPUB paths must not share a book ID");
  if(await persistentVolumeBookId({file:first},second)!==a)fail("replacing a legacy EPUB must preserve the original derived book ID");
  if(await persistentVolumeBookId({file:first,bookId:a},second)!==a)fail("replacing an EPUB must preserve its persisted book ID");

  const publicView=await publicCatalogShape({generatedAt:"test",series:[{id:"example",volumes:[{
    title:"Volume 1",file:first,sha256:"a".repeat(64),originalFilename:"secret-name.epub"
  }]}]});
  const volume=publicView?.series?.[0]?.volumes?.[0]||{};
  if(!isBookId(volume.bookId))fail("public catalog volumes must expose bookId");
  if("file" in volume)fail("public catalog volumes must not expose EPUB file paths");
  if("sha256" in volume)fail("public catalog volumes must not expose private EPUB hashes");
  if("originalFilename" in volume)fail("public catalog volumes must not expose original EPUB filenames");
}

async function checkWiring(){
  const [routesText,reader,series,client,bootstrap,endpoint,media,mediaTicket,bookResolver,dataSource,headers]=await Promise.all([
    read("src/_routes.json"),read("src/reader.html"),read("src/series.html"),read("src/assets/js/book-access.js"),
    read("src/assets/js/reader-bootstrap.js"),read("functions/book-access.js"),read("functions/media/[[path]].js"),
    read("functions/_lib/media-ticket.js"),read("functions/_lib/book-resolver.js"),read("src/assets/js/data-source.js"),read("src/_headers")
  ]);
  const routes=JSON.parse(routesText);
  if(!routes.include?.includes("/book-access"))fail("_routes.json must route /book-access through Pages Functions");

  const bookAccessPos=reader.indexOf("/assets/js/book-access.js");
  const visualCachePos=reader.indexOf("/assets/js/reader-visual-cache.js");
  const bootstrapPos=reader.indexOf("/assets/js/reader-bootstrap.js");
  if(bookAccessPos<0||visualCachePos<0||bookAccessPos>visualCachePos)fail("Reader must load book-access.js before the Visual Page Cache");
  if(bootstrapPos<0||reader.includes('type="module" src="/assets/js/reader.js'))fail("Reader shell must start through reader-bootstrap.js, not reader.js directly");
  if(!series.includes("/assets/js/book-access.js"))fail("Series page must load book-access.js for direct EPUB downloads");

  for(const marker of ["ShadowGardenBookAccess","/book-access","a[download]","ticketing_not_configured","renewalTimer","ACCESS_TIMEOUT_MS","AbortController","sgBookAccessBypass","bookId","migrateLegacyState"]){
    if(!client.includes(marker))fail(`book-access.js is missing ${marker}`);
  }
  if(client.includes("const legacy=")||client.includes("protected:false"))fail("book-access.js must not fall back to an unsigned EPUB URL when ticketing is unavailable");
  const bypassAssignment=client.indexOf('link.dataset.sgBookAccessBypass="1"');
  const syntheticClick=client.indexOf("link.click()");
  const bypassGuard=client.indexOf('link.dataset.sgBookAccessBypass==="1"');
  if(bypassAssignment<0||syntheticClick<0||bypassAssignment>syntheticClick)fail("synthetic EPUB download links must be marked before click()");
  if(bypassGuard<0)fail("download interceptor must ignore internally authorized download links");

  for(const marker of ["await access.initial",'import("/assets/js/reader.js?v=1.9.0")',"history.replaceState","location.reload()","sourcePath"]){
    if(!bootstrap.includes(marker))fail(`reader-bootstrap.js is missing ${marker}`);
  }
  for(const marker of ["issueMediaTicket","ticketCookie","Set-Cookie","ticketing_not_configured","resolveBookReference","payload?.bookId","bookId: resolved.bookId"]){
    if(!endpoint.includes(marker))fail(`book-access endpoint is missing ${marker}`);
  }
  for(const marker of ["SG_MEDIA_SIGNING_SECRET","HMAC","SHA-256","sg-media-ticket-v1"]){
    if(!mediaTicket.includes(marker))fail(`media-ticket helper is missing ${marker}`);
  }
  for(const marker of ["verifyMediaTicket","verifyMediaTicketCookie","canonicalMediaCacheUrl","X-SG-Media-Ticketing","unavailableEpub","ticketingEnabled(env)","publicCatalogShape","X-SG-Catalog-View","opaque-v1","PUBLIC_COVER_KEY","PUBLIC_EPUB_KEY","publicMediaKey","privateObjectResponse","!key || !publicMediaKey(key)"]){
    if(!media.includes(marker))fail(`media security/catalog enforcement is missing ${marker}`);
  }
  if(media.includes('ticketingEnabled(env) && !(await authorizedEpub'))fail("EPUB delivery must fail closed rather than skip authorization when ticketing is unavailable");
  if(!media.includes('"shadow-garden/data/catalog.json"')||!media.includes('"shadow-garden/data/adult-catalog.json"'))fail("public media boundary must explicitly allow only the two public catalog JSON files");
  if(headers.indexOf("/assets/js/data-source.js")<0||!headers.includes("Cache-Control: no-store"))fail("changed public catalog adapter must be served no-store during opaque-ID rollout");

  for(const marker of ["resolveBookReference","byId","byFile","volumeBookId"]){
    if(!bookResolver.includes(marker))fail(`book resolver is missing ${marker}`);
  }
  if(bookResolver.includes("legacy: true"))fail("book resolver must not authorize arbitrary non-cataloged legacy EPUB paths");

  for(const marker of ["bookId","file:bookId","migrateLegacyState","shadow-garden-book-id-v1"]){
    if(!dataSource.includes(marker))fail(`public data adapter is missing ${marker}`);
  }
}

await checkTicketCrypto();
await checkOpaqueBookIds();
await checkWiring();
if(failures.length){
  console.error(`Shadow Garden security check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden signed-media, opaque-catalog, and private-media security checks passed.");
}
