/* Shadow Garden v1.10.1 — enrich Continue Reading with resumed-volume metadata and artwork. */
(()=>{
  const panel=document.querySelector("#continuePanel");
  if(!panel||!window.ShadowGardenData)return;
  const adult=(document.body.dataset.libraryScope||"main")==="nsfw";
  const arr=value=>Array.isArray(value)?value:[];

  function latestSavedProgress(files){
    const allowed=new Set(files);
    const saved=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key?.startsWith("sg-progress:"))continue;
      try{
        const item=JSON.parse(localStorage.getItem(key)||"null");
        if(item?.updatedAt&&allowed.has(item.file))saved.push(item);
      }catch{}
    }
    saved.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
    return saved[0]||null;
  }

  function cleanVolumeNumber(value,fallback){
    const raw=String(value??"").trim();
    if(!raw)return String(fallback);
    return /^\d+$/.test(raw)?String(Number(raw)):raw;
  }

  const metadataPromise=window.ShadowGardenData.loadCatalog(adult).then(catalog=>{
    const series=arr(catalog?.series);
    const entries=series.flatMap(item=>arr(item.volumes).map((volume,index)=>({series:item,volume,index})));
    const saved=latestSavedProgress(entries.map(entry=>entry.volume.file));
    if(!saved)return null;
    const match=entries.find(entry=>entry.volume.file===saved.file);
    if(!match)return null;
    return {
      seriesTitle:String(match.series.title||"Untitled series"),
      volumeTitle:String(match.volume.title||`Volume ${match.index+1}`),
      volumeNumber:cleanVolumeNumber(match.volume.number,match.index+1),
      percent:Math.round((Number(saved.percentage)||0)*100),
      cover:String(match.volume.coverThumb||match.volume.cover||match.series.coverThumb||match.series.cover||"")
    };
  }).catch(error=>{
    console.warn("Continue metadata enrichment skipped",error);
    return null;
  });

  function installCover(mark,metadata){
    if(!mark||!metadata.cover||mark.dataset.cover===metadata.cover)return;
    mark.dataset.cover=metadata.cover;
    mark.classList.add("continue-cover");
    const image=document.createElement("img");
    image.src=metadata.cover;
    image.alt="";
    image.loading="eager";
    image.decoding="async";
    image.addEventListener("error",()=>{
      if(mark.dataset.cover!==metadata.cover)return;
      mark.classList.remove("continue-cover");
      delete mark.dataset.cover;
      mark.replaceChildren("✦");
    },{once:true});
    mark.replaceChildren(image);
  }

  let applying=false;
  async function enrich(){
    if(applying||panel.classList.contains("hidden"))return;
    const span=panel.querySelector("span");
    const mark=panel.querySelector(".continue-mark");
    if(!span&&!mark)return;
    const metadata=await metadataPromise;
    if(!metadata)return;
    const next=`${metadata.seriesTitle} · Volume ${metadata.volumeNumber} · ${metadata.percent}%`;
    const needsText=Boolean(span&&span.textContent!==next);
    const needsCover=Boolean(mark&&metadata.cover&&mark.dataset.cover!==metadata.cover);
    if(!needsText&&!needsCover)return;
    applying=true;
    if(needsText)span.textContent=next;
    if(needsCover)installCover(mark,metadata);
    applying=false;
  }

  const observer=new MutationObserver(()=>{void enrich()});
  observer.observe(panel,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class"]});
  window.addEventListener("DOMContentLoaded",()=>void enrich(),{once:true});
  void metadataPromise.then(()=>enrich());
})();
