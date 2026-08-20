/* Shadow Garden v0.12 — Garden Maintenance */
(()=>{
  const maintenance={data:null,loading:false,optimizing:false,deepChecking:false};
  const view=$("#maintenanceView");
  if(!view)return;

  const fmtDate=value=>{
    if(!value)return"Unknown time";
    try{return new Date(value).toLocaleString()}catch{return String(value)}
  };
  const safe=value=>esc(String(value??""));
  const arrLocal=value=>Array.isArray(value)?value:[];

  function setPill(element,text,kind=""){
    if(!element)return;
    element.textContent=text;
    element.className=`state-pill ${kind}`.trim();
  }

  function setProgress(element,text,percent){
    if(!element)return;
    element.classList.remove("hidden");
    element.style.setProperty("--maintenance-progress",`${Math.max(0,Math.min(100,Number(percent)||0))}%`);
    element.innerHTML=`<span>${safe(text)}</span>`;
  }

  function hideProgress(element){
    if(!element)return;
    element.classList.add("hidden");
    element.style.removeProperty("--maintenance-progress");
  }

  async function maintenanceApi(action,payload={}){
    return api("/admin-api/maintenance",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({action,...payload})
    });
  }

  function openMaintenance(){
    $("#manageView")?.classList.add("hidden");
    $("#addView")?.classList.add("hidden");
    view.classList.remove("hidden");
    loadMaintenance();
  }

  function closeMaintenance(){view.classList.add("hidden")}

  $("#dashboardChoices")?.addEventListener("click",event=>{
    const button=event.target.closest("[data-admin-view]");
    if(!button)return;
    if(button.dataset.adminView==="maintenance")openMaintenance();
    else closeMaintenance();
  });
  $("[data-maintenance-back]")?.addEventListener("click",closeMaintenance);
  $("#lockButton")?.addEventListener("click",closeMaintenance);

  function renderSummary(data){
    const health=data?.health||{};
    const counts=health.counts||{};
    const metrics=health.metrics||{};
    $("#maintenanceSeries").textContent=counts.series??0;
    $("#maintenanceVolumes").textContent=counts.volumes??0;
    $("#maintenanceLegacyCovers").textContent=metrics.missingThumbs??0;
    $("#maintenanceTrashCount").textContent=metrics.trashItems??0;
  }

  function metric(label,value){return `<div class="maintenance-metric"><strong>${safe(value)}</strong><span>${safe(label)}</span></div>`}

  function renderHealth(data,deep=null){
    const health=data?.health||{};
    const metrics=health.metrics||{};
    const issues=[...arrLocal(health.issues)];
    if(deep?.missing?.length){
      for(const item of deep.missing)issues.unshift({severity:"error",title:"B2 object missing",detail:item.key,code:"missing-object"});
    }
    const state=deep?.missing?.length?"attention":health.status||"healthy";
    if(state==="healthy")setPill($("#gardenHealthState"),"HEALTHY","ready");
    else if(state==="warning")setPill($("#gardenHealthState"),"CHECK","ready");
    else setPill($("#gardenHealthState"),"ATTENTION","error");

    $("#gardenHealthMetrics").innerHTML=[
      metric("Referenced objects",metrics.referencedObjects??0),
      metric("Missing covers",metrics.missingCovers??0),
      metric("Missing thumbnails",metrics.missingThumbs??0),
      metric("Legacy identity data",metrics.legacyIdentity??0),
      ...(deep?[metric("B2 checked",deep.checked??0),metric("B2 missing",deep.missing?.length??0)]:[])
    ].join("");

    const list=$("#gardenHealthIssues");
    if(!issues.length){list.innerHTML='<div class="maintenance-empty maintenance-good">No catalog health issues found.</div>';return}
    const rank={error:0,warning:1,info:2};
    const sorted=issues.sort((a,b)=>(rank[a.severity]??3)-(rank[b.severity]??3)).slice(0,100);
    list.innerHTML=sorted.map(issue=>`<div class="maintenance-item health-issue" data-severity="${safe(issue.severity||"info")}">
      <span class="health-mark">${issue.severity==="error"?"!":issue.severity==="warning"?"△":"i"}</span>
      <div class="maintenance-item-copy"><strong>${safe(issue.title||issue.code||"Health note")}</strong><span>${safe(issue.detail||"")}</span></div>
    </div>`).join("")+(issues.length>100?`<div class="maintenance-empty">${issues.length-100} additional health notes are not shown.</div>`:"");
  }

  function renderCoverMaintenance(data){
    const candidates=arrLocal(data?.health?.optimizationCandidates);
    const stateEl=$("#coverMaintenanceState"),detail=$("#coverMaintenanceDetail"),button=$("#optimizeLegacyCovers");
    if(!candidates.length){
      setPill(stateEl,"CURRENT","ready");
      detail.innerHTML='<span class="maintenance-good">All cataloged covers already have lightweight thumbnails.</span>';
      button.disabled=true;
      button.textContent="Covers are current";
      return;
    }
    setPill(stateEl,`${candidates.length} FOUND`);
    detail.textContent=`${candidates.length} legacy cover${candidates.length===1?"":"s"} can be upgraded to a ~1000px WebP detail image plus a 480px WebP thumbnail.`;
    button.disabled=maintenance.optimizing;
    button.textContent=maintenance.optimizing?"Optimizing…":`Optimize ${candidates.length} legacy cover${candidates.length===1?"":"s"}`;
  }

  function renderBackups(data){
    const backups=arrLocal(data?.backups);
    $("#backupCount").textContent=String(backups.length);
    const list=$("#backupList");
    if(!backups.length){list.innerHTML='<div class="maintenance-empty">No catalog backups yet.</div>';return}
    list.innerHTML=backups.map(item=>`<div class="maintenance-item">
      <div class="maintenance-item-copy"><strong>${safe(item.reason||"Catalog backup")}</strong><span>${safe(fmtDate(item.createdAt))}</span><span class="backup-meta"><i>${safe(item.counts?.mainSeries??0)} main</i><i>${safe(item.counts?.adultSeries??0)} 18+</i><i>${safe(item.counts?.volumes??0)} volumes</i></span></div>
      <div class="maintenance-item-actions"><button class="admin-secondary" type="button" data-restore-backup="${safe(item.id)}">Restore</button></div>
    </div>`).join("");
  }

  function renderTrash(data){
    const trash=arrLocal(data?.trash);
    $("#trashCount").textContent=String(trash.length);
    const list=$("#trashList"),purgeAll=$("#purgeAllTrash");
    purgeAll.disabled=!trash.length;
    if(!trash.length){list.innerHTML='<div class="maintenance-empty maintenance-good">Trash is empty.</div>';return}
    list.innerHTML=trash.map(item=>`<div class="maintenance-item">
      <div class="maintenance-item-copy"><strong>${safe(item.title||"Deleted item")}</strong><span>${safe(item.subtitle||"")}</span><span class="trash-meta"><i>${item.type==="series"?"Series":"Volume"}</i><i>${item.scope==="adult"?"18+":"Main"}</i><i>${safe(fmtDate(item.removedAt))}</i></span></div>
      <div class="maintenance-item-actions"><button class="admin-secondary" type="button" data-restore-trash="${safe(item.id)}">Restore</button><button class="danger-button" type="button" data-purge-trash="${safe(item.id)}">Purge</button></div>
    </div>`).join("");
  }

  function renderMaintenance(data){
    maintenance.data=data;
    renderSummary(data);
    renderHealth(data);
    renderCoverMaintenance(data);
    renderBackups(data);
    renderTrash(data);
  }

  async function loadMaintenance(force=false){
    if(maintenance.loading)return;
    if(maintenance.data&&!force){renderMaintenance(maintenance.data);return}
    maintenance.loading=true;
    setPill($("#gardenHealthState"),"LOADING");
    try{
      const data=await api("/admin-api/maintenance",{method:"GET"});
      renderMaintenance(data);
    }catch(error){
      console.error("Garden Maintenance load failed",error);
      setPill($("#gardenHealthState"),"FAILED","error");
      $("#gardenHealthIssues").innerHTML=`<div class="maintenance-empty maintenance-bad">${safe(error.message)}</div>`;
    }finally{maintenance.loading=false}
  }
  window.loadMaintenance=loadMaintenance;

  async function deepHealthCheck(){
    if(maintenance.deepChecking||!maintenance.data)return;
    const keys=arrLocal(maintenance.data.health?.objectKeys);
    if(!keys.length){alert("There are no cataloged B2 objects to check.");return}
    maintenance.deepChecking=true;
    const button=$("#deepHealthCheck");button.disabled=true;button.textContent="Checking B2…";
    const progress=$("#deepHealthProgress"),missing=[];
    let checked=0;
    try{
      for(let index=0;index<keys.length;index+=25){
        const batch=keys.slice(index,index+25);
        setProgress(progress,`Checking B2 objects ${checked+1}–${Math.min(keys.length,checked+batch.length)} of ${keys.length}…`,checked/keys.length*100);
        const result=await maintenanceApi("check-objects",{keys:batch});
        checked+=Number(result.checked)||batch.length;
        missing.push(...arrLocal(result.missing));
      }
      setProgress(progress,missing.length?`${missing.length} missing B2 object${missing.length===1?"":"s"} found.`:`All ${checked} referenced B2 objects were found.`,100);
      renderHealth(maintenance.data,{checked,missing});
    }catch(error){
      console.error(error);setProgress(progress,`Deep check failed: ${error.message}`,0);
    }finally{
      maintenance.deepChecking=false;button.disabled=false;button.textContent="Deep B2 check";
    }
  }

  async function optimizeLegacyCovers(){
    if(maintenance.optimizing||!maintenance.data)return;
    const candidates=arrLocal(maintenance.data.health?.optimizationCandidates);
    if(!candidates.length)return;
    if(typeof optimizedCoverSet!=="function"){alert("Cover optimizer is unavailable. Reload Garden Keeper and try again.");return}
    if(!confirm(`Optimize ${candidates.length} legacy cover${candidates.length===1?"":"s"}? New WebP derivatives will be uploaded and the catalogs will be backed up before they are applied.`))return;

    maintenance.optimizing=true;
    renderCoverMaintenance(maintenance.data);
    const progress=$("#coverMaintenanceProgress"),updates=[],cache=new Map(),failures=[];
    let wakeLock=null;try{wakeLock=await navigator.wakeLock?.request("screen")}catch{}
    try{
      for(let index=0;index<candidates.length;index++){
        const candidate=candidates[index];
        setProgress(progress,`Optimizing ${index+1}/${candidates.length}: ${candidate.seriesTitle} — ${candidate.volumeTitle}`,index/candidates.length*100);
        try{
          let uploaded=cache.get(candidate.source);
          if(!uploaded){
            const response=await fetch(candidate.source,{cache:"no-store"});
            if(!response.ok)throw new Error(`Could not fetch source cover (${response.status})`);
            const sourceBlob=await response.blob();
            const variants=await optimizedCoverSet(sourceBlob);
            if(!variants?.thumb||variants.detail?.type!=="image/webp")throw new Error("This browser could not create WebP cover derivatives");
            const hash=await hash8(sourceBlob),seriesPart=slug(candidate.seriesId||candidate.seriesTitle),part=candidate.volumeIndex===null?"series":`v${candidate.volumeIndex+1}`;
            const coverKey=`shadow-garden/covers/${seriesPart}-${part}-${hash}-maintenance-detail.webp`;
            const coverThumbKey=`shadow-garden/covers/${seriesPart}-${part}-${hash}-maintenance-thumb.webp`;
            await uploadObject(coverKey,variants.detail,"image/webp");
            await uploadObject(coverThumbKey,variants.thumb,"image/webp");
            uploaded={coverKey,coverThumbKey};cache.set(candidate.source,uploaded);
          }
          updates.push({scope:candidate.scope,seriesId:candidate.seriesId,volumeIndex:candidate.volumeIndex,volumeFile:candidate.volumeFile||"",...uploaded});
        }catch(error){
          console.error("Legacy cover optimization failed",candidate,error);failures.push(`${candidate.seriesTitle} — ${candidate.volumeTitle}: ${error.message}`);
        }
      }
      if(updates.length){
        setProgress(progress,`Applying ${updates.length} optimized cover update${updates.length===1?"":"s"} to the catalogs…`,96);
        const result=await maintenanceApi("apply-cover-optimizations",{updates});
        maintenance.data=result;state.management=null;renderMaintenance(result);
        setProgress(progress,`Optimized ${result.optimized||updates.length} cover${(result.optimized||updates.length)===1?"":"s"}${failures.length?`; ${failures.length} skipped`:""}.`,100);
      }else throw new Error(failures[0]||"No covers could be optimized");
    }catch(error){
      console.error(error);setProgress(progress,`Cover maintenance failed: ${error.message}`,0);
    }finally{
      maintenance.optimizing=false;renderCoverMaintenance(maintenance.data);try{await wakeLock?.release()}catch{}
    }
  }

  async function createBackup(){
    const button=$("#createCatalogBackup");button.disabled=true;button.textContent="Creating backup…";
    try{const result=await maintenanceApi("create-backup",{reason:"manual-backup"});renderMaintenance(result)}
    catch(error){alert(error.message)}finally{button.disabled=false;button.textContent="Create backup now"}
  }

  async function restoreBackup(id){
    const backup=arrLocal(maintenance.data?.backups).find(item=>item.id===id);
    if(!backup)return;
    if(!confirm(`Restore the catalog snapshot from ${fmtDate(backup.createdAt)}?\n\nA safety backup of the current catalogs will be created first. EPUB and cover files in B2 are not changed.`))return;
    try{const result=await maintenanceApi("restore-backup",{id});maintenance.data=result;state.management=null;renderMaintenance(result)}
    catch(error){alert(error.message)}
  }

  async function restoreTrash(id){
    const item=arrLocal(maintenance.data?.trash).find(entry=>entry.id===id);if(!item)return;
    if(!confirm(`Restore “${item.title}” to the ${item.scope==="adult"?"18+":"Main"} library?`))return;
    try{const result=await maintenanceApi("restore-trash",{id});maintenance.data=result;state.management=null;renderMaintenance(result)}
    catch(error){alert(error.message)}
  }

  async function purgeTrash(ids){
    const all=!ids?.length;
    const count=all?arrLocal(maintenance.data?.trash).length:ids.length;
    if(!count)return;
    if(!confirm(`Permanently purge ${all?"all Trash":count===1?"this Trash item":`${count} Trash items`}?\n\nAny EPUB and cover objects used only by the selected Trash entries will be deleted from B2. This cannot be undone.`))return;
    try{const result=await maintenanceApi("purge-trash",{ids:ids||[]});maintenance.data=result;renderMaintenance(result)}
    catch(error){alert(error.message)}
  }

  $("#refreshMaintenance")?.addEventListener("click",()=>{maintenance.data=null;loadMaintenance(true)});
  $("#deepHealthCheck")?.addEventListener("click",deepHealthCheck);
  $("#optimizeLegacyCovers")?.addEventListener("click",optimizeLegacyCovers);
  $("#createCatalogBackup")?.addEventListener("click",createBackup);
  $("#backupList")?.addEventListener("click",event=>{const button=event.target.closest("[data-restore-backup]");if(button)restoreBackup(button.dataset.restoreBackup)});
  $("#trashList")?.addEventListener("click",event=>{const restore=event.target.closest("[data-restore-trash]"),purge=event.target.closest("[data-purge-trash]");if(restore)restoreTrash(restore.dataset.restoreTrash);if(purge)purgeTrash([purge.dataset.purgeTrash])});
  $("#purgeAllTrash")?.addEventListener("click",()=>purgeTrash([]));

  /* Existing Manage Library removal actions now mean soft-delete. The server keeps B2 files
     and records a recoverable Trash entry; Garden Maintenance is the only permanent purge path. */
  const baseRenderManagedVolumes=renderManagedVolumes;
  renderManagedVolumes=function(series){
    baseRenderManagedVolumes(series);
    $$("#manageVolumes [data-volume-delete]").forEach(button=>button.textContent="Move to Trash");
  };

  deleteVolume=async function(card){
    const index=Number(card.dataset.volumeIndex),item=findManagedSeries(state.activeSeriesId);if(!item)return;
    const volume=arr(item.series.volumes)[index];if(!volume)return;
    if(!confirm(`Move “${volume.title}” to Trash?\n\nIt will disappear from the public library, but its EPUB and cover files remain recoverable until you purge Trash.`))return;
    const button=card.querySelector("[data-volume-delete]");button.disabled=true;button.textContent="Moving…";
    try{
      const result=await api("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete-volume",id:state.activeSeriesId,volumeIndex:index})});
      updateManagement(result);maintenance.data=null;
      const still=findManagedSeries(state.activeSeriesId);if(still)openSeriesEditor(state.activeSeriesId);else{$("#seriesEditor").close();state.activeSeriesId=null}
    }catch(error){alert(error.message);button.disabled=false;button.textContent="Move to Trash"}
  };

  async function trashSeries(){
    if(!state.activeSeriesId)return;const item=findManagedSeries(state.activeSeriesId);if(!item)return;
    if(!confirm(`Move “${item.series.title}” and all of its volumes to Trash?\n\nThe series will disappear from the public library, but its B2 files remain recoverable until Trash is purged.`))return;
    const button=$("#deleteSeries");button.disabled=true;button.textContent="Moving…";
    try{
      const result=await api("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete-series",id:state.activeSeriesId})});
      updateManagement(result);maintenance.data=null;state.activeSeriesId=null;$("#seriesEditor").close();
    }catch(error){alert(error.message);button.disabled=false;button.textContent="Move series to Trash"}
  }

  const oldDeleteSeries=$("#deleteSeries");
  if(oldDeleteSeries){const replacement=oldDeleteSeries.cloneNode(true);replacement.textContent="Move series to Trash";oldDeleteSeries.replaceWith(replacement);replacement.addEventListener("click",trashSeries)}
})();
