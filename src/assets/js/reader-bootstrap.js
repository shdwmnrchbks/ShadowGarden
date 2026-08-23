/* Shadow Garden Security Milestones 2–3 + v1.15.7 Reader startup handoff. */
(async()=>{
  const access=window.ShadowGardenBookAccess;
  const publicSearch=location.search;
  const publicParams=new URLSearchParams(publicSearch);
  const requested=publicParams.get("book")||"";
  const seriesId=publicParams.get("series")||"";
  const BOOK_ID=/^bk_[A-Za-z0-9_-]{22}$/;
  const EPUB_PATH=/^\/media\/shadow-garden\/books\/.+\.epub$/i;

  /* Reader internals temporarily see the private media path while they initialize.
     Public reading state must never key itself from that temporary view. The initial
     URL can itself still be a legacy media URL, so the access ticket is authoritative. */
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
    if(typeof originalEpub!=="function")return import("/assets/js/reader.js?v=1.10.2");
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
    try{return await import("/assets/js/reader.js?v=1.10.2")}
    finally{window.ePub=originalEpub}
  }

  async function mountReadingStatus(){
    await import("/assets/js/reading-status.js?v=1.15.6");
    await import("/assets/js/reader-finished.js?v=1.15.7");
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
      try{
        await importReader();
      }finally{
        window.URLSearchParams=NativeURLSearchParams;
      }
      await mountReadingStatus();
      return;
    }

    await importReader();
    canonicalizeLegacyUrl();
    await mountReadingStatus();
  }catch(error){
    console.error("Reader book authorization failed",error);
    const loading=document.getElementById("readerLoading");
    if(loading){
      loading.classList.remove("hidden");
      loading.innerHTML=`<p>${String(error?.message||"Shadow Garden could not authorize this EPUB.").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</p>`;
    }
  }
})();
