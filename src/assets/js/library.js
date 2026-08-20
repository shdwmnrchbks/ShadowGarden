const $=s=>document.querySelector(s);
const scope=document.body.dataset.libraryScope||"main";
const state={catalog:null,items:[],filtered:[],query:"",genre:"",year:"",sort:"recent",pinnedOnly:false,view:localStorage.getItem(`sg-view:${scope}`)||"grid"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const arr=v=>Array.isArray(v)?v:[];

function pinnedIds(){try{return new Set(JSON.parse(localStorage.getItem("sg-pinned")||"[]"))}catch{return new Set()}}
function latest(series){return Math.max(0,...arr(series.volumes).map(v=>Date.parse(v.added||"1970-01-01")||0))}
function cover(series){return series.cover||series.volumes?.find(v=>v.cover)?.cover||""}
function card(series){
  const c=cover(series), vols=arr(series.volumes).length;
  return `<a class="series-card" href="/series.html?id=${encodeURIComponent(series.id)}">
    <div class="cover">
      ${c?`<img src="${esc(c)}" alt="${esc(series.title)} cover" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">`:""}
      <div class="cover-fallback ${c?"hidden":""}">${esc(series.title)}</div>
      <span class="volume-pill">${vols} ${vols===1?"VOL":"VOLS"}</span>
      ${series.nsfw?`<span class="adult-pill">18+</span>`:""}
    </div>
    <div class="card-copy">
      <h2>${esc(series.title)}</h2>
      <p>${esc(series.author||"Unknown author")}</p>
      <div class="card-meta"><span>${series.year||"—"}</span><span>${esc(arr(series.tags)[0]||"")}</span></div>
    </div>
  </a>`
}
function populate(){
  const genres=[...new Set(state.items.flatMap(s=>arr(s.tags)))].sort((a,b)=>a.localeCompare(b));
  $("#genreSelect").innerHTML=`<option value="">Any genre</option>`+genres.map(g=>`<option>${esc(g)}</option>`).join("");
  const years=[...new Set(state.items.map(s=>String(s.year||"")).filter(Boolean))].sort((a,b)=>b-a);
  $("#yearSelect").innerHTML=`<option value="">Any year</option>`+years.map(y=>`<option>${esc(y)}</option>`).join("");
  $("#genreChips").innerHTML=genres.slice(0,12).map(g=>`<button type="button" data-genre="${esc(g)}">${esc(g)}</button>`).join("");
}
function apply(){
  const q=state.query.trim().toLowerCase(), pins=pinnedIds();
  state.filtered=state.items.filter(s=>{
    const hay=[s.title,s.author,s.description,...arr(s.tags),...arr(s.volumes).map(v=>v.title)].filter(Boolean).join(" ").toLowerCase();
    return(!q||hay.includes(q))&&(!state.genre||arr(s.tags).includes(state.genre))&&(!state.year||String(s.year)===state.year)&&(!state.pinnedOnly||pins.has(s.id));
  });
  state.filtered.sort((a,b)=>{
    if(state.sort==="title")return a.title.localeCompare(b.title);
    if(state.sort==="year")return (b.year||0)-(a.year||0);
    if(state.sort==="volumes")return arr(b.volumes).length-arr(a.volumes).length;
    return latest(b)-latest(a);
  });
  $("#catalogGrid").innerHTML=state.filtered.map(card).join("");
  $("#catalogGrid").classList.toggle("compact",state.view==="compact");
  $("#resultCount").textContent=`${state.filtered.length} series · ${state.filtered.reduce((n,s)=>n+arr(s.volumes).length,0)} volumes`;
  $("#emptyState").classList.toggle("hidden",state.filtered.length>0);
  $("#emptyMessage").textContent=state.items.length?"No series match these filters.":"No seeds have taken root in the Garden yet.";
  document.querySelectorAll("#genreChips button").forEach(b=>b.classList.toggle("active",b.dataset.genre===state.genre));
  document.querySelectorAll(".view-switch button").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
}
function renderContinue(){
  const progress=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(!k?.startsWith("sg-progress:"))continue;
    try{const p=JSON.parse(localStorage.getItem(k));if(p?.updatedAt)progress.push(p)}catch{}
  }
  progress.sort((a,b)=>b.updatedAt-a.updatedAt);
  const allowedFiles=new Set(state.items.flatMap(s=>arr(s.volumes).map(v=>v.file)));
  const p=progress.find(x=>allowedFiles.has(x.file));
  if(!p)return;
  const vol=state.items.flatMap(s=>arr(s.volumes).map(v=>({s,v}))).find(x=>x.v.file===p.file);
  if(!vol)return;
  $("#continuePanel").innerHTML=`<div class="continue-mark">✦</div><div><strong>${esc(vol.v.title)}</strong><span>${esc(vol.s.title)} · ${Math.round((p.percentage||0)*100)}%</span></div><a href="/reader.html?book=${encodeURIComponent(vol.v.file)}&series=${encodeURIComponent(vol.s.id)}">Continue</a>`;
  $("#continuePanel").classList.remove("hidden");
}
function setupAdultGate(){
  if(scope!=="nsfw")return;
  const gate=$("#adultGate"),enter=$("#adultEnter"),reset=$("#adultReset");
  const accepted=localStorage.getItem("sg-adult-ack")==="1";
  gate?.classList.toggle("hidden",accepted);
  document.body.classList.toggle("adult-locked",!accepted);
  enter?.addEventListener("click",()=>{
    localStorage.setItem("sg-adult-ack","1");
    gate.classList.add("hidden");document.body.classList.remove("adult-locked");
    const ret=new URLSearchParams(location.search).get("return");
    if(ret&&ret.startsWith("/"))location.href=ret;
  });
  reset?.addEventListener("click",()=>{localStorage.removeItem("sg-adult-ack");gate?.classList.remove("hidden");document.body.classList.add("adult-locked")});
}
async function init(){
  setupAdultGate();
  try{
    if(!window.ShadowGardenData)throw new Error("Catalog data source is unavailable");
    state.catalog=await window.ShadowGardenData.loadCatalog(scope==="nsfw");
    state.items=arr(state.catalog.series);
    $("#headerVolumes").textContent=state.items.reduce((n,s)=>n+arr(s.volumes).length,0);
    populate();renderContinue();apply();
  }catch(e){console.error(e);$("#resultCount").textContent="Could not load catalog";$("#emptyState").classList.remove("hidden");$("#emptyMessage").textContent="The library catalog could not be reached."}
}
$("#searchInput")?.addEventListener("input",e=>{state.query=e.target.value;apply()});
$("#genreSelect")?.addEventListener("change",e=>{state.genre=e.target.value;apply()});
$("#yearSelect")?.addEventListener("change",e=>{state.year=e.target.value;apply()});
$("#sortSelect")?.addEventListener("change",e=>{state.sort=e.target.value;apply()});
$("#clearFilters")?.addEventListener("click",()=>{state.query=state.genre=state.year="";state.sort="recent";state.pinnedOnly=false;$("#searchInput").value="";$("#genreSelect").value="";$("#yearSelect").value="";$("#sortSelect").value="recent";$("#pinnedNav")?.classList.remove("active");apply()});
$("#genreChips")?.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;state.genre=state.genre===b.dataset.genre?"":b.dataset.genre;$("#genreSelect").value=state.genre;apply()});
$("#pinnedNav")?.addEventListener("click",()=>{state.pinnedOnly=!state.pinnedOnly;$("#pinnedNav").classList.toggle("active",state.pinnedOnly);apply()});
document.querySelector(".view-switch")?.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;state.view=b.dataset.view;localStorage.setItem(`sg-view:${scope}`,state.view);apply()});
init();
