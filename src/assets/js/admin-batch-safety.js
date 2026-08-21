/* v1.0.2 replacement safety + uploader resilience guard. Loaded after admin-batch.js. */
(()=>{
  const q=state.batch,list=document.querySelector("#batchList"),upload=document.querySelector("#uploadButton");
  if(!q||!list||!upload)return;

  /* admin-batch.js intentionally clears the file input so the same EPUB can be picked again.
   * Some browsers expose input.files as a live FileList, so clearing input.value can empty the
   * FileList reference before addFiles() copies it. Snapshot the selection during capture and
   * temporarily expose that stable array to the existing batch change handler. */
  const epubInput=document.querySelector("#epubFile");
  const nativeFiles=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"files");
  if(epubInput&&nativeFiles?.get){
    epubInput.addEventListener("change",()=>{
      const selected=Array.from(nativeFiles.get.call(epubInput)||[]);
      if(!selected.length)return;
      try{
        Object.defineProperty(epubInput,"files",{configurable:true,get:()=>selected});
        queueMicrotask(()=>{try{delete epubInput.files}catch{}});
      }catch(error){
        console.warn("Could not stabilize EPUB file selection",error);
      }
    },true);
  }

  /* The batch uploader performs a B2-backed library lookup before local EPUB inspection.
   * Bound that wait so an unhealthy catalog request cannot leave file selection looking dead.
   * Actual EPUB uploads get a much larger allowance. */
  if(typeof api==="function"&&!api.__sgUploadResilient){
    const baseApi=api;
    const resilientApi=async(path,options={})=>{
      const method=String(options.method||"GET").toUpperCase();
      let timeoutMs=0;
      if(String(path).startsWith("/admin-api/upload"))timeoutMs=180000;
      else if(path==="/admin-api/catalog"&&method==="POST")timeoutMs=60000;
      else if(path==="/admin-api/library"&&method==="GET")timeoutMs=8000;
      if(!timeoutMs||options.signal)return baseApi(path,options);
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{return await baseApi(path,{...options,signal:controller.signal})}
      catch(error){
        if(error?.name==="AbortError"){
          const seconds=Math.round(timeoutMs/1000);
          throw new Error(path.startsWith("/admin-api/upload")
            ?`Upload timed out after ${seconds} seconds. Check the connection and try again.`
            :`Garden Keeper request timed out after ${seconds} seconds. Local EPUB inspection can continue, but duplicate lookup may be unavailable.`);
        }
        throw error;
      }finally{clearTimeout(timer)}
    };
    resilientApi.__sgUploadResilient=true;
    api=resilientApi;
  }

  function sameSeries(item,duplicate){
    if(!duplicate||duplicate.batch)return false;
    const target=duplicate.series?.title||String(duplicate.series?.id||"").replace(/^adult-/,"");
    return slug(item.series)===slug(target);
  }

  function forceSafeReplacement(item,{notify=false}={}){
    if(!item||item.action!=="replace")return true;
    const duplicate=item.duplicate;
    if(!sameSeries(item,duplicate)){
      item.action="skip";
      const select=list.querySelector(`[data-batch-action="${CSS.escape(item.id)}"]`);
      if(select)select.value="skip";
      if(notify)alert("Replace is only allowed when the existing volume belongs to the same series. This item was changed to Skip.");
      return false;
    }
    item.adult=duplicate.scope==="adult";
    if(item.id===q.activeId){const adult=document.querySelector("#adultInput");if(adult)adult.checked=item.adult}
    return true;
  }

  function syncUploadGuidance(){
    if(q.running||!q.items.length)return;
    const uploadState=document.querySelector("#uploadState")?.textContent||"";
    const terminal=q.items.every(item=>item.status==="done"||item.status==="failed");
    if(terminal&&/^COMPLETE/.test(uploadState))return;

    const checking=q.items.filter(item=>item.status==="checking").length;
    const actionable=q.items.filter(item=>item.metaReady&&item.validation?.status!=="fail"&&item.action!=="skip"&&item.status!=="done");
    const failed=q.items.filter(item=>item.validation?.status==="fail"||item.status==="failed").length;
    const skippedDuplicates=q.items.filter(item=>item.duplicate&&item.action==="skip"&&item.status!=="done").length;
    const manualSkips=q.items.filter(item=>!item.duplicate&&item.action==="skip"&&item.status!=="done").length;

    if(checking){
      upload.title="Waiting for local EPUB inspection to finish";
      if(!actionable.length){
        setUploadState("CHECKING");
        setStatus("Inspecting EPUB",`${checking} file${checking===1?" is":"s are"} still being checked locally. Upload will unlock when inspection finishes.`,"✦");
      }
      return;
    }

    if(actionable.length){
      upload.removeAttribute("title");
      if(!/^COMPLETE/.test(uploadState)){
        setUploadState("READY","ready");
        setStatus("Ready to upload",`${actionable.length} book${actionable.length===1?" is":"s are"} ready to send to private B2.`,"✓");
      }
      return;
    }

    if(failed){
      upload.title="Upload blocked by EPUB preflight";
      setUploadState("BLOCKED","error");
      setStatus("Upload blocked",`${failed} file${failed===1?" failed":"s failed"} EPUB preflight. Open the validation details to see the blocking issue.`,"!");
      return;
    }
    if(skippedDuplicates){
      upload.title="Choose Replace existing or Add separate for the duplicate";
      setUploadState("ACTION NEEDED","warning");
      setStatus("Duplicate action required",`${skippedDuplicates} duplicate${skippedDuplicates===1?" is":"s are"} currently set to Skip. Choose Replace existing or Add separate to upload.`,"△");
      return;
    }
    if(manualSkips){
      upload.title="All selected books are set to Skip";
      setUploadState("NOTHING SELECTED");
      setStatus("Nothing selected to upload","Change at least one queue action from Skip to Upload.","◇");
    }
  }

  list.addEventListener("change",event=>{
    const select=event.target.closest("[data-batch-action]");
    if(!select||select.value!=="replace")return;
    const item=q.items.find(entry=>entry.id===select.dataset.batchAction);
    if(!item)return;
    item.action="replace";
    if(!forceSafeReplacement(item,{notify:true})){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  const editor=document.querySelector("#metadataCard");
  editor?.addEventListener("input",()=>{
    clearTimeout(q.__replacementGuardTimer);
    q.__replacementGuardTimer=setTimeout(()=>{
      const item=q.items.find(entry=>entry.id===q.activeId);
      forceSafeReplacement(item);
      syncUploadGuidance();
    },180);
  });
  document.querySelector("#adultInput")?.addEventListener("change",()=>{
    setTimeout(()=>{forceSafeReplacement(q.items.find(entry=>entry.id===q.activeId));syncUploadGuidance()},180);
  });

  upload.addEventListener("click",()=>{
    for(const item of q.items)forceSafeReplacement(item);
    syncUploadGuidance();
  },true);

  new MutationObserver(()=>queueMicrotask(syncUploadGuidance)).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:["data-action","data-status"]});
  list.addEventListener("change",()=>queueMicrotask(syncUploadGuidance));
  document.querySelector("#epubFile")?.addEventListener("change",()=>setTimeout(syncUploadGuidance,0),true);
  syncUploadGuidance();
})();
