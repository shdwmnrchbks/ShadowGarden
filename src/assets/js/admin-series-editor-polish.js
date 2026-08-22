/* Shadow Garden v1.0.5 — Series Editor success flow */
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

  replaceButton("#saveSeries",saveAndClose);
  replaceButton("#deleteSeries",trashAndClose);
})();
