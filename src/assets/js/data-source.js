window.ShadowGardenData=(()=>{
  let sourcePromise;
  async function getSource(){
    if(!sourcePromise){
      sourcePromise=fetch('/data/source.json',{cache:'no-store'})
        .then(r=>r.ok?r.json():{mode:'local'})
        .catch(()=>({mode:'local'}));
    }
    return sourcePromise;
  }
  async function catalogUrl(adult=false){
    const source=await getSource();
    if(source.mode==='b2'){
      const url=adult?source.adultCatalogUrl:source.catalogUrl;
      if(url)return url;
    }
    return adult?'/data/adult-catalog.json':'/data/catalog.json';
  }
  async function loadCatalog(adult=false){
    const url=await catalogUrl(adult);
    const r=await fetch(url,{cache:'no-store',mode:'cors'});
    if(!r.ok)throw new Error(`Catalog request failed: ${r.status}`);
    return r.json();
  }
  return{getSource,catalogUrl,loadCatalog};
})();
