const $=s=>document.querySelector(s);
const scope=document.body.dataset.libraryScope||"main";
const arr=v=>Array.isArray(v)?v:[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validSorts=new Set(["recent","title","author","year","volumes"]);
const validVolumeRanges=new Set(["","1","2-5","6-10","11+"]);
const validReadingStatuses=new Set(["","finished","unfinished"]);
const storedView=localStorage.getItem(`sg-view:${scope}`);
let readingStatus=null;
const state={
  catalog:null,
  items:[],
  filtered:[],
  query:"",
  author:"",
  tags:new Set(),
  year:"",
  volumeRange:"",
  readingStatus:"",
  sort:"recent",
  pinnedOnly:false,
  view:storedView==="compact"?"compact":"grid",
  renderedCount:0,
  tagCounts:new Map(),
  observer:null,
  autoLoading:false
};
let searchTimer=0;

function normalize(value){return String(value??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function queryTokens(value){const matches=String(value||"").match(/"[^"]+"|\S+/g)||[];return matches.map(token=>normalize(token.replace(/^"|"$/g,""))).filter(Boolean)}
function pinnedIds(){try{return new Set(JSON.parse(localStorage.getItem("sg-pinned")||"[]"))}catch{return new Set()}}
function addedTime(value){return Date.parse(value||"")||0}
function latest(series){return Math.max(0,...arr(series.volumes).map(v=>addedTime(v.added)))}
function cover(series){return series.coverThumb||series.cover||series.volumes?.find(v=>v.coverThumb)?.coverThumb||series.volumes?.find(v=>v.cover)?.cover||""}
function volumeCover(series,volume){return volume?.coverThumb||volume?.cover||cover(series)}
function volumeCountMatches(count,range){if(!range)return true;if(range==="1")return count===1;if(range==="2-5")return count>=2&&count<=5;if(range==="6-10")return count>=6&&count<=10;if(range==="11+")return count>=11;return true}
function seriesHaystack(series){return normalize([series.title,series.author,series.description,...arr(series.tags),...arr(series.volumes).flatMap(volume=>[volume.title,volume.number,volume.year])].filter(Boolean).join(" "))}
function finishedSeries(series){return Boolean(readingStatus?.seriesFinished(series))}
function card(series,index=0){
  const c=cover(series),vols=arr(series.volumes).length,aboveFold=index<6,finished=finishedSeries(series);
  return `<a class="series-card ${finished?"is-finished":""}" href="/series.html?id=${encodeURIComponent(series.id)}">
    <div class="cover">
      ${c?`<img src="${esc(c)}" alt="${esc(series.title)} cover" loading="${aboveFold?"eager":"lazy"}" decoding="async" fetchpriority="${index<2?"high":"low"}" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">`:""}
      <div class="cover-fallback ${c?"hidden":""}">${esc(series.title)}</div>
      <span class="volume-pill">${vols} ${vols===1?"VOL":"VOLS"}</span>
      ${series.nsfw?`<span class="adult-pill">18+</span>`:""}
      ${finished?`<span class="finished-series-badge">✓ Finished</span>`:""}
    </div>
    <div class="card-copy">
      <h2>${esc(series.title)}</h2>
      <p>${esc(series.author||"Unknown author")}</p>
      <div class="card-meta"><span>${series.year||"—"}</span><span>${finished?"Finished":esc(arr(series.tags)[0]||"")}</span></div>
    </div>
  </a>`;
}
function formatDate(value){const time=addedTime(value);if(!time)return"Date unknown";try{return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(time))}catch{return String(value||"")}}
function recentCard(entry,index){
  const {series,volume}=entry,c=volumeCover(series,volume),finished=readingStatus?.isFinished(volume.file);
  const title=volume.title||`Volume ${volume.number??"—"}`;
  const badge=finished?"✓ FINISHED":volume.number!=null?`VOL ${volume.number}`:"NEW";
  const href=volume.file?`/reader.html?book=${encodeURIComponent(volume.file)}&series=${encodeURIComponent(series.id)}`:`/series.html?id=${encodeURIComponent(series.id)}`;
  return `<a class="recent-volume" href="${href}"><div class="recent-volume-cover">${c?`<img src="${esc(c)}" alt="${esc(title)} cover" loading="${index<4?"eager":"lazy"}" decoding="async" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">`:""}<div class="recent-volume-fallback ${c?"hidden":""}">${esc(title)}</div><span class="recent-volume-badge">${esc(badge)}</span></div><div class="recent-volume-copy"><strong>${esc(title)}</strong><span>${esc(series.title)} · ${esc(formatDate(volume.added))}</span></div></a>`;
}
function renderRecentlyAdded(){
  const recent=state.items.flatMap(series=>arr(series.volumes).map(volume=>({series,volume,time:addedTime(volume.added)}))).filter(entry=>entry.time>0).sort((a,b)=>b.time-a.time).slice(0,8);
  const section=$("#recentSection"),container=$("#recentVolumes");if(!section||!container)return;if(!recent.length){section.classList.add("hidden");return}container.innerHTML=recent.map(recentCard).join("");section.classList.remove("hidden");
}
function mountReadingStatusFilter(){
  if($("#readingStatusChips"))return;
  const anchor=$("#volumeCountSelect")?.closest(".filter-group")||$("#sortSelect")?.closest(".filter-group");
  if(!anchor)return;
  const group=document.createElement("div");
  group.className="filter-group filter-tags";
  group.innerHTML='<span class="filter-sub-label">Reading status</span><div id="readingStatusChips" class="genre-chips reading-status-chips"><button type="button" data-reading-status="finished">✓ Finished</button><button type="button" data-reading-status="unfinished">Unfinished</button></div>';
  anchor.after(group);
}
function collectFilters(){
  const authors=[...new Set(state.items.map(s=>String(s.author||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const years=[...new Set(state.items.map(s=>String(s.year||"")).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
  const counts=new Map();state.items.forEach(series=>new Set(arr(series.tags).map(String)).forEach(tag=>counts.set(tag,(counts.get(tag)||0)+1)));state.tagCounts=counts;
  const tags=[...counts.keys()].sort((a,b)=>a.localeCompare(b));
  $("#authorSelect").innerHTML=`<option value="">Any author</option>`+authors.map(author=>`<option value="${esc(author)}">${esc(author)}</option>`).join("");
  $("#yearSelect").innerHTML=`<option value="">Any year</option>`+years.map(year=>`<option value="${esc(year)}">${esc(year)}</option>`).join("");
  $("#tagSelect").innerHTML=`<option value="">Add a tag…</option>`+tags.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join("");
  const popular=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,16).map(([tag])=>tag);
  $("#genreChips").innerHTML=popular.map(tag=>`<button type="button" data-tag="${esc(tag)}">${esc(tag)}</button>`).join("");
  mountReadingStatusFilter();
}
function validateState(){
  const authors=new Set(state.items.map(s=>String(s.author||"").trim()).filter(Boolean)),years=new Set(state.items.map(s=>String(s.year||"")).filter(Boolean)),tags=new Set(state.items.flatMap(s=>arr(s.tags).map(String)));
  if(state.author&&!authors.has(state.author))state.author="";if(state.year&&!years.has(state.year))state.year="";state.tags=new Set([...state.tags].filter(tag=>tags.has(tag)));if(!validVolumeRanges.has(state.volumeRange))state.volumeRange="";if(!validReadingStatuses.has(state.readingStatus))state.readingStatus="";if(!validSorts.has(state.sort))state.sort="recent";if(!["grid","compact"].includes(state.view))state.view="grid";
}
function readUrl(){
  const params=new URLSearchParams(location.search);state.query=params.get("q")||"";state.author=params.get("author")||"";state.tags=new Set(params.getAll("tag").filter(Boolean));state.year=params.get("year")||"";state.volumeRange=params.get("vols")||"";state.readingStatus=validReadingStatuses.has(params.get("reading"))?params.get("reading"):"";state.sort=validSorts.has(params.get("sort"))?params.get("sort"):"recent";state.pinnedOnly=params.get("pinned")==="1";const view=params.get("view");if(view==="grid"||view==="compact")state.view=view;
}
function writeUrl(mode="replace"){
  const url=new URL(location.href),params=url.searchParams;["q","author","tag","year","vols","reading","sort","pinned","view"].forEach(key=>params.delete(key));if(state.query.trim())params.set("q",state.query.trim());if(state.author)params.set("author",state.author);[...state.tags].sort((a,b)=>a.localeCompare(b)).forEach(tag=>params.append("tag",tag));if(state.year)params.set("year",state.year);if(state.volumeRange)params.set("vols",state.volumeRange);if(state.readingStatus)params.set("reading",state.readingStatus);if(state.sort!=="recent")params.set("sort",state.sort);if(state.pinnedOnly)params.set("pinned","1");params.set("view",state.view);const next=`${url.pathname}${params.toString()?`?${params}`:""}${url.hash}`,current=`${location.pathname}${location.search}${location.hash}`;if(next===current)return;history[mode==="push"?"pushState":"replaceState"]({sgLibrary:true},"",next);
}
function renderActiveTags(){const container=$("#activeTags");if(!container)return;container.innerHTML=[...state.tags].sort((a,b)=>a.localeCompare(b)).map(tag=>`<button type="button" data-remove-tag="${esc(tag)}" title="Remove ${esc(tag)}">${esc(tag)} <span>×</span></button>`).join("");document.querySelectorAll("#genreChips button").forEach(button=>button.classList.toggle("active",state.tags.has(button.dataset.tag)))}
function syncControls(){
  if($("#searchInput"))$("#searchInput").value=state.query;if($("#authorSelect"))$("#authorSelect").value=state.author;if($("#yearSelect"))$("#yearSelect").value=state.year;if($("#volumeCountSelect"))$("#volumeCountSelect").value=state.volumeRange;if($("#sortSelect"))$("#sortSelect").value=state.sort;if($("#tagSelect"))$("#tagSelect").value="";$("#pinnedNav")?.classList.toggle("active",state.pinnedOnly);document.querySelectorAll(".view-switch button").forEach(button=>button.classList.toggle("active",button.dataset.view===state.view));document.querySelectorAll("#readingStatusChips [data-reading-status]").forEach(button=>button.classList.toggle("active",button.dataset.readingStatus===state.readingStatus));renderActiveTags();
}
function filterAndSort(){
  const tokens=queryTokens(state.query),pins=pinnedIds();
  state.filtered=state.items.filter(series=>{
    if(tokens.length){const haystack=seriesHaystack(series);if(!tokens.every(token=>haystack.includes(token)))return false}
    if(state.author&&String(series.author||"").trim()!==state.author)return false;
    const seriesTags=new Set(arr(series.tags).map(String));if([...state.tags].some(tag=>!seriesTags.has(tag)))return false;
    if(state.year&&String(series.year||"")!==state.year)return false;
    if(!volumeCountMatches(arr(series.volumes).length,state.volumeRange))return false;
    const finished=finishedSeries(series);if(state.readingStatus==="finished"&&!finished)return false;if(state.readingStatus==="unfinished"&&finished)return false;
    if(state.pinnedOnly&&!pins.has(series.id))return false;return true;
  });
  state.filtered.sort((a,b)=>{if(state.sort==="title")return String(a.title||"").localeCompare(String(b.title||""));if(state.sort==="author")return String(a.author||"").localeCompare(String(b.author||""))||String(a.title||"").localeCompare(String(b.title||""));if(state.sort==="year")return(Number(b.year)||0)-(Number(a.year)||0)||String(a.title||"").localeCompare(String(b.title||""));if(state.sort==="volumes")return arr(b.volumes).length-arr(a.volumes).length||String(a.title||"").localeCompare(String(b.title||""));return latest(b)-latest(a)||String(a.title||"").localeCompare(String(b.title||""))});
}
function batchSize(){return state.view==="compact"?60:36}
function updateResultCount(){const totalSeries=state.filtered.length,totalVolumes=state.filtered.reduce((n,s)=>n+arr(s.volumes).length,0),shown=Math.min(state.renderedCount,totalSeries);$("#resultCount").textContent=shown<totalSeries?`${shown} of ${totalSeries} series · ${totalVolumes} volumes`:`${totalSeries} series · ${totalVolumes} volumes`;const more=shown<totalSeries;$("#catalogSentinel")?.classList.toggle("hidden",!more);if($("#loadMore"))$("#loadMore").textContent=more?`Load ${Math.min(batchSize(),totalSeries-shown)} more`:"All results loaded"}
function appendBatch(){if(state.renderedCount>=state.filtered.length){updateResultCount();return}const start=state.renderedCount,end=Math.min(state.filtered.length,start+batchSize()),html=state.filtered.slice(start,end).map((series,index)=>card(series,start+index)).join("");$("#catalogGrid")?.insertAdjacentHTML("beforeend",html);state.renderedCount=end;updateResultCount()}
function apply({historyMode=null}={}){filterAndSort();state.renderedCount=0;const grid=$("#catalogGrid");if(grid){grid.innerHTML="";grid.classList.toggle("compact",state.view==="compact")}$("#emptyState")?.classList.toggle("hidden",state.filtered.length>0);if($("#emptyMessage"))$("#emptyMessage").textContent=state.items.length?"No series match these filters.":"No seeds have taken root in the Garden yet.";syncControls();appendBatch();if(historyMode)writeUrl(historyMode)}
function renderContinue(){
  const progress=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith("sg-progress:"))continue;try{const item=JSON.parse(localStorage.getItem(key));if(item?.updatedAt&&!readingStatus?.isFinished(item.file))progress.push(item)}catch{}}
  progress.sort((a,b)=>b.updatedAt-a.updatedAt);const allowedFiles=new Set(state.items.flatMap(series=>arr(series.volumes).map(volume=>volume.file))),saved=progress.find(item=>allowedFiles.has(item.file));const panel=$("#continuePanel");if(!saved){panel?.classList.add("hidden");return}const match=state.items.flatMap(series=>arr(series.volumes).map(volume=>({series,volume}))).find(item=>item.volume.file===saved.file);if(!match)return;panel.innerHTML=`<div class="continue-mark">✦</div><div><strong>${esc(match.volume.title)}</strong><span>${esc(match.series.title)} · ${Math.round((saved.percentage||0)*100)}%</span></div><a href="/reader.html?book=${encodeURIComponent(match.volume.file)}&series=${encodeURIComponent(match.series.id)}">Continue</a>`;panel.classList.remove("hidden");
}
function setupIncrementalRendering(){const sentinel=$("#catalogSentinel");if(!sentinel||typeof IntersectionObserver!=="function")return;state.observer=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting)||state.autoLoading||state.renderedCount>=state.filtered.length)return;state.autoLoading=true;requestAnimationFrame(()=>{appendBatch();setTimeout(()=>{state.autoLoading=false},120)})},{rootMargin:"800px 0px"});state.observer.observe(sentinel)}
function clearFilters({historyMode="push"}={}){state.query="";state.author="";state.tags=new Set();state.year="";state.volumeRange="";state.readingStatus="";state.sort="recent";state.pinnedOnly=false;apply({historyMode})}
function setupAdultGate(){if(scope!=="nsfw")return;const gate=$("#adultGate"),enter=$("#adultEnter"),reset=$("#adultReset"),accepted=localStorage.getItem("sg-adult-ack")==="1";gate?.classList.toggle("hidden",accepted);document.body.classList.toggle("adult-locked",!accepted);enter?.addEventListener("click",()=>{localStorage.setItem("sg-adult-ack","1");gate.classList.add("hidden");document.body.classList.remove("adult-locked");const ret=new URLSearchParams(location.search).get("return");if(ret&&ret.startsWith("/"))location.href=ret});reset?.addEventListener("click",()=>{localStorage.removeItem("sg-adult-ack");gate?.classList.remove("hidden");document.body.classList.add("adult-locked")})}
function bindControls(){
  $("#searchInput")?.addEventListener("input",event=>{state.query=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>apply({historyMode:"replace"}),120)});
  $("#authorSelect")?.addEventListener("change",event=>{state.author=event.target.value;apply({historyMode:"push"})});
  $("#yearSelect")?.addEventListener("change",event=>{state.year=event.target.value;apply({historyMode:"push"})});
  $("#volumeCountSelect")?.addEventListener("change",event=>{state.volumeRange=event.target.value;apply({historyMode:"push"})});
  $("#sortSelect")?.addEventListener("change",event=>{state.sort=event.target.value;apply({historyMode:"push"})});
  $("#tagSelect")?.addEventListener("change",event=>{const tag=event.target.value;if(tag)state.tags.add(tag);event.target.value="";apply({historyMode:"push"})});
  $("#genreChips")?.addEventListener("click",event=>{const button=event.target.closest("button[data-tag]");if(!button)return;const tag=button.dataset.tag;if(state.tags.has(tag))state.tags.delete(tag);else state.tags.add(tag);apply({historyMode:"push"})});
  document.querySelector(".filters")?.addEventListener("click",event=>{const button=event.target.closest("button[data-reading-status]");if(!button)return;const value=button.dataset.readingStatus;state.readingStatus=state.readingStatus===value?"":value;apply({historyMode:"push"})});
  $("#activeTags")?.addEventListener("click",event=>{const button=event.target.closest("button[data-remove-tag]");if(!button)return;state.tags.delete(button.dataset.removeTag);apply({historyMode:"push"})});
  $("#clearFilters")?.addEventListener("click",()=>clearFilters());$("#pinnedNav")?.addEventListener("click",()=>{state.pinnedOnly=!state.pinnedOnly;apply({historyMode:"push"})});
  document.querySelector(".view-switch")?.addEventListener("click",event=>{const button=event.target.closest("button[data-view]");if(!button)return;state.view=button.dataset.view;localStorage.setItem(`sg-view:${scope}`,state.view);apply({historyMode:"replace"})});
  $("#loadMore")?.addEventListener("click",appendBatch);$("#recentViewAll")?.addEventListener("click",()=>{clearFilters({historyMode:null});state.sort="recent";apply({historyMode:"push"});$("#catalogSection")?.scrollIntoView({behavior:"smooth",block:"start"})});
  window.addEventListener("popstate",()=>{readUrl();validateState();apply()});
  window.addEventListener("storage",event=>{if(event.key===readingStatus?.KEY){renderContinue();renderRecentlyAdded();apply()}});
}
async function init(){
  setupAdultGate();bindControls();readUrl();
  try{
    await import("/assets/js/reading-status.js?v=1.15.0");readingStatus=window.ShadowGardenReadingStatus;
    if(!window.ShadowGardenData)throw new Error("Catalog data source is unavailable");state.catalog=await window.ShadowGardenData.loadCatalog(scope==="nsfw");state.items=arr(state.catalog.series);$("#headerVolumes").textContent=state.items.reduce((n,series)=>n+arr(series.volumes).length,0);collectFilters();validateState();renderContinue();renderRecentlyAdded();setupIncrementalRendering();apply();
  }catch(error){console.error(error);$("#resultCount").textContent="Could not load catalog";$("#emptyState")?.classList.remove("hidden");if($("#emptyMessage"))$("#emptyMessage").textContent="The library catalog could not be reached."}
}
init();