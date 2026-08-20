const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),arr=v=>Array.isArray(v)?v:[];
function pins(){try{return JSON.parse(localStorage.getItem("sg-pinned")||"[]")}catch{return[]}}
function setPinned(id,on){const s=new Set(pins());on?s.add(id):s.delete(id);localStorage.setItem("sg-pinned",JSON.stringify([...s]))}
function progressFor(file){try{return JSON.parse(localStorage.getItem(`sg-progress:${file}`)||"null")}catch{return null}}
function fmtSize(n){if(!n)return"";let x=n,i=0,u=["B","KB","MB","GB"];while(x>=1024&&i<3){x/=1024;i++}return`${x.toFixed(i>1?1:0)} ${u[i]}`}
async function init(){
  const id=new URLSearchParams(location.search).get("id");
  try{
    const adult=String(id||"").startsWith("adult-");
    if(adult&&localStorage.getItem("sg-adult-ack")!=="1"){
      const ret=`/series.html?id=${encodeURIComponent(id)}`;
      location.replace(`/nsfw.html?return=${encodeURIComponent(ret)}`);
      return;
    }
    if(!window.ShadowGardenData)throw new Error("Catalog data source is unavailable");
    const cat=await window.ShadowGardenData.loadCatalog(adult),s=arr(cat.series).find(x=>x.id===id);
    if(!s)throw new Error("Series not found");
    document.body.classList.toggle("adult-library",Boolean(s.nsfw));
    const back=document.querySelector("#headerBack");
    if(back){back.href=s.nsfw?"/nsfw.html":"/";back.textContent=s.nsfw?"← Back to Adult Library":"← Back to archive"}
    document.title=`${s.title} — Shadow Garden`;
    const vols=arr(s.volumes),first=vols[0],pinned=pins().includes(s.id);
    const resumed=vols.map(v=>({v,p:progressFor(v.file)})).filter(x=>x.p?.updatedAt).sort((a,b)=>b.p.updatedAt-a.p.updatedAt)[0];
    const startVol=resumed?.v||first;
    const startHref=startVol?`/reader.html?book=${encodeURIComponent(startVol.file)}&series=${encodeURIComponent(s.id)}`:"#";
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
            <p class="series-byline">${esc(s.author||"Unknown author")} ${s.year?`<span class="series-year">· ${s.year}</span>`:""}</p>
            <div class="series-actions">
              ${startVol?`<a class="primary-button" href="${startHref}">${resumed?"Continue Reading":"Start Reading"}</a>`:""}
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
          const c=v.coverThumb||v.cover||s.coverThumb||cover,p=progressFor(v.file),pct=p?Math.round((p.percentage||0)*100):0;
          return `<article class="volume-card">
            <div class="volume-cover">${c?`<img src="${esc(c)}" alt="${esc(v.title)} cover" loading="lazy" decoding="async" fetchpriority="low">`:""}</div>
            <h3 class="volume-title">${esc(v.title||`Volume ${i+1}`)}</h3>
            <p class="volume-meta">${[v.date||"",fmtSize(v.size),p?`${pct}% read`:""].filter(Boolean).join(" · ")}</p>
            <div class="volume-actions">
              <a class="read" href="/reader.html?book=${encodeURIComponent(v.file)}&series=${encodeURIComponent(s.id)}">${p?"Continue":"Read"}</a>
              <a class="download" href="${esc(v.file)}" download>Download EPUB</a>
              ${v.audioAlignedUrl?`<a class="audio-download" href="${esc(v.audioAlignedUrl)}" target="_blank" rel="noopener noreferrer" download>Audio EPUB</a>`:""}
            </div>
          </article>`}).join("")}</div>
      </section>`;
    $("#pinButton")?.addEventListener("click",e=>{const on=!e.currentTarget.classList.contains("pinned");setPinned(s.id,on);e.currentTarget.classList.toggle("pinned",on);e.currentTarget.textContent=on?"◆ Pinned":"◇ Pin to Garden"});
  }catch(e){
    console.error(e);$("#seriesRoot").innerHTML=`<section class="not-found"><span>SHELF NOT FOUND</span><h1>This series is missing.</h1><p>The catalog entry could not be opened.</p><a class="primary-button" href="/">Return to the archive</a></section>`;
  }
}
init();
