/* Shadow Garden R3 — Series controller. Rendering and volume actions have single owners. */
(async()=>{
  const $=selector=>document.querySelector(selector);
  const root=document.getElementById("seriesRoot");
  if(!root)return;

  const id=new URLSearchParams(location.search).get("id")||"";
  const requestedAdult=window.__SG_SERIES_ROUTE_ADULT__===true||String(id).startsWith("adult-");
  let domain=null;
  let series=null;
  let rendering=false;

  function syncLibraryScope(adult){
    document.body.classList.toggle("adult-library",Boolean(adult));
    const home=$(".brand-home"),back=$("#headerBack"),adultNav=$(".adult-nav-link"),mainNav=$(".main-nav-link"),themeMeta=document.querySelector('meta[name="theme-color"]');
    if(home){home.href=domain.urls.libraryUrl(adult);home.setAttribute("aria-label",adult?"Shadow Garden Adult Library home":"Shadow Garden home")}
    if(back)back.href=domain.urls.libraryUrl(adult);
    if(adultNav){adultNav.classList.toggle("active",Boolean(adult));adult?adultNav.setAttribute("aria-current","page"):adultNav.removeAttribute("aria-current")}
    if(mainNav){mainNav.classList.toggle("active",!adult);!adult?mainNav.setAttribute("aria-current","page"):mainNav.removeAttribute("aria-current")}
    if(themeMeta)themeMeta.content=adult?"#10090c":"#09080d";
  }

  async function render(){
    if(!series||rendering)return;
    rendering=true;
    try{
      const {seriesMarkup}=await import("/assets/js/series-renderers.js");
      root.innerHTML=seriesMarkup(series,domain);
      root.setAttribute("aria-busy","false");
    }finally{rendering=false}
  }

  function bindControllerEvents(){
    root.addEventListener("click",event=>{
      const button=event.target.closest?.("#pinButton");
      if(!button||!series)return;
      const on=!domain.preferences.isPinned(series.id);
      domain.preferences.setPinned(series.id,on);
      button.classList.toggle("pinned",on);
      button.textContent=on?"◆ Pinned":"◇ Pin to Garden";
    });

    window.addEventListener(domain.readingState.EVENT,()=>void render());
    window.addEventListener("storage",event=>{
      if(domain.readingState.isReadingStorageKey(event.key)||event.key===domain.preferences.PINNED_KEY)void render();
    });
    window.addEventListener("pageshow",()=>void render());
  }

  try{
    domain=await import("/assets/js/domain/index.js");
    const {installVolumeActionController}=await import("/assets/js/public/volume-actions.js");
    installVolumeActionController(document);
    syncLibraryScope(requestedAdult);

    if(requestedAdult&&!domain.preferences.adultAcknowledged()){
      location.replace(domain.urls.adultGateReturnUrl(domain.urls.seriesUrl(id)));
      return;
    }
    if(!window.ShadowGardenData)throw new Error("Catalog data source is unavailable");
    const catalog=await window.ShadowGardenData.loadCatalog(requestedAdult);
    series=domain.catalog.seriesById(catalog,id);
    if(!series)throw new Error("Series not found");

    syncLibraryScope(Boolean(series.nsfw));
    document.title=`${series.title} — Shadow Garden`;
    bindControllerEvents();
    await render();
  }catch(error){
    console.error(error);
    if(!domain)domain=await import("/assets/js/domain/index.js");
    const {notFoundMarkup}=await import("/assets/js/series-renderers.js");
    root.innerHTML=notFoundMarkup(domain.urls.libraryUrl(requestedAdult),domain.format);
    root.setAttribute("aria-busy","false");
  }
})();
