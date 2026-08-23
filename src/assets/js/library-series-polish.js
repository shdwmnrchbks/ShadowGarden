/* Shadow Garden v1.9.4 — public archive/series presentation polish. */
(()=>{
  const arr=value=>Array.isArray(value)?value:[];
  const BOOK_ID=/^bk_[A-Za-z0-9_-]{22}$/;
  const scope=(document.body.dataset.libraryScope||"").toLowerCase();
  const isLibrary=Boolean(document.getElementById("catalogGrid"));
  const isSeries=Boolean(document.getElementById("seriesRoot"));

  function pinnedIds(){
    try{return new Set(JSON.parse(localStorage.getItem("sg-pinned")||"[]"))}
    catch{return new Set()}
  }

  function cardSeriesId(card){
    try{return new URL(card.getAttribute("href")||"",location.href).searchParams.get("id")||""}
    catch{return""}
  }

  function makeBadge(text,kind=""){
    const badge=document.createElement("span");
    badge.className=`compact-card-badge${kind?` ${kind}`:""}`;
    badge.textContent=text;
    return badge;
  }

  function syncCompactCard(card,pins=pinnedIds()){
    if(!card)return;
    let rail=card.querySelector(":scope > .compact-card-badges");
    if(!rail){
      rail=document.createElement("div");
      rail.className="compact-card-badges";
      rail.setAttribute("aria-label","Series badges");
      card.appendChild(rail);
    }
    const id=cardSeriesId(card);
    const volumeText=card.querySelector(".cover .volume-pill")?.textContent?.trim()||"";
    const adult=Boolean(card.querySelector(".cover .adult-pill"));
    const signature=`${pins.has(id)?"1":"0"}|${volumeText}|${adult?"1":"0"}`;
    if(rail.dataset.signature===signature)return;
    rail.dataset.signature=signature;
    rail.replaceChildren();
    if(pins.has(id))rail.appendChild(makeBadge("◆ Pinned","pinned"));
    if(volumeText)rail.appendChild(makeBadge(volumeText,"volumes"));
    if(adult)rail.appendChild(makeBadge("18+","adult"));
  }

  function syncCompactCards(){
    const grid=document.getElementById("catalogGrid");
    if(!grid)return;
    const pins=pinnedIds();
    grid.querySelectorAll(":scope > .series-card").forEach(card=>syncCompactCard(card,pins));
  }

  function latestProgressFor(allowed){
    const entries=[];
    for(let index=0;index<localStorage.length;index++){
      const key=localStorage.key(index);
      if(!key?.startsWith("sg-progress:"))continue;
      try{
        const item=JSON.parse(localStorage.getItem(key)||"null");
        if(item?.updatedAt&&allowed.has(String(item.file||"")))entries.push(item);
      }catch{}
    }
    entries.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
    return entries[0]||null;
  }

  function volumeArtwork(series,volume){
    return String(volume?.cover||volume?.coverThumb||series?.cover||series?.coverThumb||"");
  }

  function setIntroArtwork(source){
    const intro=document.querySelector(".library-intro");
    if(!intro||!source)return;
    let art=intro.querySelector(":scope > .intro-banner-art");
    if(!art){
      art=document.createElement("div");
      art.className="intro-banner-art";
      art.setAttribute("aria-hidden","true");
      intro.prepend(art);
    }
    art.style.backgroundImage=`url(${JSON.stringify(source)})`;
  }

  async function enhanceLibrary(){
    const grid=document.getElementById("catalogGrid");
    if(!grid||!window.ShadowGardenData)return;
    syncCompactCards();
    new MutationObserver(syncCompactCards).observe(grid,{childList:true});
    window.addEventListener("storage",event=>{if(event.key==="sg-pinned")syncCompactCards()});

    const adult=scope==="nsfw";
    try{
      const catalog=await window.ShadowGardenData.loadCatalog(adult);
      const entries=arr(catalog?.series).flatMap(series=>arr(series?.volumes).map(volume=>({series,volume})));
      const allowed=new Set(entries.map(entry=>String(entry.volume?.file||"")).filter(Boolean));
      const saved=latestProgressFor(allowed);
      if(!saved)return;
      const match=entries.find(entry=>String(entry.volume?.file||"")===String(saved.file||""));
      if(match)setIntroArtwork(volumeArtwork(match.series,match.volume));
    }catch(error){
      console.warn("Library intro artwork unavailable",error);
    }
  }

  function tagLibraryPath(adult){return adult?"/nsfw.html":"/"}

  function makeTagsClickable(series){
    const row=document.querySelector(".series-info .tag-row");
    if(!row)return;
    const adult=Boolean(series?.nsfw)||String(series?.id||"").startsWith("adult-");
    const base=tagLibraryPath(adult);
    const tags=arr(series?.tags).map(String).filter(Boolean);
    if(!tags.length)return;
    const current=[...row.querySelectorAll(".tag")];
    tags.forEach((tag,index)=>{
      const existing=current[index];
      if(existing?.tagName==="A")return;
      const link=document.createElement("a");
      link.className="tag";
      link.href=`${base}?tag=${encodeURIComponent(tag)}`;
      link.textContent=tag;
      link.title=`Show ${tag} in ${adult?"Adult Library":"Library"}`;
      if(existing)existing.replaceWith(link);else row.appendChild(link);
    });
  }

  function seriesBannerVolume(series){
    const volumes=arr(series?.volumes);
    const selected=String(series?.bannerBookId||"");
    if(BOOK_ID.test(selected)){
      const match=volumes.find(volume=>String(volume?.bookId||volume?.file||"")===selected);
      if(match)return match;
    }
    return volumes[0]||null;
  }

  function setSeriesArtwork(series){
    const hero=document.querySelector(".series-hero");
    if(!hero)return;
    const volume=seriesBannerVolume(series);
    const source=volumeArtwork(series,volume);
    if(!source)return;
    let backdrop=hero.querySelector(":scope > .series-backdrop");
    if(!backdrop){
      backdrop=document.createElement("div");
      backdrop.className="series-backdrop";
      backdrop.setAttribute("aria-hidden","true");
      hero.prepend(backdrop);
    }
    backdrop.style.backgroundImage=`url(${JSON.stringify(source)})`;
  }

  async function enhanceSeries(){
    if(!window.ShadowGardenData)return;
    const id=new URLSearchParams(location.search).get("id")||"";
    if(!id)return;
    const adult=id.startsWith("adult-");
    try{
      const catalog=await window.ShadowGardenData.loadCatalog(adult);
      const series=arr(catalog?.series).find(item=>item?.id===id);
      if(!series)return;
      const apply=()=>{
        if(!document.querySelector(".series-hero"))return false;
        setSeriesArtwork(series);
        makeTagsClickable(series);
        return true;
      };
      if(apply())return;
      const root=document.getElementById("seriesRoot");
      if(!root)return;
      const observer=new MutationObserver(()=>{if(apply())observer.disconnect()});
      observer.observe(root,{childList:true,subtree:true});
    }catch(error){
      console.warn("Series banner/tag polish unavailable",error);
    }
  }

  const run=()=>{
    if(isLibrary)void enhanceLibrary();
    if(isSeries)void enhanceSeries();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});
  else run();
})();
