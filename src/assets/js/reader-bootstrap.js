/* Shadow Garden R2 — protected Reader startup handoff. */
(async()=>{
  const access=window.ShadowGardenBookAccess;
  const publicSearch=location.search;
  const publicParams=new URLSearchParams(publicSearch);
  const requested=publicParams.get("book")||"";
  const seriesId=publicParams.get("series")||"";
  const restartRequested=publicParams.get("restart")==="1";
  const domain=await import("/assets/js/domain/index.js");
  const {identity,preferences,readingState,storage,catalog}=domain;
  const EPUB_PATH=/^\/media\/shadow-garden\/books\/.+\.epub$/i;

  window.__sgReaderPublicBookId=identity.isBookId(requested)?requested:"";
  window.__sgReaderSourcePath="";

  function syncStoredTheme(){
    const body=document.body;
    if(!body)return;
    const settings=storage.readJson("sg-reader-settings",{})||{};
    const theme=["garden","night","black","paper"].includes(settings.theme)?settings.theme:"garden";
    body.classList.remove("reader-theme-garden","reader-theme-night","reader-theme-black","reader-theme-paper","reader-flow-paginated","reader-flow-scrolled");
    body.classList.add(`reader-theme-${theme}`,settings.flow==="scrolled-doc"?"reader-flow-scrolled":"reader-flow-paginated");
    body.classList.toggle("adult-reader",catalog.isAdultSeriesId(seriesId));
  }

  async function importReader(){
    const originalEpub=window.ePub;
    if(typeof originalEpub!=="function")return import("/assets/js/reader.js");
    function capturedEpub(...args){
      const book=Reflect.apply(originalEpub,this,args);
      if(!window.__sgReaderBook)window.__sgReaderBook=book;
      return book;
    }
    try{
      capturedEpub.prototype=originalEpub.prototype;
      Object.setPrototypeOf(capturedEpub,originalEpub);
    }catch{}
    window.ePub=capturedEpub;
    try{return await import("/assets/js/reader.js")}
    finally{window.ePub=originalEpub}
  }

  async function mountReadingStatus(){
    await import("/assets/js/reading-status.js");
    await import("/assets/js/reader-finished.js");
  }

  function canonicalizeLegacyUrl(){
    const canonical=String(window.__sgReaderPublicBookId||"");
    if(!identity.isBookId(canonical)||requested===canonical)return;
    try{
      const url=new URL(location.href);
      url.searchParams.set("book",canonical);
      history.replaceState(history.state,"",`${url.pathname}${url.search}${url.hash}`);
    }catch{}
  }

  function clearRestartFlag(){
    if(!restartRequested)return;
    try{
      const url=new URL(location.href);
      url.searchParams.delete("restart");
      history.replaceState(history.state,"",`${url.pathname}${url.search}${url.hash}`);
    }catch{}
  }

  async function resetForReadAgain(ticket,sourcePath){
    if(!restartRequested)return;
    const canonical=String(ticket?.bookId||ticket?.identity||window.__sgReaderPublicBookId||"").trim();
    const identities=identity.cleanIdentities([
      requested,
      canonical,
      ticket?.requestedIdentity,
      sourcePath
    ]);

    try{
      const shelf=await window.ShadowGardenData?.loadCatalog?.(catalog.isAdultSeriesId(seriesId));
      const entry=catalog.findVolumeEntry(shelf,seriesId,canonical||requested,identities);
      const aliases=entry?readingState.volumeAliases(entry.series.id,entry.volume,entry.index,identities):identities;
      readingState.setAliasesFinished(aliases,false);
      readingState.clearProgressAliases(aliases);
    }catch(error){
      console.warn("Read Again state reset skipped",error);
      readingState.setAliasesFinished(identities,false);
      readingState.clearProgressAliases(identities);
    }
  }

  syncStoredTheme();

  try{
    if(identity.isBookId(requested)&&catalog.isAdultSeriesId(seriesId)&&!preferences.adultAcknowledged()){
      const ret=`${location.pathname}${location.search}${location.hash}`;
      location.replace(domain.urls.adultGateReturnUrl(ret));
      return;
    }

    const ticket=access?.initial?await access.initial:null;
    const ticketBookId=String(ticket?.bookId||ticket?.identity||"").trim();
    if(identity.isBookId(ticketBookId))window.__sgReaderPublicBookId=ticketBookId;
    if(ticket?.identity&&access?.migrateLegacyState)await access.migrateLegacyState([ticket.identity]);

    const sourcePath=String(ticket?.sourcePath||(()=>{try{return new URL(ticket?.url||"",location.href).pathname}catch{return""}})());
    window.__sgReaderSourcePath=EPUB_PATH.test(sourcePath)?sourcePath:"";
    await resetForReadAgain(ticket,sourcePath);

    if(identity.isBookId(requested)&&EPUB_PATH.test(sourcePath)){
      try{await window.__sgVisualPageCache?.prepare?.(requested)}catch(error){console.warn("Visual-page preparation handoff skipped",error)}

      const NativeURLSearchParams=window.URLSearchParams;
      function ReaderURLSearchParams(init){
        const params=new NativeURLSearchParams(init);
        if(String(init??"")===publicSearch&&params.get("book")===requested)params.set("book",sourcePath);
        return params;
      }
      ReaderURLSearchParams.prototype=NativeURLSearchParams.prototype;
      try{Object.setPrototypeOf(ReaderURLSearchParams,NativeURLSearchParams)}catch{}
      window.URLSearchParams=ReaderURLSearchParams;
      try{await importReader()}
      finally{window.URLSearchParams=NativeURLSearchParams}
      await mountReadingStatus();
      clearRestartFlag();
      return;
    }

    await importReader();
    canonicalizeLegacyUrl();
    await mountReadingStatus();
    clearRestartFlag();
  }catch(error){
    console.error("Reader book authorization failed",error);
    const loading=document.getElementById("readerLoading");
    if(loading){
      loading.classList.remove("hidden");
      loading.innerHTML=`<p>${String(error?.message||"Shadow Garden could not authorize this EPUB.").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</p>`;
    }
  }
})();
