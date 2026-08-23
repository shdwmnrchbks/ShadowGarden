/* Shadow Garden v1.15.6 — authoritative Library Continue Reading state. */
(async()=>{
  const panel=document.getElementById("continuePanel");
  if(!panel||!window.ShadowGardenData)return;

  const scope=document.body.dataset.libraryScope||"main";
  const adult=scope==="nsfw";
  const BOOK_ID=/^bk_[A-Za-z0-9_-]{22}$/;
  const LEGACY_BOOK=/^\/media\/shadow-garden\/books\/.+\.epub$/i;
  const encoder=new TextEncoder();
  const arr=value=>Array.isArray(value)?value:[];
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

  function normalizeIdentity(value){
    const raw=String(value||"").trim();
    if(!raw)return"";
    if(BOOK_ID.test(raw))return raw;
    try{
      const url=new URL(raw,location.origin);
      let path=url.pathname;
      try{path=decodeURIComponent(path)}catch{}
      return path.replace(/\/+$/g,"");
    }catch{
      let path=raw.split(/[?#]/)[0];
      try{path=decodeURIComponent(path)}catch{}
      return path.replace(/\/+$/g,"");
    }
  }

  function base64Url(bytes){
    let binary="";
    for(const value of bytes)binary+=String.fromCharCode(value);
    return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  }

  async function canonicalBookId(identity){
    const normalized=normalizeIdentity(identity);
    if(BOOK_ID.test(normalized))return normalized;
    if(!LEGACY_BOOK.test(normalized))return normalized;
    try{
      const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(`shadow-garden-book-id-v1\n${normalized}`)));
      return `bk_${base64Url(digest.slice(0,16))}`;
    }catch{return normalized}
  }

  function volumeCover(series,volume){return String(volume?.coverThumb||volume?.cover||series?.coverThumb||series?.cover||"")}
  function volumeNumber(volume,index){const raw=String(volume?.number??"").trim();return raw||String(index+1)}

  try{
    await import("/assets/js/reading-status.js?v=1.15.6");
    const status=window.ShadowGardenReadingStatus;
    if(!status)return;

    const catalog=await window.ShadowGardenData.loadCatalog(adult);
    const entries=arr(catalog?.series).flatMap(series=>arr(series?.volumes).map((volume,index)=>({series,volume,index})));
    const byIdentity=new Map();
    for(const entry of entries){
      for(const identity of [entry.volume?.file,entry.volume?.bookId]){
        const normalized=normalizeIdentity(identity);
        if(normalized)byIdentity.set(normalized,entry);
      }
    }

    async function progressEntries(){
      const saved=[];
      const keys=[];
      for(let index=0;index<localStorage.length;index++)keys.push(localStorage.key(index));
      for(const key of keys){
        if(!key?.startsWith("sg-progress:"))continue;
        try{
          const item=JSON.parse(localStorage.getItem(key)||"null");
          if(!item?.updatedAt)continue;
          const rawIdentity=String(item.file||key.slice("sg-progress:".length)||"");
          const normalized=normalizeIdentity(rawIdentity);
          const canonical=await canonicalBookId(rawIdentity);
          const entry=byIdentity.get(canonical)||byIdentity.get(normalized);
          if(!entry)continue;
          const finished=status.isVolumeFinished?.(entry.series?.id,entry.volume,entry.index)
            ??status.isFinished?.(entry.volume?.file);
          if(finished)continue;
          saved.push({item,entry,updatedAt:Number(item.updatedAt)||0});
        }catch{}
      }
      saved.sort((a,b)=>b.updatedAt-a.updatedAt);
      return saved;
    }

    let syncing=false;
    let rerun=false;
    async function sync(){
      if(syncing){rerun=true;return}
      syncing=true;
      try{
        const candidates=await progressEntries();
        const current=candidates[0]||null;
        const art=document.querySelector(".library-intro > .intro-banner-art");
        if(!current){
          panel.classList.add("hidden");
          panel.replaceChildren();
          panel.dataset.finishedSuppressed="1";
          art?.remove();
          return;
        }

        const {item,entry}=current;
        const {series,volume,index}=entry;
        const cover=volumeCover(series,volume);
        const title=String(volume?.title||`Volume ${volumeNumber(volume,index)}`);
        const seriesTitle=String(series?.title||"Untitled series");
        const percent=Math.round((Number(item?.percentage)||0)*100);
        const href=`/reader.html?book=${encodeURIComponent(volume.file)}&series=${encodeURIComponent(series.id)}`;
        const signature=[series.id,volume.file,item.updatedAt,percent,cover].join("|");

        if(panel.dataset.continueSignature!==signature){
          panel.dataset.continueSignature=signature;
          panel.removeAttribute("data-finished-suppressed");
          panel.innerHTML=`<div class="continue-mark${cover?" continue-cover":""}">${cover?`<img src="${esc(cover)}" alt="" loading="eager" decoding="async">`:"✦"}</div><div><strong>${esc(title)}</strong><span>${esc(seriesTitle)} · Volume ${esc(volumeNumber(volume,index))} · ${percent}%</span></div><a href="${href}">Continue</a>`;
        }
        panel.classList.remove("hidden");

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
    console.warn("Library finished-state polish unavailable",error);
  }
})();
