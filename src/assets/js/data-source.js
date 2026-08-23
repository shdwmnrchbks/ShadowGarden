window.ShadowGardenData=(()=>{
  let sourcePromise;
  const encoder=new TextEncoder();
  const BOOK_ID=/^bk_[A-Za-z0-9_-]{22}$/;
  const LEGACY_BOOK=/^\/media\/shadow-garden\/books\/.+\.epub$/i;
  const STATUS_ALIASES=new Map([
    ['complete','Complete'],['completed','Complete'],['finished','Complete'],
    ['ongoing','Ongoing'],['publishing','Ongoing'],['active','Ongoing'],['current','Ongoing'],
    ['hiatus','Hiatus'],['on hiatus','Hiatus'],['paused','Hiatus'],
    ['dropped','Dropped'],['cancelled','Dropped'],['canceled','Dropped'],['discontinued','Dropped']
  ]);
  const STATUS_TAG_KEYS=new Set([...STATUS_ALIASES.keys(),'complete','ongoing','hiatus','dropped']);
  function normalizeStatus(value){return STATUS_ALIASES.get(String(value||'').trim().toLowerCase())||'Ongoing'}
  function ensureCurrentPublicPolish(){
    const current=document.querySelector('link[href*="/assets/css/site-v1.9.4.css"]');
    if(!current||document.querySelector('link[data-sg-public-polish="1"]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/css/site-v1.9.4.css?v=1.10.5';
    link.dataset.sgPublicPolish='1';
    document.head.appendChild(link);
  }
  ensureCurrentPublicPolish();
  function base64Url(bytes){
    let binary='';
    for(const value of bytes)binary+=String.fromCharCode(value);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
  }
  async function bookIdForLegacyPath(value){
    let path='';
    try{const url=new URL(String(value||''),location.href);if(url.origin===location.origin&&LEGACY_BOOK.test(url.pathname))path=url.pathname}catch{}
    if(!path)return'';
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(`shadow-garden-book-id-v1\n${path}`)));
    return `bk_${base64Url(digest.slice(0,16))}`;
  }
  async function migrateLegacyStateFallback(bookIds){
    const wanted=new Set(bookIds.filter(id=>BOOK_ID.test(id)));
    if(!wanted.size)return;
    const keys=[];
    for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
    for(const key of keys){
      if(!key?.startsWith('sg-progress:'))continue;
      const oldIdentity=key.slice('sg-progress:'.length);
      if(!LEGACY_BOOK.test(oldIdentity))continue;
      const bookId=await bookIdForLegacyPath(oldIdentity);
      if(!wanted.has(bookId))continue;
      const raw=localStorage.getItem(key);if(raw===null)continue;
      const nextKey=`sg-progress:${bookId}`;
      try{
        const oldValue=JSON.parse(raw),current=JSON.parse(localStorage.getItem(nextKey)||'null');
        const oldUpdated=Number(oldValue?.updatedAt)||0,currentUpdated=Number(current?.updatedAt)||0;
        if(!current||oldUpdated>currentUpdated){
          if(oldValue&&typeof oldValue==='object')oldValue.file=bookId;
          localStorage.setItem(nextKey,JSON.stringify(oldValue));
        }
      }catch{if(localStorage.getItem(nextKey)===null)localStorage.setItem(nextKey,raw)}
    }
  }
  async function getSource(){
    if(!sourcePromise){
      sourcePromise=fetch('/data/source.json',{cache:'default'})
        .then(r=>r.ok?r.json():{mode:'local'})
        .catch(()=>({mode:'local'}));
    }
    return sourcePromise;
  }
  async function catalogUrl(adult=false){
    const source=await getSource();
    if(source.mode==='b2'||source.mode==='b2-private'){
      const url=adult?source.adultCatalogUrl:source.catalogUrl;
      if(url)return url;
    }
    return adult?'/data/adult-catalog.json':'/data/catalog.json';
  }
  async function normalizeCatalog(catalog){
    const value=catalog&&typeof catalog==='object'?catalog:{};
    const bookIds=[];
    const series=(Array.isArray(value.series)?value.series:[]).map(item=>{
      const status=normalizeStatus(item?.status);
      const tags=[...new Set([...(Array.isArray(item?.tags)?item.tags:[]).map(String).filter(tag=>!STATUS_TAG_KEYS.has(String(tag).trim().toLowerCase())),status])];
      return {
        ...item,
        status,
        tags,
        volumes:(Array.isArray(item?.volumes)?item.volumes:[]).map(volume=>{
          const bookId=String(volume?.bookId||'');
          if(BOOK_ID.test(bookId)){
            bookIds.push(bookId);
            return {...volume,file:bookId};
          }
          return volume;
        })
      };
    });
    if(bookIds.length){
      try{
        if(window.ShadowGardenBookAccess?.migrateLegacyState)await window.ShadowGardenBookAccess.migrateLegacyState(bookIds);
        else await migrateLegacyStateFallback(bookIds);
      }catch(error){console.warn('Legacy reading-state migration skipped',error)}
    }
    return {...value,series};
  }
  async function loadCatalog(adult=false){
    const url=await catalogUrl(adult);
    const r=await fetch(url,{cache:'default',mode:'cors'});
    if(!r.ok)throw new Error(`Catalog request failed: ${r.status}`);
    return normalizeCatalog(await r.json());
  }
  return{getSource,catalogUrl,loadCatalog,normalizeStatus,statuses:['Complete','Ongoing','Hiatus','Dropped']};
})();
