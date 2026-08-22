/* Shadow Garden v1.1.0 — Manage Library home + modal tools */
(()=>{
  const addDialog=document.querySelector("#addBooksDialog");
  const maintenanceDialog=document.querySelector("#maintenanceDialog");
  const addView=document.querySelector("#addView");
  const maintenanceView=document.querySelector("#maintenanceView");
  const batchList=document.querySelector("#batchList");
  if(!addDialog||!maintenanceDialog||!addView||!maintenanceView)return;

  state.addBookTarget=null;

  /* The dashboard no longer exists. Keep the legacy function names as compatibility hooks for
   * admin.js, but make Manage Library the permanent post-unlock home. */
  showDashboardHome=()=>{
    document.querySelector("#manageView")?.classList.remove("hidden");
    if(state.unlocked)void loadLibrary();
    window.scrollTo({top:0,behavior:"smooth"});
  };
  openAdminView=name=>{
    if(name==="add")openNewBooks();
    else if(name==="maintenance")openMaintenanceWindow();
    else showDashboardHome();
  };

  const baseApi=api;
  api=async(path,options={})=>{
    const target=state.addBookTarget;
    if(target&&path==="/admin-api/catalog"&&String(options.method||"GET").toUpperCase()==="POST"&&typeof options.body==="string"){
      try{
        const body=JSON.parse(options.body);
        body.targetSeriesId=target.id;
        body.series=target.title;
        body.adult=target.scope==="adult";
        if(!String(body.author||"").trim()&&target.author)body.author=target.author;
        options={...options,body:JSON.stringify(body)};
      }catch{}
    }
    return baseApi(path,options);
  };
  if(baseApi.__sgUploadResilient)api.__sgUploadResilient=true;

  function toast(message){
    if(typeof window.showAdminToast==="function")window.showAdminToast(message);
  }

  function resetBatchForContext(){
    const q=state.batch;
    if(!q)return;
    if(q.objectUrl){try{URL.revokeObjectURL(q.objectUrl)}catch{}}
    q.items.splice(0,q.items.length);
    q.activeId=null;
    q.library=null;
    q.objectUrl="";
    q.running=false;
    const panel=document.querySelector("#batchPanel");
    panel?.classList.add("hidden");
    const list=document.querySelector("#batchList");if(list)list.innerHTML="";
    document.querySelector("#metadataCard")?.classList.add("hidden");
    document.querySelector("#preflightCard")?.classList.add("hidden");
    document.querySelector("#uploadCard")?.classList.add("hidden");
    document.querySelector("#openSeries")?.classList.add("hidden");
    const upload=document.querySelector("#uploadButton");if(upload){upload.disabled=true;upload.textContent="Nothing to upload"}
    const picker=document.querySelector("#epubFile");if(picker)picker.value="";
    const title=document.querySelector("#filePickerTitle");if(title)title.textContent="Choose EPUBs from phone";
    const meta=document.querySelector("#filePickerMeta");if(meta)meta.textContent="Select one or many EPUBs · 50 MB maximum per file";
    if(typeof setFileState==="function")setFileState("WAITING");
  }

  function targetKey(target){return target?.id||""}
  function prepareContext(target){
    const q=state.batch;
    const previous=targetKey(state.addBookTarget),next=targetKey(target);
    if(q?.running){toast("Finish the current upload before changing the New Books window.");return false}
    if(q?.items?.length&&previous!==next){
      if(!confirm("Start a new upload session? The current New Books queue will be cleared."))return false;
      resetBatchForContext();
    }
    state.addBookTarget=target||null;
    syncTargetUi();
    return true;
  }

  function syncTargetUi(){
    const target=state.addBookTarget;
    const banner=document.querySelector("#addSeriesTarget");
    const seriesInput=document.querySelector("#seriesInput"),adultInput=document.querySelector("#adultInput");
    addDialog.classList.toggle("keeper-targeted",Boolean(target));
    banner?.classList.toggle("hidden",!target);
    if(target){
      document.querySelector("#addBooksHeading").textContent=`Add books to ${target.title}`;
      document.querySelector("#addSeriesTargetTitle").textContent=target.title;
      document.querySelector("#addSeriesTargetMeta").textContent=`Books selected in this window will be added directly to this ${target.scope==="adult"?"18+":"Main"} series.`;
      if(seriesInput){seriesInput.value=target.title;seriesInput.readOnly=true}
      if(adultInput){adultInput.checked=target.scope==="adult";adultInput.disabled=true}
    }else{
      document.querySelector("#addBooksHeading").textContent="Plant new seeds";
      if(seriesInput)seriesInput.readOnly=false;
      if(adultInput)adultInput.disabled=false;
    }
    forceTargetIntoBatch();
  }

  function forceTargetIntoBatch(){
    const target=state.addBookTarget,q=state.batch;
    if(!target||!q)return;
    for(const item of q.items){
      if(!item?.metaReady)continue;
      item.series=target.title;
      item.adult=target.scope==="adult";
      item.targetSeriesId=target.id;
      if(!String(item.author||"").trim()&&target.author)item.author=target.author;
    }
    const active=q.items.find(item=>item.id===q.activeId&&item.metaReady);
    if(active){
      q.editorSync=true;
      const seriesInput=document.querySelector("#seriesInput"),adultInput=document.querySelector("#adultInput"),authorInput=document.querySelector("#authorInput");
      if(seriesInput){seriesInput.value=target.title;seriesInput.readOnly=true}
      if(adultInput){adultInput.checked=target.scope==="adult";adultInput.disabled=true}
      if(authorInput&&!authorInput.value.trim()&&target.author)authorInput.value=target.author;
      const preview=document.querySelector("#previewSeries");if(preview)preview.textContent=`${target.title} · Volume ${active.number||"?"}`;
      q.editorSync=false;
    }
  }

  function openNewBooks(target=null){
    if(!prepareContext(target))return;
    addView.classList.remove("hidden");
    if(!addDialog.open)addDialog.showModal();
    requestAnimationFrame(()=>document.querySelector("#epubFile")?.focus({preventScroll:true}));
  }

  function openNewBooksForSeries(id){
    const found=findManagedSeries(id);
    if(!found)return;
    const target={id:found.series.id,title:found.series.title||"Untitled",author:found.series.author||"",scope:found.scope};
    openNewBooks(target);
  }
  window.openNewBooksForSeries=openNewBooksForSeries;

  function openMaintenanceWindow(){
    maintenanceView.classList.remove("hidden");
    if(!maintenanceDialog.open)maintenanceDialog.showModal();
    if(typeof window.loadMaintenance==="function")void window.loadMaintenance(true);
  }

  function closeAddBooks(){
    if(state.batch?.running){toast("The upload is still running. Keep the New Books window open until it finishes.");return}
    addDialog.close();
  }
  function closeMaintenance(){maintenanceDialog.close()}

  document.querySelector("#openNewBooks")?.addEventListener("click",()=>openNewBooks(null));
  document.querySelector("#openMaintenance")?.addEventListener("click",openMaintenanceWindow);
  document.querySelector("#closeAddBooks")?.addEventListener("click",closeAddBooks);
  document.querySelector("#closeMaintenance")?.addEventListener("click",closeMaintenance);
  addDialog.addEventListener("cancel",event=>{if(state.batch?.running){event.preventDefault();toast("The upload is still running.")}});

  document.querySelector("#lockButton")?.addEventListener("click",()=>{
    if(addDialog.open)addDialog.close();
    if(maintenanceDialog.open)maintenanceDialog.close();
  });

  /* Replace the card renderer with the same card design plus a direct Add book action. */
  renderManagerList=()=>{
    if(!state.management)return;
    const query=state.manageQuery.trim().toLowerCase();
    const items=managementSeries().filter(({series,scope})=>{
      if(state.manageScope!=="all"&&state.manageScope!==scope)return false;
      if(!query)return true;
      const hay=[series.title,series.author,...arr(series.tags),...arr(series.volumes).map(v=>v.title)].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(query);
    }).sort((a,b)=>String(a.series.title||"").localeCompare(String(b.series.title||"")));
    document.querySelector("#manageEmpty")?.classList.toggle("hidden",items.length>0);
    const list=document.querySelector("#seriesManagerList");if(!list)return;
    list.innerHTML=items.map(({series,scope})=>{
      const cover=series.cover||arr(series.volumes).find(v=>v.cover)?.cover||"";
      return `<article class="manager-card">
        <div class="manager-card-cover">${cover?`<img src="${esc(cover)}" alt="${esc(series.title)} cover" loading="lazy">`:`<span>✦</span>`}</div>
        <div class="manager-card-copy">
          <div class="manager-card-title"><div><strong>${esc(series.title||"Untitled")}</strong><span>${esc(series.author||"Unknown author")}</span></div><span class="manager-scope ${scope}">${scope==="adult"?"18+":"MAIN"}</span></div>
          <div class="manager-card-meta"><span>${arr(series.volumes).length} ${arr(series.volumes).length===1?"volume":"volumes"}</span>${series.year?`<span>${esc(series.year)}</span>`:""}${arr(series.tags)[0]?`<span>${esc(arr(series.tags)[0])}</span>`:""}</div>
          <div class="manager-card-actions">
            <button class="manager-add" type="button" data-manager-add="${esc(series.id)}">＋ Add book</button>
            <button class="admin-secondary manager-open" type="button" data-manager-open="${esc(series.id)}">Manage series</button>
          </div>
        </div>
      </article>`;
    }).join("");
  };

  document.querySelector("#seriesManagerList")?.addEventListener("click",event=>{
    const add=event.target.closest("[data-manager-add]");
    if(!add)return;
    event.preventDefault();
    event.stopPropagation();
    openNewBooksForSeries(add.dataset.managerAdd);
  });

  if(batchList){
    new MutationObserver(()=>queueMicrotask(forceTargetIntoBatch)).observe(batchList,{childList:true,subtree:true});
  }

  const uploadState=document.querySelector("#uploadState");
  if(uploadState){
    let last=uploadState.textContent;
    new MutationObserver(()=>{
      const next=uploadState.textContent;
      if(next!==last&&/^COMPLETE/.test(next)){
        last=next;
        state.management=null;
        if(state.unlocked)void loadLibrary(true);
      }else last=next;
    }).observe(uploadState,{childList:true,characterData:true,subtree:true});
  }

  /* If another script already loaded the management data, repaint it with the new card actions. */
  if(state.management)renderManagerList();
})();
