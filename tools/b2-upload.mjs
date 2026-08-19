import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import {XMLParser} from 'fast-xml-parser';
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';

const ROOT=process.cwd(),LIB=path.join(ROOT,'library');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',removeNSPrefix:true,trimValues:true});
const arr=v=>v==null?[]:Array.isArray(v)?v:[v];
const txt=v=>typeof v==='string'||typeof v==='number'?String(v):v?.['#text']?String(v['#text']):'';
const slug=s=>String(s||'untitled').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'untitled';
const cleanHtml=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const metaList=md=>arr(md?.meta);
const metaByName=(md,name)=>metaList(md).find(m=>m?.['@_name']===name)?.['@_content']||'';
const metaByProperty=(md,prop)=>metaList(md).find(m=>m?.['@_property']===prop);

async function loadEnv(){
  const p=path.join(ROOT,'.env.b2');
  if(!fssync.existsSync(p))return;
  const raw=await fs.readFile(p,'utf8');
  for(const line of raw.split(/\r?\n/)){
    const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);if(!m)continue;
    let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
    if(process.env[m[1]]===undefined)process.env[m[1]]=v;
  }
}
async function loadJson(p,fallback=null){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return fallback}}
function volumeNo(title,file,md){
  const calibre=parseFloat(metaByName(md,'calibre:series_index'));if(Number.isFinite(calibre))return calibre;
  const gp=parseFloat(txt(metaByProperty(md,'group-position')));if(Number.isFinite(gp))return gp;
  const m=`${title} ${file}`.match(/\b(?:volume|vol|book)\s*\.?\s*(\d+(?:\.\d+)?)/i);return m?parseFloat(m[1]):9999;
}
function inferSeries(title){return String(title||'Untitled').replace(/\s*(?:[-–—:]\s*)?(?:volume|vol|book)\s*\.?\s*\d+(?:\.\d+)?(?:\b.*)?$/i,'').trim()||title}
function getSeries(md,title,parent=''){const c=metaByName(md,'calibre:series');if(c)return c;const x=metaByProperty(md,'belongs-to-collection');if(x&&txt(x))return txt(x);return parent||inferSeries(title)}
function contentType(ext){return ({'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif'})[ext.toLowerCase()]||'application/octet-stream'}
function encodeKey(key){return key.split('/').map(encodeURIComponent).join('/')}
function deliveryBase(config){return config.proxyBaseUrl||config.publicBaseUrl||''}
function deliveryUrl(config,key){return `${String(deliveryBase(config)).replace(/\/$/,'')}/${encodeKey(key)}`}

async function parseEpub(file,forcedSeries=''){
  const data=await fs.readFile(file),zip=await JSZip.loadAsync(data);
  const container=parser.parse(await zip.file('META-INF/container.xml').async('string'));
  const rootfile=arr(container?.container?.rootfiles?.rootfile)[0]?.['@_full-path'];
  if(!rootfile||!zip.file(rootfile))throw new Error('Missing OPF package');
  const pkg=parser.parse(await zip.file(rootfile).async('string')).package||{},md=pkg.metadata||{},manifest=arr(pkg.manifest?.item),opfDir=path.posix.dirname(rootfile);
  const title=txt(arr(md.title)[0])||path.basename(file,path.extname(file));
  const author=txt(arr(md.creator)[0])||'',language=txt(arr(md.language)[0])||'',date=txt(arr(md.date)[0])||'',description=cleanHtml(txt(arr(md.description)[0])),publisher=txt(arr(md.publisher)[0])||'';
  const tags=[...new Set(arr(md.subject).map(txt).map(x=>x.trim()).filter(Boolean))];
  const series=forcedSeries||getSeries(md,title,''),number=volumeNo(title,path.basename(file),md);
  let coverItem=manifest.find(i=>String(i?.['@_properties']||'').split(/\s+/).includes('cover-image'));
  if(!coverItem){const cid=metaByName(md,'cover');if(cid)coverItem=manifest.find(i=>i?.['@_id']===cid)}
  let coverData=null,coverExt='.jpg';
  if(coverItem?.['@_href']){const raw=decodeURIComponent(String(coverItem['@_href']).split('#')[0]),coverPath=path.posix.normalize(path.posix.join(opfDir,raw)),zf=zip.file(coverPath);if(zf){coverData=await zf.async('nodebuffer');coverExt=path.extname(raw)||'.jpg'}}
  return{data,size:data.length,title,author,language,date,description,publisher,tags,series,number,coverData,coverExt};
}

async function bodyText(body){if(!body)return'';if(typeof body.transformToString==='function')return body.transformToString();const parts=[];for await(const p of body)parts.push(p);return Buffer.concat(parts).toString('utf8')}
async function getCatalog(s3,bucket,key){try{const r=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}));return JSON.parse(await bodyText(r.Body))}catch(e){if(e?.$metadata?.httpStatusCode===404||e?.name==='NoSuchKey')return{generatedAt:new Date().toISOString(),series:[]};throw e}}
async function putJson(s3,bucket,key,obj){await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:Buffer.from(JSON.stringify(obj,null,2)),ContentType:'application/json; charset=utf-8',CacheControl:'no-cache, no-store, max-age=0'}))}

await loadEnv();
const config=await loadJson(path.join(LIB,'b2.json'));
if(!config)throw new Error('Create library/b2.json from library/b2.example.json first.');
if(!config.bucket||!config.endpoint||!deliveryBase(config))throw new Error('b2.json needs bucket, endpoint, and proxyBaseUrl.');
const keyId=process.env.B2_KEY_ID,appKey=process.env.B2_APPLICATION_KEY;
if(!keyId||!appKey)throw new Error('Set B2_KEY_ID and B2_APPLICATION_KEY in .env.b2 or your environment.');
const argv=process.argv.slice(2),adult=argv.includes('--adult'),forcedSeries=(argv.find(x=>x.startsWith('--series='))||'').slice(9),files=argv.filter(x=>!x.startsWith('--'));
if(!files.length)throw new Error('Usage: npm run b2:upload -- [--adult] [--series="Series Name"] file1.epub [file2.epub ...]');
const s3=new S3Client({endpoint:config.endpoint,region:config.region||'us-east-1',credentials:{accessKeyId:keyId,secretAccessKey:appKey}});
const catalogKey=config.catalogKey||'shadow-garden/data/catalog.json',adultCatalogKey=config.adultCatalogKey||'shadow-garden/data/adult-catalog.json';
const main=await getCatalog(s3,config.bucket,catalogKey),restricted=await getCatalog(s3,config.bucket,adultCatalogKey),target=adult?restricted:main;
target.series=arr(target.series);
const overrides=await loadJson(path.join(LIB,'series-overrides.json'),{});

for(const input of files){
  const file=path.resolve(input);if(path.extname(file).toLowerCase()!=='.epub')throw new Error(`${input} is not an EPUB file.`);
  const v=await parseEpub(file,forcedSeries),baseSlug=slug(v.series),sid=`${adult?'adult-':''}${baseSlug}`,seriesOverride=overrides[v.series]||overrides[baseSlug]||{};
  const epubName=`${slug(path.basename(file,path.extname(file)))}.epub`,epubKey=`shadow-garden/books/${sid}/${epubName}`;
  await s3.send(new PutObjectCommand({Bucket:config.bucket,Key:epubKey,Body:v.data,ContentType:'application/epub+zip',ContentDisposition:`attachment; filename="${epubName}"`}));
  let cover='';
  if(v.coverData){const hash=crypto.createHash('sha1').update(v.coverData).digest('hex').slice(0,8),coverName=`${sid}-${String(v.number===9999?'x':v.number).replace('.','-')}-${hash}${v.coverExt.toLowerCase()}`,coverKey=`shadow-garden/covers/${coverName}`;await s3.send(new PutObjectCommand({Bucket:config.bucket,Key:coverKey,Body:v.coverData,ContentType:contentType(v.coverExt),CacheControl:'public, max-age=31536000, immutable'}));cover=deliveryUrl(config,coverKey)}
  const volume={title:v.title,number:v.number,file:deliveryUrl(config,epubKey),cover,author:v.author,language:v.language,date:v.date,size:v.size,added:new Date().toISOString().slice(0,10),publisher:v.publisher,description:v.description};
  let series=target.series.find(s=>s.id===sid);
  if(!series){series={id:sid,title:seriesOverride.title||v.series,author:seriesOverride.author||v.author||'',year:seriesOverride.year||parseInt(String(v.date).slice(0,4))||'',status:seriesOverride.status||'',description:seriesOverride.description||v.description||'',tags:[...new Set([...v.tags,...arr(seriesOverride.tags)])],cover:seriesOverride.cover||cover,nsfw:adult,volumes:[]};target.series.push(series)}
  const ix=series.volumes.findIndex(x=>(Number.isFinite(v.number)&&v.number!==9999&&x.number===v.number)||x.title===v.title);
  if(ix>=0)series.volumes[ix]=volume;else series.volumes.push(volume);
  series.volumes.sort((a,b)=>(a.number??9999)-(b.number??9999)||String(a.title).localeCompare(String(b.title)));
  if(!series.cover&&cover)series.cover=cover;
  console.log(`Uploaded ${v.title} -> ${volume.file}`);
}
for(const cat of[main,restricted]){cat.generatedAt=new Date().toISOString();cat.series=arr(cat.series).sort((a,b)=>String(a.title).localeCompare(String(b.title)))}
await putJson(s3,config.bucket,catalogKey,main);await putJson(s3,config.bucket,adultCatalogKey,restricted);
console.log(`Catalog updated: ${main.series.length} main series, ${restricted.series.length} adult series.`);
