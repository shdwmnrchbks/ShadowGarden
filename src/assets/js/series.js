const $=s=>document.querySelector(s),arr=v=>Array.isArray(v)?v:[];
const fallbackEsc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let domain=null;
function esc(value){return domain?.format?.escapeHtml?.(value)??fallbackEsc(value)}
function fmtSize(value){return domain?.format?.formatBytes?.(value)||""}
function syncLibraryScope(adult){
  document.body.classList.toggle("adult-library",Boolean(adult));
  const home=$(".brand-home"),back=$("#headerBack"),adultNav=$(".adult-nav-link"),mainNav=$(".main-nav-link"),themeMeta=document.querySelector('meta[name="theme-color"]');
  if(home){home.href=domain?.urls?.libraryUrl?.(adult)||(adult?"/nsfw.html":"/");home.setAttribute("aria-label",adult?"Shadow Garden Adult Library home":"Shadow Garden home")}
  if(back){back.href=domain?.urls?.libraryUrl?.(adult)||(adult?"/nsfw.html":"/");back.textContent=adult?"← Back to Adult Library":"← Back to archive"}
  if(adultNav){adultNav.classList.toggle("active",Boolean(adult));adult?adultNav.setAttribute("aria-current","page"):adultNav.removeAttribute("aria-current")}
  if(mainNav){mainNav.classList.toggle("active",!adult);!adult?mainNav.setAttribute("aria-current","page"):mainNav.removeAttribute("aria-current")}
  if(themeMeta)themeMeta.content=adult?"#10090c":"#09080d";
}
async function init(){
  const id=new URLSearchParams(location.search).get("id");
  const requestedAdult=String(id||"").startsWith("adult-");
  try{
    domain=await import("/assets/js/domain/index.js");
    syncLibraryScope(requestedAdult);
    await import("/assets/js/reading-status.js");
    const reading=window.ShadowGardenReadingStatus||domain.readingState;
    if(requestedAdult&&!domain.preferences.adultAcknowledged()){
      const ret=domain.urls.seriesUrl(id);
      location.replace(domain.urls.adultGateReturnUrl(ret));
      return;
    }
    if(!window.ShadowGardenData)throw new Error("Catalog data source is unavailable");
    const cat=await window.ShadowGardenData.loadCatalog(requestedAdult),s=domain.catalog.seriesById(cat,id);
    if(!s)throw new Error("Series not found");
    syncLibraryScope(Boolean(s.nsfw));
    document.title=`${s.title} — Shadow Garden`;
    const vols=arr(s.volumes),first=vols[0],pinned=domain.preferences.isPinned(s.id),finishedCount=reading.finishedCount(s)||0;
    const volumeEntries=reading.volumeEntries(s);
    const startEntry=reading.preferredSeriesEntry(s);
    const startVol=startEntry?.volume||first;
    const startState=startEntry?.state||reading.STATES.UNREAD;
    const startLabel=reading.actionLabelForState(startState);
    const startHref=startVol?domain.urls.readerUrl(startVol.file,s.id):"#";
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
              ${startVol?`<a class="primary-button" data-volume-state="${esc(startState)}" data-volume-title="${esc(startVol.title||`Volume ${startEntry?.index+1||1}`)}" href="${startHref}">${startLabel}</a>`:""}
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
        <div class="volume-grid">${volumeEntries.map(({volume:v,index:i,state,progress:p})=>{
          const c=v.coverThumb||v.cover||s.coverThumb||cover,pct=p?Math.round((Number(p.percentage)||0)*100):0,finished=state===reading.STATES.FINISHED;
          const stateMeta=finished?"Finished":state===reading.STATES.IN_PROGRESS?`${pct}% read`:"Unread";
          const action=reading.actionLabelForState(state);
          return `<article class="volume-card ${finished?"is-finished":""}" data-volume-index="${i}" data-reading-state="${esc(state)}">
            <div class="volume-cover">${c?`<img src="${esc(c)}" alt="${esc(v.title)} cover" loading="lazy" decoding="async" fetchpriority="low">`:""}${finished?'<span class="finished-volume-badge" title="Finished" aria-label="Finished">✓</span>':""}</div>
            <h3 class="volume-title">${esc(v.title||`Volume ${i+1}`)}</h3>
            <p class="volume-meta">${[v.date||"",fmtSize(v.size),stateMeta].filter(Boolean).join(" · ")}</p>
            <div class="volume-actions">
              <a class="read" data-volume-state="${esc(state)}" data-volume-index="${i}" data-volume-title="${esc(v.title||`Volume ${i+1}`)}" href="${domain.urls.readerUrl(v.file,s.id)}">${action}</a>
              <a class="download" href="#book-${esc(v.file)}" data-book-id="${esc(v.file)}" download>Download EPUB</a>
            </div>
          </article>`}).join("")}</div>
      </section>`;
    $("#pinButton")?.addEventListener("click",e=>{const on=!e.currentTarget.classList.contains("pinned");domain.preferences.setPinned(s.id,on);e.currentTarget.classList.toggle("pinned",on);e.currentTarget.textContent=on?"◆ Pinned":"◇ Pin to Garden"});
  }catch(e){
    console.error(e);
    const home=domain?.urls?.libraryUrl?.(requestedAdult)||(requestedAdult?"/nsfw.html":"/");
    $("#seriesRoot").innerHTML=`<section class="not-found"><span>PATH LOST</span><h1>This shelf has slipped into shadow.</h1><p>The Garden could not find this series among its living shelves.</p><a class="primary-button" href="${home}">Return to the Garden</a></section>`;
  }
}
init();