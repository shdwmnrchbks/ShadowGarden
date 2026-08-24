/* Shadow Garden Security Milestones 2–3 + v1.15.14 Reader startup handoff. */
(async()=>{
  const access=window.ShadowGardenBookAccess;
  const publicSearch=location.search;
  const publicParams=new URLSearchParams(publicSearch);
  const requested=publicParams.get("book")||"";
  const seriesId=publicParams.get("series")||"";
  const restartRequested=publicParams.get("restart")==="1";
  const BOOK_ID=/^bk_[A-Za-z0-9_-]{22}$/;
  const EPUB_PATH=/^\/media\/shadow-garden\/books\/.+\.epub$/i;

  window.__sgReaderPublicBookId=BOOK_ID.test(requested)?requested:"";
  window.__sgReaderSourcePath="";

  function syncStoredTheme(){
    const body=document.body;
    if(!body)return;
    let settings={};
    try{settings=JSON.parse(localStorage.getItem("sg-reader-settings")||"{}")||{}}catch{}
    const theme=["garden","night","black","paper"].includes(settings.theme)?settings.theme:"garden";
    body.classList.remove("reader-theme-garden","reader-theme-night","reader-theme-black","reader-theme-paper","reader-flow-paginated","reader-flow-scrolled");
    body.classList.add(`reader-theme-${theme}`,settings.flow==="scrolled-doc"?"reader-flow-scrolled":"reader-flow-paginated");
    body.classList.toggle("adult-reader",String(seriesId).startsWith("adult-"));
  }

  async function importReader(){
    const originalEpub=window.ePub;
    if(typeof originalEpub!=="function")return import("/assets/js/reader.js?v=1.15.14");
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
    try{return await import("/assets/js/reader.js?v=1.15.14")}
    finally{window.ePub=originalEpub}
  }

  async function mountReadingStatus(){
    await import("/assets/js/reading-status.js?v=1.15.14");
    await import("/assets/js/reader-finished.js?v=1.15.14");
  }

  function canonicalizeLegacyUrl(){
    const canonical=String(window.__sgReaderPublicBookId||"");
    if(!BOOK_ID.test(canonical)||requested===canonical)return;
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

  function installCanonicalReaderMirror(sourcePath){
    const canonical=String(window.__sgReaderPublicBookId||"").trim();
    if(!BOOK_ID.test(canonical)||!EPUB_PATH.test(sourcePath))return;
    const progressSource=`sg-progress:${sourcePath}`,progressPublic=`sg-progress:${canonical}`;
    const bookmarksSource=`sg-bookmarks:${sourcePath}`,bookmarksPublic=`sg-bookmarks:${canonical}`;

    const parse=raw=>{try{return JSON.parse(raw||"null")}catch{return null}};
    const progressRaw=(raw,file)=>{
      const value=parse(raw);
      if(!value||typeof value!=="object")return raw;
      value.file=file;
      return JSON.stringify(value);
    };
    const updated=raw=>Number(parse(raw)?.updatedAt)||0;
    const sync=()=>{
      try{
        const sourceRaw=localStorage.getItem(progressSource),publicRaw=localStorage.getItem(progressPublic);
        if(sourceRaw!==null||publicRaw!==null){
          if(sourceRaw===null&&publicRaw!==null)localStorage.setItem(progressSource,progressRaw(publicRaw,sourcePath));
          else if(publicRaw===null&&sourceRaw!==null)localStorage.setItem(progressPublic,progressRaw(sourceRaw,canonical));
          else if(updated(sourceRaw)>=updated(publicRaw))localStorage.setItem(progressPublic,progressRaw(sourceRaw,canonical));
          else localStorage.setItem(progressSource,progressRaw(publicRaw,sourcePath));
        }
        const sourceMarks=localStorage.getItem(bookmarksSource),publicMarks=localStorage.getItem(bookmarksPublic);
        if(sourceMarks!==null&&sourceMarks!==publicMarks)localStorage.setItem(bookmarksPublic,sourceMarks);
        else if(sourceMarks===null&&publicMarks!==null)localStorage.setItem(bookmarksSource,publicMarks);
      }catch(error){console.warn("Canonical Reader state mirror skipped",error)}
    };
    sync();
    const timer=setInterval(sync,500);
    window.addEventListener("pagehide",sync);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")sync()});
    window.__sgCanonicalReaderMirror={sourcePath,canonical,sync,stop:()=>clearInterval(timer)};
  }

  async function resetForReadAgain(ticket,sourcePath){
    if(!restartRequested)return;
    const canonical=String(ticket?.bookId||ticket?.identity||window.__sgReaderPublicBookId||"").trim();
    const identities=[
      requested,
      canonical,
      String(ticket?.requestedIdentity||"").trim(),
      String(sourcePath||"").trim()
    ].filter(Boolean);

    try{
      await import("/assets/js/reading-status.js?v=1.15.14");
      const reading=window.ShadowGardenReadingStatus;
      const aliases=new Set(identities);
      const adult=String(seriesId||"").startsWith("adult-");
      const catalog=await window.ShadowGardenData?.loadCatalog?.(adult);
      const series=(Array.isArray(catalog?.series)?catalog.series:[]).find(item=>String(item?.id||"")===String(seriesId||""));
      const volumes=Array.isArray(series?.volumes)?series.volumes:[];
      const index=volumes.findIndex(volume=>identities.includes(String(volume?.file||volume?.bookId||"")));
      if(series&&index>=0){
        const volume=volumes[index];
        for(const alias of reading?.volumeAliases?.(series.id,volume,index,identities)||[])aliases.add(alias);
      }
      const all=[...aliases].filter(Boolean);
      reading?.setAliasesFinished?.(all,false);
      reading?.clearProgressAliases?.(all);
    }catch(error){
      console.warn("Read Again state reset skipped",error);
      for(const identity of identities){
        try{localStorage.removeItem(`sg-progress:${identity}`)}catch{}
      }
    }
  }

  syncStoredTheme();

  try{
    if(BOOK_ID.test(requested)&&String(seriesId).startsWith("adult-")&&localStorage.getItem("sg-adult-ack")!=="1"){
      const ret=`${location.pathname}${location.search}${location.hash}`;
      location.replace(`/nsfw.html?return=${encodeURIComponent(ret)}`);
      return;
    }

    const ticket=access?.initial?await access.initial:null;
    const ticketBookId=String(ticket?.bookId||ticket?.identity||"").trim();
    if(BOOK_ID.test(ticketBookId))window.__sgReaderPublicBookId=ticketBookId;
    if(ticket?.identity&&access?.migrateLegacyState)await access.migrateLegacyState([ticket.identity]);

    const sourcePath=String(ticket?.sourcePath||(()=>{try{return new URL(ticket?.url||"",location.href).pathname}catch{return""}})());
    window.__sgReaderSourcePath=EPUB_PATH.test(sourcePath)?sourcePath:"";
    await resetForReadAgain(ticket,sourcePath);
    installCanonicalReaderMirror(sourcePath);

    if(BOOK_ID.test(requested)&&EPUB_PATH.test(sourcePath)){
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
