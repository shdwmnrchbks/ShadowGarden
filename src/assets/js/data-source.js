window.ShadowGardenData=(()=>{
  let sourcePromise;
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
    const series=(Array.isArray(value.series)?value.series:[]).map(item=>({
      ...item,
      volumes:(Array.isArray(item?.volumes)?item.volumes:[]).map(volume=>{
        const bookId=String(volume?.bookId||'');
        if(/^bk_[A-Za-z0-9_-]{22}$/.test(bookId)){
          bookIds.push(bookId);
          return {...volume,file:bookId};
        }
        return volume;
      })
    }));
    if(bookIds.length&&window.ShadowGardenBookAccess?.migrateLegacyState){
      try{await window.ShadowGardenBookAccess.migrateLegacyState(bookIds)}catch(error){console.warn('Legacy reading-state migration skipped',error)}
    }
    return {...value,series};
  }
  async function loadCatalog(adult=false){
    const url=await catalogUrl(adult);
    const r=await fetch(url,{cache:'default',mode:'cors'});
    if(!r.ok)throw new Error(`Catalog request failed: ${r.status}`);
    return normalizeCatalog(await r.json());
  }
  return{getSource,catalogUrl,loadCatalog};
})();
