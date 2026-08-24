/* Shadow Garden v1.15.14 — authoritative Library Read/Continue state. */
(async()=>{
  const panel=document.getElementById("continuePanel");
  if(!panel||!window.ShadowGardenData)return;

  const scope=document.body.dataset.libraryScope||"main";
  const adult=scope==="nsfw";
  const arr=value=>Array.isArray(value)?value:[];
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const volumeCover=(series,volume)=>String(volume?.coverThumb||volume?.cover||series?.coverThumb||series?.cover||"");
  const volumeNumber=(volume,index)=>String(volume?.number??"").trim()||String(index+1);

  try{
    await import("/assets/js/reading-status.js?v=1.15.14");
    const status=window.ShadowGardenReadingStatus;
    if(!status)return;

    const catalog=await window.ShadowGardenData.loadCatalog(adult);
    const entries=arr(catalog?.series).flatMap(series=>arr(series?.volumes).map((volume,index)=>({series,volume,index})));

    function progressEntries(){
      return entries.map(entry=>{
        const state=status.volumeState?.(entry.series?.id,entry.volume,entry.index)||status.STATES?.UNREAD||"unread";
        const item=status.volumeProgress?.(entry.series?.id,entry.volume,entry.index)||null;
        return{entry,state,item,updatedAt:Number(item?.updatedAt)||0};
      }).filter(candidate=>candidate.item?.updatedAt&&candidate.state!==status.STATES?.FINISHED&&candidate.state!=="finished")
        .sort((a,b)=>b.updatedAt-a.updatedAt);
    }

    let syncing=false;
    let rerun=false;
    async function sync(){
      if(syncing){rerun=true;return}
      syncing=true;
      try{
        const current=progressEntries()[0]||null;
        const art=document.querySelector(".library-intro > .intro-banner-art");
        if(!current){
          if(!panel.classList.contains("hidden"))panel.classList.add("hidden");
          if(panel.childNodes.length)panel.replaceChildren();
          panel.dataset.finishedSuppressed="1";
          delete panel.dataset.continueSignature;
          art?.remove();
          return;
        }

        const {item,entry,state}=current;
        const {series,volume,index}=entry;
        const cover=volumeCover(series,volume);
        const title=String(volume?.title||`Volume ${volumeNumber(volume,index)}`);
        const seriesTitle=String(series?.title||"Untitled series");
        const percent=Math.round((Number(item?.percentage)||0)*100);
        const actionLabel=status.actionLabelForState?.(state)||(state==="in-progress"?"Continue":"Read");
        const href=`/reader.html?book=${encodeURIComponent(volume.file)}&series=${encodeURIComponent(series.id)}`;
        const signature=[series.id,volume.file,item.updatedAt,percent,cover,state,actionLabel].join("|");
        const currentHref=panel.querySelector("a[href*='/reader.html']")?.getAttribute("href")||"";
        const currentTitle=panel.querySelector("strong")?.textContent||"";
        const currentAction=panel.querySelector("a[href*='/reader.html']")?.textContent||"";
        const needsRender=panel.dataset.continueSignature!==signature||currentHref!==href||currentTitle!==title||currentAction!==actionLabel;

        if(needsRender){
          panel.dataset.continueSignature=signature;
          panel.removeAttribute("data-finished-suppressed");
          panel.dataset.readingState=state;
          panel.innerHTML=`<div class="continue-mark${cover?" continue-cover":""}">${cover?`<img src="${esc(cover)}" alt="" loading="eager" decoding="async">`:"✦"}</div><div><strong>${esc(title)}</strong><span>${esc(seriesTitle)} · Volume ${esc(volumeNumber(volume,index))} · ${percent}%</span></div><a data-volume-state="${esc(state)}" href="${href}">${actionLabel}</a>`;
        }
        if(panel.classList.contains("hidden"))panel.classList.remove("hidden");

        const intro=document.querySelector(".library-intro");
        if(intro&&cover){
          let banner=intro.querySelector(":scope > .intro-banner-art");
          if(!banner){banner=document.createElement("div");banner.className="intro-banner-art";banner.setAttribute("aria-hidden","true");intro.prepend(banner)}
          banner.style.backgroundImage=`url(${JSON.stringify(cover)})`;
        }
      }finally{
        syncing=false;
        if(rerun){rerun=false;queueMicrotask(()=>void sync())}
      }
    }

    const observer=new MutationObserver(()=>void sync());
    observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    window.addEventListener(status.EVENT,()=>void sync());
    window.addEventListener("storage",event=>{
      const key=String(event.key||"");
      if(key===status.KEY||key.startsWith(status.MARKER_PREFIX||"sg-finished:")||key.startsWith("sg-progress:"))void sync();
    });
    window.addEventListener("pageshow",()=>void sync());
    await sync();
  }catch(error){
    console.warn("Library reading-state polish unavailable",error);
  }
})();
