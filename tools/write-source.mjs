import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd(),LIB=path.join(ROOT,'library'),DIST=path.join(ROOT,'dist');
const encodeKey=key=>String(key||'').split('/').map(encodeURIComponent).join('/');
const join=(base,key)=>`${String(base).replace(/\/$/,'')}/${encodeKey(key)}`;
let source={mode:'local',catalogUrl:'/data/catalog.json',adultCatalogUrl:'/data/adult-catalog.json'};
try{
  const cfg=JSON.parse(await fs.readFile(path.join(LIB,'b2.json'),'utf8'));
  if(cfg?.enabled){
    const base=cfg.proxyBaseUrl||cfg.publicBaseUrl;
    if(!base)throw new Error('library/b2.json is enabled but proxyBaseUrl is missing.');
    source={
      mode:cfg.private?'b2-private':'b2',
      provider:'backblaze-b2',
      catalogUrl:join(base,cfg.catalogKey||'shadow-garden/data/catalog.json'),
      adultCatalogUrl:join(base,cfg.adultCatalogKey||'shadow-garden/data/adult-catalog.json')
    };
  }
}catch(e){
  if(e?.code!=='ENOENT')throw e;
}
await fs.mkdir(path.join(DIST,'data'),{recursive:true});
await fs.writeFile(path.join(DIST,'data','source.json'),JSON.stringify(source,null,2));
console.log(`Catalog source: ${source.mode}`);
