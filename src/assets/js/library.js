/* Shadow Garden R3 — Library controller. Query state, rendering, and volume actions have explicit owners. */
(async()=>{
  const $=selector=>document.querySelector(selector);
  const scope=document.body.dataset.libraryScope||"main";
  const arr=value=>Array.isArray(value)?value:[];
  const state={catalog:null,items:[],filtered:[],query:"",author:"",tags:new Set(),year:"",volumeRange:"",readingStatus:"",sort:"recent",pinnedOnly:false,view:"grid",renderedCount:0,observer:null,autoLoading:false};
  const mobileFilterQuery=window.matchMedia("(max-width: 720px)");
  let searchTimer=0;

  const domain=await import("/assets/js/domain/index.js");
  const model=await import("/assets/js/library-model.js");
  const renderers=await import("/assets/js/library-renderers.js");
  const {installVolumeActionController}=await import("/assets/js/public/volume-actions.js");
  const readingStatus=domain.readingState;
  installVolumeActionController(document);

  const esc=domain.format.escapeHtml;
  const dependencies={...domain,readingState:readingStatus};

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
    const options=model.filterOptions(state.items);
    $("#authorSelect").innerHTML='<option value="">Any author</option>'+options.authors.map(author=>`<option value="${esc(author)}">${esc(author)}</option>`).join("");
    $("#yearSelect").innerHTML='<option value="">Any year</option>'+options.years.map(year=>`<option value="${esc(year)}">${esc(year)}</option>`).join("");
    $("#tagSelect").innerHTML='<option value="">Add a tag…</option>'+options.tags.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join("");
    $("#genreChips").innerHTML=options.popularTags.map(tag=>`<button type="button" data-tag="${esc(tag)}">${esc(tag)}</button>`).join("");
    mountReadingStatusFilter();
  }

  function readUrl(){
    const params=new URLSearchParams(location.search);
    state.query=params.get("q")||"";
    state.author=params.get("author")||"";
    state.tags=new Set(params.getAll("tag").filter(Boolean));
    state.year=params.get("year")||"";
    state.volumeRange=params.get("vols")||"";
    state.readingStatus=model.VALID_READING_STATUSES.has(params.get("reading"))?params.get("reading"):"";
    state.sort=model.VALID_SORTS.has(params.get("sort"))?params.get("sort"):"recent";
    state.pinnedOnly=params.get("pinned")==="1";
    const view=params.get("view");
    if(view==="grid"||view==="compact")state.view=view;
  }

  function writeUrl(mode="replace"){
    const url=new URL(location.href),params=url.searchParams;
    ["q","author","tag","year","vols","reading","sort","pinned","view"].forEach(key=>params.delete(key));
    if(state.query.trim())params.set("q",state.query.trim());
    if(state.author)params.set("author",state.author);
    [...state.tags].sort((a,b)=>a.localeCompare(b)).forEach(tag=>params.append("tag",tag));
    if(state.year)params.set("year",state.year);
    if(state.volumeRange)params.set("vols",state.volumeRange);
    if(state.readingStatus)params.set("reading",state.readingStatus);
    if(state.sort!=="recent")params.set("sort",state.sort);
    if(state.pinnedOnly)params.set("pinned","1");
    params.set("view",state.view);
    const next=`${url.pathname}${params.toString()?`?${params}`:""}${url.hash}`,current=`${location.pathname}${location.search}${location.hash}`;
    if(next===current)return;
    history[mode==="push"?"pushState":"replaceState"]({sgLibrary:true},"",next);
  }

  function hasActiveResultFilter(){
    return Boolean(state.query.trim()||state.author||state.tags.size||state.year||state.volumeRange||state.readingStatus||state.pinnedOnly);
  }

  function syncMobileResultFocus(){
    $("#recentSection")?.classList.toggle("mobile-results-focus",mobileFilterQuery.matches&&hasActiveResultFilter());
  }

  function filterPill(label,key,title=label){
    return `<button type="button" data-clear-filter="${esc(key)}" title="Remove ${esc(title)}"><span class="active-filter-pill-label">${esc(label)}</span><span class="active-filter-remove" aria-hidden="true">×</span></button>`;
  }

  function tagPill(tag){
    return `<button type="button" data-remove-tag="${esc(tag)}" title="Remove ${esc(tag)}"><span class="active-filter-pill-label">${esc(tag)}</span><span class="active-filter-remove" aria-hidden="true">×</span></button>`;
  }

  function renderActiveFilters(){
    const container=$("#activeTags");
    if(!container)return;
    const pills=[];
    if(state.author)pills.push(filterPill(`Author: ${state.author}`,"author",`author filter ${state.author}`));
    if(state.year)pills.push(filterPill(`Year: ${state.year}`,"year",`year filter ${state.year}`));
    if(state.volumeRange){
      const labels={"1":"Single volume","2-5":"2–5 volumes","6-10":"6–10 volumes","11+":"11+ volumes"};
      pills.push(filterPill(`Volumes: ${labels[state.volumeRange]||state.volumeRange}`,"volumeRange","volume filter"));
    }
    if(state.readingStatus)pills.push(filterPill(`Reading: ${state.readingStatus==="finished"?"Finished":"Unfinished"}`,"readingStatus","reading status filter"));
    if(state.pinnedOnly)pills.push(filterPill("Pinned only","pinnedOnly","pinned-only filter"));
    [...state.tags].sort((a,b)=>a.localeCompare(b)).forEach(tag=>pills.push(tagPill(tag)));
    container.innerHTML=pills.join("");
    document.querySelectorAll("#genreChips button").forEach(button=>button.classList.toggle("active",state.tags.has(button.dataset.tag)));
  }

  function clearNamedFilter(key){
    if(key==="author")state.author="";
    else if(key==="year")state.year="";
    else if(key==="volumeRange")state.volumeRange="";
    else if(key==="readingStatus")state.readingStatus="";
    else if(key==="pinnedOnly")state.pinnedOnly=false;
    else return false;
    return true;
  }

  function syncControls(){
    if($("#searchInput"))$("#searchInput").value=state.query;
    if($("#authorSelect"))$("#authorSelect").value=state.author;
    if($("#yearSelect"))$("#yearSelect").value=state.year;
    if($("#volumeCountSelect"))$("#volumeCountSelect").value=state.volumeRange;
    if($("#sortSelect"))$("#sortSelect").value=state.sort;
    if($("#tagSelect"))$("#tagSelect").value="";
    $("#pinnedNav")?.classList.toggle("active",state.pinnedOnly);
    document.querySelectorAll(".view-switch button").forEach(button=>{const active=button.dataset.view===state.view;button.classList.toggle("active",active);button.setAttribute("aria-pressed",active?"true":"false")});
    document.querySelectorAll("#readingStatusChips [data-reading-status]").forEach(button=>button.classList.toggle("active",button.dataset.readingStatus===state.readingStatus));
    renderActiveFilters();
    syncMobileResultFocus();
  }

  function batchSize(){return state.view==="compact"?60:36}

  function updateResultCount(){
    const totalSeries=state.filtered.length,totalVolumes=state.filtered.reduce((count,series)=>count+arr(series.volumes).length,0),shown=Math.min(state.renderedCount,totalSeries);
    $("#resultCount").textContent=shown<totalSeries?`${shown} of ${totalSeries} series · ${totalVolumes} volumes`:`${totalSeries} series · ${totalVolumes} volumes`;
    const more=shown<totalSeries;
    $("#catalogSentinel")?.classList.toggle("hidden",!more);
    if($("#loadMore"))$("#loadMore").textContent=more?`Load ${Math.min(batchSize(),totalSeries-shown)} more`:"All results loaded";
  }

  function appendBatch(){
    if(state.renderedCount>=state.filtered.length){updateResultCount();return}
    const start=state.renderedCount,end=Math.min(state.filtered.length,start+batchSize());
    const html=state.filtered.slice(start,end).map((series,index)=>renderers.seriesCard(series,start+index,dependencies)).join("");
    $("#catalogGrid")?.insertAdjacentHTML("beforeend",html);
    state.renderedCount=end;
    updateResultCount();
  }

  function apply({historyMode=null,preserveCount=false}={}){
    const previousCount=preserveCount?state.renderedCount:0;
    state.filtered=model.filterAndSort(state.items,state,{pinnedIds:domain.preferences.pinnedIds(),seriesFinished:readingStatus.seriesFinished});
    state.renderedCount=0;
    const grid=$("#catalogGrid");
    if(grid){grid.innerHTML="";grid.classList.toggle("compact",state.view==="compact")}
    $("#emptyState")?.classList.toggle("hidden",state.filtered.length>0);
    if($("#emptyMessage"))$("#emptyMessage").textContent=state.items.length?"No series match these filters.":"No seeds have taken root in the Garden yet.";
    syncControls();
    const target=Math.max(batchSize(),previousCount);
    do{appendBatch()}while(state.renderedCount<Math.min(target,state.filtered.length));
    if(historyMode)writeUrl(historyMode);
  }

  function renderRecentlyAdded(){
    renderers.renderRecentlyAdded($("#recentSection"),$("#recentVolumes"),model.recentlyAdded(state.items),dependencies);
  }

  function renderContinue(){
    const current=readingStatus.latestActiveEntry(state.items);
    renderers.renderReadingBanner($("#continuePanel"),document.querySelector(".library-intro"),current,dependencies);
  }

  function refreshReadingUi(){
    if(!state.items.length)return;
    renderContinue();
    renderRecentlyAdded();
    apply({preserveCount:true});
  }

  function setupIncrementalRendering(){
    const sentinel=$("#catalogSentinel");
    if(!sentinel||typeof IntersectionObserver!=="function")return;
    state.observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting)||state.autoLoading||state.renderedCount>=state.filtered.length)return;
      state.autoLoading=true;
      requestAnimationFrame(()=>{appendBatch();setTimeout(()=>{state.autoLoading=false},120)});
    },{rootMargin:"800px 0px"});
    state.observer.observe(sentinel);
  }

  function clearFilters({historyMode="push"}={}){
    state.query="";state.author="";state.tags=new Set();state.year="";state.volumeRange="";state.readingStatus="";state.sort="recent";state.pinnedOnly=false;
    apply({historyMode});
  }

  function setupAdultGate(){
    if(scope!=="nsfw")return;
    const gate=$("#adultGate"),enter=$("#adultEnter"),reset=$("#adultReset"),accepted=domain.preferences.adultAcknowledged();
    gate?.classList.toggle("hidden",accepted);document.body.classList.toggle("adult-locked",!accepted);
    enter?.addEventListener("click",()=>{domain.preferences.setAdultAcknowledged(true);gate?.classList.add("hidden");document.body.classList.remove("adult-locked");const ret=new URLSearchParams(location.search).get("return");if(ret&&ret.startsWith("/"))location.href=ret});
    reset?.addEventListener("click",()=>{domain.preferences.setAdultAcknowledged(false);gate?.classList.remove("hidden");document.body.classList.add("adult-locked")});
  }

  function bindControls(){
    $("#searchInput")?.addEventListener("input",event=>{state.query=event.target.value;syncMobileResultFocus();clearTimeout(searchTimer);searchTimer=setTimeout(()=>apply({historyMode:"replace"}),120)});
    $("#authorSelect")?.addEventListener("change",event=>{state.author=event.target.value;apply({historyMode:"push"})});
    $("#yearSelect")?.addEventListener("change",event=>{state.year=event.target.value;apply({historyMode:"push"})});
    $("#volumeCountSelect")?.addEventListener("change",event=>{state.volumeRange=event.target.value;apply({historyMode:"push"})});
    $("#sortSelect")?.addEventListener("change",event=>{state.sort=event.target.value;apply({historyMode:"push"})});
    $("#tagSelect")?.addEventListener("change",event=>{const tag=event.target.value;if(tag)state.tags.add(tag);event.target.value="";apply({historyMode:"push"})});
    $("#genreChips")?.addEventListener("click",event=>{const button=event.target.closest("button[data-tag]");if(!button)return;const tag=button.dataset.tag;if(state.tags.has(tag))state.tags.delete(tag);else state.tags.add(tag);apply({historyMode:"push"})});
    document.querySelector(".filters")?.addEventListener("click",event=>{const button=event.target.closest("button[data-reading-status]");if(!button)return;const value=button.dataset.readingStatus;state.readingStatus=state.readingStatus===value?"":value;apply({historyMode:"push"})});
    $("#activeTags")?.addEventListener("click",event=>{
      const tagButton=event.target.closest("button[data-remove-tag]");
      if(tagButton){state.tags.delete(tagButton.dataset.removeTag);apply({historyMode:"push"});return}
      const filterButton=event.target.closest("button[data-clear-filter]");
      if(filterButton&&clearNamedFilter(filterButton.dataset.clearFilter))apply({historyMode:"push"});
    });
    $("#clearFilters")?.addEventListener("click",()=>clearFilters());
    $("#pinnedNav")?.addEventListener("click",()=>{state.pinnedOnly=!state.pinnedOnly;apply({historyMode:"push"})});
    document.querySelector(".view-switch")?.addEventListener("click",event=>{const button=event.target.closest("button[data-view]");if(!button)return;state.view=button.dataset.view;domain.preferences.setLibraryView(scope,state.view);apply({historyMode:"replace"})});
    $("#loadMore")?.addEventListener("click",appendBatch);
    $("#recentViewAll")?.addEventListener("click",()=>{clearFilters({historyMode:null});state.sort="recent";apply({historyMode:"push"});$("#catalogSection")?.scrollIntoView({behavior:"smooth",block:"start"})});
    window.addEventListener("popstate",()=>{readUrl();model.validateFilterState(state,state.items);apply()});
    window.addEventListener(readingStatus.EVENT,refreshReadingUi);
    window.addEventListener("pageshow",refreshReadingUi);
    if(typeof mobileFilterQuery.addEventListener==="function")mobileFilterQuery.addEventListener("change",syncMobileResultFocus);
    else mobileFilterQuery.addListener?.(syncMobileResultFocus);
    window.addEventListener("storage",event=>{
      if(readingStatus.isReadingStorageKey(event.key)){refreshReadingUi();return}
      if(domain.preferences.isPreferenceStorageKey(event.key)){
        if(event.key===domain.preferences.viewKey(scope))state.view=domain.preferences.libraryView(scope);
        apply({preserveCount:true});
      }
    });
  }

  try{
    state.view=domain.preferences.libraryView(scope);
    setupAdultGate();
    bindControls();
    readUrl();
    if(!window.ShadowGardenData)throw new Error("Catalog data source is unavailable");
    state.catalog=await window.ShadowGardenData.loadCatalog(scope==="nsfw");
    state.items=arr(state.catalog.series);
    $("#headerVolumes").textContent=state.items.reduce((count,series)=>count+arr(series.volumes).length,0);
    collectFilters();
    model.validateFilterState(state,state.items);
    renderContinue();
    renderRecentlyAdded();
    setupIncrementalRendering();
    apply();
  }catch(error){
    console.error(error);
    $("#resultCount").textContent="Could not load catalog";
    $("#emptyState")?.classList.remove("hidden");
    if($("#emptyMessage"))$("#emptyMessage").textContent="The library catalog could not be reached.";
  }
})();
