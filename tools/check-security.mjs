import fs from "node:fs/promises";
import path from "node:path";
import {
  issueMediaTicket,
  normalizeBookPath,
  ticketCookie,
  verifyMediaTicket,
  verifyMediaTicketCookie
} from "../functions/_lib/media-ticket.js";

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

async function checkWiring(){
  const [routesText,reader,series,client,bootstrap,endpoint,media]=await Promise.all([
    read("src/_routes.json"),read("src/reader.html"),read("src/series.html"),read("src/assets/js/book-access.js"),
    read("src/assets/js/reader-bootstrap.js"),read("functions/book-access.js"),read("functions/media/[[path]].js")
  ]);
  const routes=JSON.parse(routesText);
  if(!routes.include?.includes("/book-access"))fail("_routes.json must route /book-access through Pages Functions");

  const bookAccessPos=reader.indexOf("/assets/js/book-access.js");
  const visualCachePos=reader.indexOf("/assets/js/reader-visual-cache.js");
  const bootstrapPos=reader.indexOf("/assets/js/reader-bootstrap.js");
  if(bookAccessPos<0||visualCachePos<0||bookAccessPos>visualCachePos)fail("Reader must load book-access.js before the Visual Page Cache");
  if(bootstrapPos<0||reader.includes('type="module" src="/assets/js/reader.js'))fail("Reader shell must start through reader-bootstrap.js, not reader.js directly");
  if(!series.includes("/assets/js/book-access.js"))fail("Series page must load book-access.js for direct EPUB downloads");

  for(const marker of ["ShadowGardenBookAccess","/book-access","a[download]","ticketing_not_configured","renewalTimer"]){
    if(!client.includes(marker))fail(`book-access.js is missing ${marker}`);
  }
  for(const marker of ["await access.initial",'import("/assets/js/reader.js?v=1.5.0")'])if(!bootstrap.includes(marker))fail(`reader-bootstrap.js is missing ${marker}`);
  for(const marker of ["issueMediaTicket","ticketCookie","Set-Cookie","SG_MEDIA_SIGNING_SECRET","ticketing_not_configured"]){
    if(!endpoint.includes(marker))fail(`book-access endpoint is missing ${marker}`);
  }
  for(const marker of ["verifyMediaTicket","verifyMediaTicketCookie","canonicalMediaCacheUrl","X-SG-Media-Ticketing"]){
    if(!media.includes(marker))fail(`media ticket enforcement is missing ${marker}`);
  }
}

await checkTicketCrypto();
await checkWiring();
if(failures.length){
  console.error(`Shadow Garden security check failed with ${failures.length} problem${failures.length===1?"":"s"}:`);
  failures.forEach(message=>console.error(`- ${message}`));
  process.exitCode=1;
}else{
  console.log("Shadow Garden signed-media security checks passed.");
}
