/* v0.10 replacement safety guard. Loaded after admin-batch.js. */
(()=>{
  const q=state.batch,list=document.querySelector("#batchList"),upload=document.querySelector("#uploadButton");
  if(!q||!list||!upload)return;

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
    },180);
  });
  document.querySelector("#adultInput")?.addEventListener("change",()=>{
    setTimeout(()=>forceSafeReplacement(q.items.find(entry=>entry.id===q.activeId)),180);
  });

  upload.addEventListener("click",()=>{
    for(const item of q.items)forceSafeReplacement(item);
  },true);
})();
