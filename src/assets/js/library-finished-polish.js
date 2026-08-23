/* Shadow Garden v1.15.5 — Library finished-state presentation fixes. */
(async()=>{
  const panel=document.getElementById("continuePanel");
  if(!panel||!window.ShadowGardenData)return;

  try{
    await import("/assets/js/reading-status.js?v=1.15.5");
    const status=window.ShadowGardenReadingStatus;
    if(!status)return;

    const adult=(document.body.dataset.libraryScope||"main")==="nsfw";
    const catalog=await window.ShadowGardenData.loadCatalog(adult);
    const entries=(Array.isArray(catalog?.series)?catalog.series:[]).flatMap(series=>(Array.isArray(series?.volumes)?series.volumes:[]).map((volume,index)=>({series,volume,index})));

    function currentEntry(){
      const link=panel.querySelector('a[href*="/reader.html"]');
      if(!link)return null;
      try{
        const url=new URL(link.getAttribute("href")||"",location.href);
        const book=String(url.searchParams.get("book")||"");
        const seriesId=String(url.searchParams.get("series")||"");
        return entries.find(entry=>String(entry.series?.id||"")===seriesId&&[entry.volume?.file,entry.volume?.bookId].map(String).includes(book))||null;
      }catch{return null}
    }

    function sync(){
      const entry=currentEntry();
      if(!entry)return;
      const finished=status.isVolumeFinished?.(entry.series?.id,entry.volume,entry.index)??status.isFinished?.(entry.volume?.file);
      if(!finished)return;
      panel.classList.add("hidden");
      panel.replaceChildren();
      panel.dataset.finishedSuppressed="1";
    }

    const observer=new MutationObserver(sync);
    observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    window.addEventListener(status.EVENT,sync);
    window.addEventListener("storage",event=>{
      if(event.key===status.KEY||String(event.key||"").startsWith(status.MARKER_PREFIX||"sg-finished:"))sync();
    });
    sync();
  }catch(error){
    console.warn("Library finished-state polish unavailable",error);
  }
})();
