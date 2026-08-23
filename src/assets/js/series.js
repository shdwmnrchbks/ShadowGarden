const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),arr=v=>Array.isArray(v)?v:[];
function pins(){try{return JSON.parse(localStorage.getItem("sg-pinned")||"[]")}catch{return[]}}
function setPinned(id,on){const s=new Set(pins());on?s.add(id):s.delete(id);localStorage.setItem("sg-pinned",JSON.stringify([...s]))}
function progressFor(file){try{return JSON.parse(localStorage.getItem(`sg-progress:${file}`)||"null")}catch{return null}}
function fmtSize(n){if(!n)return"";let x=n,i=0,u=["B","KB","MB","GB"];while(x>=1024&&i<3){x/=1024;i++}return`${x.toFixed(i>1?1:0)} ${u[i]}`}
function syncLibraryScope(adult){
  document.body.classList.toggle("adult-library",Boolean(adult));
  const home=$(".brand-home"),back=$("#headerBack"),adultNav=$(".adult-nav-link"),mainNav=$(".main-nav-link"),themeMeta=document.querySelector('meta[name="theme-color"]');
  if(home){home.href=adult?"/nsfw.html":"/";home.setAttribute("aria-label",adult?"Shadow Garden Adult Library home":"Shadow Garden home")}
  if(back){back.href=adult?"/nsfw.html":"/";back.textContent=adult?"← Back to Adult Library":"← Back to archive"}
  if(adultNav){adultNav.classList.toggle("active",Boolean(adult));adult?adultNav.setAttribute("aria-current","page"):adultNav.removeAttribute("aria-current")}
  if(mainNav){mainNav.classList.toggle("active",!adult);!adult?mainNav.setAttribute("aria-current","page"):mainNav.removeAttribute("aria-current")}
  if(themeMeta)themeMeta.content=adult?"#10090c":"#09080d";
}
async function init(){
  const id=new URLSearchParams(location.search).get("id");
  const requestedAdult=String(id||"").startsWith("adult-");
  syncLibraryScope(requestedAdult);
  try{
    await import("/assets/js/reading-status.js?v=1.15.0");
    const reading=window.ShadowGardenReadingStatus;
    if(requestedAdult&&localStorage.getItem("sg-adult-ack")!=="1"){
      const ret=`/series.html?id=${encodeURIComponent(id)}`;
      location.replace(`/nsfw.html?return=${encodeURIComponent(ret)}`);
      return;
    }
    if(!window.ShadowGardenData)throw new Error("Catalog data source is unavailable");
    const cat=await window.ShadowGardenData.loadCatalog(requestedAdult),s=arr(cat.series).find(x=>x.id===id);
    if(!s)throw new Error("Series not found");
    syncLibraryScope(Boolean(s.nsfw));
    document.title=`${s.title} — Shadow Garden`;
    const vols=arr(s.volumes),first=vols[0],pinned=pins().includes(s.id),finishedCount=reading?.finishedCount(s)||0,allFinished=vols.length>0&&finishedCount===vols.length;
    const unfinished=vols.filter(v=>!reading?.isFinished(v.file));
    const resumed=unfinished.map(v=>({v,p:progressFor(v.file)})).filter(x=>x.p?.updatedAt).sort((a,b)=>b.p.updatedAt-a.p.updatedAt)[0];
    const startVol=resumed?.v||unfinished[0]||first;
    const startLabel=allFinished?"Read Again":resumed?"Continue Reading":finishedCount?"Read Next Unfinished":"Start Reading";
    const startHref=startVol?`/reader.html?book=${encodeURIComponent(startVol.file)}&series=${encodeURIComponent(s.id)}`:"#";
    const audioAlignedUrl=s.audioAlignedUrl||vols.find(v=>v.audioAlignedUrl)?.audioAlignedUrl||"";
    const cover=s.cover||first?.cover||s.coverThumb||first?.coverThumb||"";
    const heroThumb=s.coverThumb||first?.coverThumb||cover;
    $("#seriesRoot").innerHTML=`
      <section class="series-hero">
        ${heroThumb?`<div class="series-backdrop" style="background-image:url('${esc(heroThumb)}')"></div>`:""}
        <div class="series-hero-inner">
          ${cover?`<img class="series-cover" src="${esc(cover)}" alt="${esc(s.title)} cover" loading="eager" decoding="async" fetchpriority="high">`:`<div class="series-cover-fallback">${esc(s.title)}</div>`}
          <div class="series-info">
            <p class="kicker">${s.nsfw?"ADULT · ":""}${esc((s.status||"SERIES").toUpperCase())}</p>
            <h1>${esc(s.title)}</h1>
            <p class="series-byline">${esc(s.author||"Unknown author")} ${s.year?`<span class="series-year">· ${s.year}</span>`:""}${finishedCount?` <span class="series-year">· ${finishedCount}/${vols.length} finished</span>`:""}</p>
            <div class="series-actions">
              ${startVol?`<a class="primary-button" href="${startHref}">${startLabel}</a>`:""}
              ${audioAlignedUrl?`<a class="secondary-button audio-series-link" href="${esc(audioAlignedUrl)}" target="_blank" rel="noopener noreferrer">Audio EPUBs ↗</a>`:""}
              <button id="pinButton" class="secondary-button ${pinned?"pinned":""}" type="button">${pinned?"◆ Pinned":"◇ Pin to Garden"}</button>
            </div>
            <div class="tag-row">${arr(s.tags).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
          </div>
        </div>
      </section>
      <section class="series-body">
        ${s.description?`<p class="series-description">${esc(s.description)}</p>`:""}
        <div class="series-section-head"><h2>Volumes</h2><span>${vols.length} ${vols.length===1?"volume":"volumes"}</span></div>
        <div class="volume-grid">${vols.map((v,i)=>{
          const c=v.coverThumb||v.cover||s.coverThumb||cover,p=progressFor(v.file),pct=p?Math.round((p.percentage||0)*100):0,finished=reading?.isFinished(v.file);
          return `<article class="volume-card ${finished?"is-finished":""}">
            <div class="volume-cover">${c?`<img src="${esc(c)}" alt="${esc(v.title)} cover" loading="lazy" decoding="async" fetchpriority="low">`:""}${finished?'<span class="finished-volume-badge" title="Finished" aria-label="Finished">✓</span>':""}</div>
            <h3 class="volume-title">${esc(v.title||`Volume ${i+1}`)}</h3>
            <p class="volume-meta">${[v.date||"",fmtSize(v.size),finished?"Finished":p?`${pct}% read`:""].filter(Boolean).join(" · ")}</p>
            <div class="volume-actions">
              <a class="read" href="/reader.html?book=${encodeURIComponent(v.file)}&series=${encodeURIComponent(s.id)}">${finished?"Read again":p?"Continue":"Read"}</a>
              <a class="download" href="#book-${esc(v.file)}" data-book-id="${esc(v.file)}" download>Download EPUB</a>
            </div>
          </article>`}).join("")}</div>
      </section>`;
    $("#pinButton")?.addEventListener("click",e=>{const on=!e.currentTarget.classList.contains("pinned");setPinned(s.id,on);e.currentTarget.classList.toggle("pinned",on);e.currentTarget.textContent=on?"◆ Pinned":"◇ Pin to Garden"});
  }catch(e){
    console.error(e);
    const home=requestedAdult?"/nsfw.html":"/";
    $("#seriesRoot").innerHTML=`<section class="not-found"><span>SHELF NOT FOUND</span><h1>This series is missing.</h1><p>The catalog entry could not be opened.</p><a class="primary-button" href="${home}">Return to the archive</a></section>`;
  }
}
init();
