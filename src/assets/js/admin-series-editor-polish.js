/* Shadow Garden v1.2.2 — authoritative Adult Library controls + Series Editor success flow. */
(()=>{
  const dialog=document.querySelector("#seriesEditor");
  if(!dialog)return;

  function toastHost(){
    let host=document.querySelector("#adminToastHost");
    if(host)return host;
    host=document.createElement("div");
    host.id="adminToastHost";
    host.className="admin-toast-host";
    host.setAttribute("aria-live","polite");
    host.setAttribute("aria-atomic","true");
    document.body.appendChild(host);
    return host;
  }

  function showAdminToast(message,kind="success"){
    const toast=document.createElement("div");
    toast.className=`admin-toast ${kind}`.trim();
    toast.setAttribute("role","status");
    toast.textContent=message;
    toastHost().appendChild(toast);
    window.setTimeout(()=>{
      toast.classList.add("leaving");
      window.setTimeout(()=>toast.remove(),180);
    },2600);
  }
  window.showAdminToast=showAdminToast;

  function replaceButton(selector,handler){
    const current=document.querySelector(selector);
    if(!current)return null;
    const replacement=current.cloneNode(true);
    current.replaceWith(replacement);
    replacement.addEventListener("click",handler);
    return replacement;
  }

  /* Replace the checkbox DOM nodes themselves after legacy uploader scripts have initialized.
     This intentionally drops every older listener attached to the original inputs while keeping
     dynamic #adultInput / #manageAdult lookups in admin.js and admin-batch.js fully compatible. */
  function ownCheckbox(id){
    const current=document.getElementById(id);
    if(!current)return null;
    const replacement=current.cloneNode(true);
    current.replaceWith(replacement);
    return replacement;
  }

  const addAdult=ownCheckbox("adultInput");
  const manageAdult=ownCheckbox("manageAdult");

  addAdult?.addEventListener("change",()=>{
    const target=state.addBookTarget;
    const q=state.batch;
    const item=q?.items?.find?.(entry=>entry.id===q.activeId);

    if(target){
      addAdult.checked=target.scope==="adult";
      if(item)item.adult=target.scope==="adult";
      return;
    }
    if(!item)return;

    /* A true replacement stays on the shelf of the existing volume. Changing shelf while
       replacing would turn the operation into a different logical book, so keep it stable. */
    if(item.action==="replace"&&item.duplicate&&!item.duplicate.batch){
      item.adult=item.duplicate.scope==="adult";
      addAdult.checked=item.adult;
      showAdminToast(`Replacement remains in the ${item.adult?"18+ / Adult":"Main"} Library.`,"info");
      return;
    }

    item.adult=Boolean(addAdult.checked);
    /* Do not rebuild the batch queue here. saveEditor() will recalculate duplicate state when
       another field is committed or Upload is pressed, without tearing down the active dialog. */
  });

  /* Manage Series only needs to retain checkbox state until Save. The cloned control has no
     layout/event side effects; saveAndClose() reads its current value directly. */
  manageAdult?.addEventListener("change",()=>{
    dialog.dataset.pendingAdult=manageAdult.checked?"adult":"main";
  });

  async function saveAndClose(){
    if(!state.activeSeriesId)return;
    const button=document.querySelector("#saveSeries");
    const old=button.textContent;
    const title=document.querySelector("#manageTitle").value.trim()||"Series";
    button.disabled=true;
    button.textContent="Saving…";
    try{
      const result=await api("/admin-api/library",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action:"update-series",
          id:state.activeSeriesId,
          title:document.querySelector("#manageTitle").value,
          author:document.querySelector("#manageAuthor").value,
          year:document.querySelector("#manageYear").value,
          status:document.querySelector("#manageStatus").value,
          tags:document.querySelector("#manageTags").value.split(",").map(value=>value.trim()).filter(Boolean),
          description:document.querySelector("#manageDescription").value,
          adult:document.querySelector("#manageAdult").checked
        })
      });
      updateManagement(result);
      state.activeSeriesId=null;
      delete dialog.dataset.pendingAdult;
      dialog.close();
      showAdminToast(`Saved “${title}”.`);
    }catch(error){
      alert(error.message);
    }finally{
      button.disabled=false;
      button.textContent=old;
    }
  }

  async function trashAndClose(){
    const item=findManagedSeries(state.activeSeriesId);
    if(!item)return;
    const title=item.series.title||"Series";
    if(!confirm(`Move “${title}” to Trash?\n\nIt will disappear from the public library, but its EPUB and cover files remain recoverable until Trash is permanently purged.`))return;
    const button=document.querySelector("#deleteSeries");
    const old=button.textContent;
    button.disabled=true;
    button.textContent="Moving…";
    try{
      const result=await api("/admin-api/library",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"delete-series",id:state.activeSeriesId})
      });
      updateManagement(result);
      state.activeSeriesId=null;
      delete dialog.dataset.pendingAdult;
      dialog.close();
      showAdminToast(`Moved “${title}” to Trash.`);
      if(typeof window.loadMaintenance==="function")void window.loadMaintenance(true);
    }catch(error){
      alert(error.message);
    }finally{
      button.disabled=false;
      button.textContent=old;
    }
  }

  function syncTargetInfo(){
    const target=state.addBookTarget,banner=document.querySelector("#addSeriesTarget"),meta=document.querySelector("#addSeriesTargetMeta");
    if(!target||!banner||!meta)return;
    banner.dataset.scope=target.scope;
    meta.textContent=target.scope==="adult"
      ?"18+ / Adult Library · New books inherit this series library automatically."
      :"Main Library · New books inherit this series library automatically.";
  }
  const addDialog=document.querySelector("#addBooksDialog");
  if(addDialog)new MutationObserver(()=>queueMicrotask(syncTargetInfo)).observe(addDialog,{attributes:true,attributeFilter:["class","open"]});

  replaceButton("#saveSeries",saveAndClose);
  replaceButton("#deleteSeries",trashAndClose);
})();
