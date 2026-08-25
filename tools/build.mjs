import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { stampAssetVersions } from "./lib/asset-versioning.mjs";
import { loadBuildContext } from "./lib/build-context.mjs";

const ROOT=process.cwd(), SRC=path.join(ROOT,"src"), LIB=path.join(ROOT,"library"), DIST=path.join(ROOT,"dist");
const buildContext=await loadBuildContext();
const ASSET_VERSION=buildContext.version;
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",removeNSPrefix:true,trimValues:true});
const arr=v=>v==null?[]:Array.isArray(v)?v:[v];
const txt=v=>typeof v==="string"||typeof v==="number"?String(v):v?.["#text"]?String(v["#text"]):"";
const slug=s=>String(s||"untitled").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"untitled";
const cleanHtml=s=>String(s||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
const posix=path.posix;
function metaList(md){return arr(md?.meta)}
function metaByName(md,name){return metaList(md).find(m=>m?.["@_name"]===name)?.["@_content"]||""}
function metaByProperty(md,prop){return metaList(md).find(m=>m?.["@_property"]===prop)}
function volumeNo(title,file,md){
  const calibre=parseFloat(metaByName(md,"calibre:series_index")); if(Number.isFinite(calibre))return calibre;
  const gp=metaByProperty(md,"group-position"); const gpn=parseFloat(txt(gp)); if(Number.isFinite(gpn))return gpn;
  const m=`${title} ${file}`.match(/\b(?:volume|vol|book)\s*\.?\s*(\d+(?:\.\d+)?)/i); if(m)return parseFloat(m[1]);
  return 9999;
}
function inferSeries(title){
  return String(title||"Untitled").replace(/\s*(?:[-–—:]\s*)?(?:volume|vol|book)\s*\.?\s*\d+(?:\.\d+)?(?:\b.*)?$/i,"").trim()||title;
}
function addedDate(file,fallback=""){
  try{
    const rel=path.relative(ROOT,file).replaceAll(path.sep,"/");
    const out=execFileSync("git",["log","-1","--format=%cs","--",rel],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();
    if(out)return out;
  }catch{}
  return String(fallback||"").slice(0,10);
}
function getSeries(md,title,parent){
  const calibre=metaByName(md,"calibre:series"); if(calibre)return calibre;
  const coll=metaByProperty(md,"belongs-to-collection"); if(coll&&txt(coll))return txt(coll);
  if(parent&&parent!==".")return parent.split(/[\\/]/).filter(Boolean).pop();
  return inferSeries(title);
}
async function walk(dir){
  if(!fssync.existsSync(dir))return[];
  const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else if(e.isFile()&&e.name.toLowerCase().endsWith(".epub"))out.push(p)}return out;
}
async function parseEpub(file){
  const data=await fs.readFile(file),zip=await JSZip.loadAsync(data);
  const container=parser.parse(await zip.file("META-INF/container.xml").async("string"));
  const rootfile=arr(container?.container?.rootfiles?.rootfile)[0]?.["@_full-path"];
  if(!rootfile||!zip.file(rootfile))throw new Error("Missing OPF package");
  const pkg=parser.parse(await zip.file(rootfile).async("string")).package||{};
  const md=pkg.metadata||{}, manifest=arr(pkg.manifest?.item), opfDir=posix.dirname(rootfile);
  const title=txt(arr(md.title)[0])||path.basename(file,path.extname(file));
  const author=txt(arr(md.creator)[0])||"";
  const language=txt(arr(md.language)[0])||"";
  const date=txt(arr(md.date)[0])||"";
  const description=cleanHtml(txt(arr(md.description)[0]));
  const publisher=txt(arr(md.publisher)[0])||"";
  const tags=[...new Set(arr(md.subject).map(txt).map(x=>x.trim()).filter(Boolean))];
  const relative=path.relative(LIB,file);
  const pathParts=relative.split(path.sep).filter(Boolean);
  const folderNsfw=pathParts.some(part=>part.toLowerCase()==="nsfw");
  const parent=path.relative(LIB,path.dirname(file));
  const series=getSeries(md,title,parent);
  const number=volumeNo(title,path.basename(file),md);
  let coverItem=manifest.find(i=>String(i?.["@_properties"]||"").split(/\s+/).includes("cover-image"));
  if(!coverItem){const cid=metaByName(md,"cover");if(cid)coverItem=manifest.find(i=>i?.["@_id"]===cid)}
  let coverData=null,coverExt=".jpg";
  if(coverItem?.["@_href"]){
    const raw=decodeURIComponent(String(coverItem["@_href"]).split("#")[0]);
    const coverPath=posix.normalize(posix.join(opfDir,raw)),zf=zip.file(coverPath);
    if(zf){coverData=await zf.async("nodebuffer");coverExt=path.extname(raw)||({"image/png":".png","image/webp":".webp","image/avif":".avif"}[coverItem["@_media-type"]]||".jpg")}
  }
  return {source:file,size:data.length,title,author,language,date,description,publisher,tags,series,number,coverData,coverExt,nsfw:folderNsfw};
}
async function copyTree(src,dst){await fs.mkdir(dst,{recursive:true});for(const e of await fs.readdir(src,{withFileTypes:true})){const a=path.join(src,e.name),b=path.join(dst,e.name);e.isDirectory()?await copyTree(a,b):await fs.copyFile(a,b)}}
async function loadOverrides(){try{return JSON.parse(await fs.readFile(path.join(LIB,"series-overrides.json"),"utf8"))}catch{return{}}}

await fs.rm(DIST,{recursive:true,force:true});await copyTree(SRC,DIST);
const stampedAssets=await stampAssetVersions(DIST,ASSET_VERSION);
console.log(`Stamped ${stampedAssets} copied source file${stampedAssets===1?"":"s"} with asset version ${ASSET_VERSION}.`);
await fs.mkdir(path.join(DIST,"assets","vendor"),{recursive:true});
await fs.copyFile(path.join(ROOT,"node_modules","epubjs","dist","epub.min.js"),path.join(DIST,"assets","vendor","epub.min.js"));
await fs.copyFile(path.join(ROOT,"node_modules","jszip","dist","jszip.min.js"),path.join(DIST,"assets","vendor","jszip.min.js"));
await fs.mkdir(path.join(DIST,"data"),{recursive:true});await fs.mkdir(path.join(DIST,"covers"),{recursive:true});await fs.mkdir(path.join(DIST,"books"),{recursive:true});

const overrides=await loadOverrides(),epubs=await walk(LIB),parsed=[];
for(const file of epubs){try{parsed.push(await parseEpub(file));console.log("Indexed",path.relative(LIB,file))}catch(e){console.warn("Skipped",path.relative(LIB,file),"-",e.message)}}
const groups=new Map();
for(const v of parsed){const key=`${v.nsfw?"nsfw":"main"}::${v.series}`;if(!groups.has(key))groups.set(key,{seriesName:v.series,folderNsfw:v.nsfw,volumes:[]});groups.get(key).volumes.push(v)}
const catalog=[];
for(const {seriesName,folderNsfw,volumes:vols0} of groups.values()){
  const baseSlug=slug(seriesName),seriesOverride=overrides[seriesName]||overrides[baseSlug]||{};
  const isNsfw=seriesOverride.nsfw===undefined?folderNsfw:Boolean(seriesOverride.nsfw);
  const sid=`${isNsfw?"adult-":""}${baseSlug}`;
  const vols=[...vols0].sort((a,b)=>a.number-b.number||a.title.localeCompare(b.title));
  const outDir=path.join(DIST,"books",sid);await fs.mkdir(outDir,{recursive:true});
  const outVolumes=[];
  for(let i=0;i<vols.length;i++){
    const v=vols[i],base=slug(path.basename(v.source,path.extname(v.source)))||`volume-${i+1}`,epubName=`${base}.epub`,dest=path.join(outDir,epubName);
    await fs.copyFile(v.source,dest);
    let coverUrl="";
    if(v.coverData){
      const hash=crypto.createHash("sha1").update(v.coverData).digest("hex").slice(0,8),name=`${sid}-${String(i+1).padStart(2,"0")}-${hash}${v.coverExt.toLowerCase()}`;
      await fs.writeFile(path.join(DIST,"covers",name),v.coverData);coverUrl=`/covers/${name}`;
    }
    outVolumes.push({title:v.title,number:v.number===9999?i+1:v.number,file:`/books/${sid}/${epubName}`,cover:coverUrl,author:v.author,language:v.language,date:v.date,size:v.size,added:addedDate(v.source,v.date),publisher:v.publisher,description:v.description});
  }
  const first=vols[0],years=vols.map(v=>parseInt(String(v.date).slice(0,4))).filter(Number.isFinite);
  const tags=[...new Set([...vols.flatMap(v=>v.tags),...arr(seriesOverride.tags)])];
  catalog.push({id:sid,title:seriesOverride.title||seriesName,author:seriesOverride.author||first.author||"",year:seriesOverride.year||((years.length&&Math.min(...years))||""),status:seriesOverride.status||"",description:seriesOverride.description||first.description||"",tags,cover:seriesOverride.cover||outVolumes.find(v=>v.cover)?.cover||"",nsfw:isNsfw,volumes:outVolumes});
}
catalog.sort((a,b)=>a.title.localeCompare(b.title));
const mainCatalog=catalog.filter(s=>!s.nsfw),adultCatalog=catalog.filter(s=>s.nsfw),generatedAt=buildContext.builtAt;
await fs.writeFile(path.join(DIST,"data","catalog.json"),JSON.stringify({generatedAt,series:mainCatalog},null,2));
await fs.writeFile(path.join(DIST,"data","adult-catalog.json"),JSON.stringify({generatedAt,series:adultCatalog},null,2));
console.log(`Built Shadow Garden: ${mainCatalog.length} main series, ${adultCatalog.length} adult series, ${catalog.reduce((n,s)=>n+s.volumes.length,0)} volumes.`);
