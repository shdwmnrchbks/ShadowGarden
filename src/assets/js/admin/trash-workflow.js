/* Shadow Garden R5 — Trash & Recovery workflow owner. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,arr,esc}=keeper.util,client=keeper.client;
  keeper.registerWorkflow("trash",()=>{
    const list=$("#trashList");if(!list)return{};let trash=[],loading=false;
    const safe=value=>esc(String(value??""));const fmtDate=value=>{try{return new Date(value).toLocaleString()}catch{return String(value||"")}};
    async function action(name,payload={}){return client.request("/admin-api/maintenance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:name,...payload})})}
    function render(data){
      trash=arr(data?.trash);if($("#trashCount"))$("#trashCount").textContent=String(trash.length);if($("#maintenanceTrashCount"))$("#maintenanceTrashCount").textContent=String(trash.length);const purgeAll=$("#purgeAllTrash");if(purgeAll)purgeAll.disabled=!trash.length;
      if(!trash.length){list.innerHTML='<div class="maintenance-empty maintenance-good">Trash is empty.</div>';return}
      list.innerHTML=trash.map(item=>`<div class="maintenance-item"><div class="maintenance-item-copy"><strong>${safe(item.title||"Deleted item")}</strong><span>${safe(item.subtitle||"")}</span><span class="trash-meta"><i>${item.type==="series"?"Series":"Volume"}</i><i>${item.scope==="adult"?"18+":"Main"}</i><i>${safe(fmtDate(item.removedAt))}</i></span></div><div class="maintenance-item-actions"><button class="admin-secondary" type="button" data-restore-trash="${safe(item.id)}">Restore</button><button class="danger-button" type="button" data-purge-trash="${safe(item.id)}">Purge</button></div></div>`).join("");
    }
    async function load(){if(loading)return;loading=true;try{render(await client.request("/admin-api/maintenance",{method:"GET"}))}catch(error){list.innerHTML=`<div class="maintenance-empty maintenance-bad">${safe(error.message)}</div>`}finally{loading=false}}
    async function restore(id){const item=trash.find(entry=>entry.id===id);if(!item)return;if(!confirm(`Restore “${item.title}” to the ${item.scope==="adult"?"18+":"Main"} library?`))return;try{const result=await action("restore-trash",{id});render(result);keeper.state.management=null;keeper.events.dispatchEvent(new Event("trash:changed"));keeper.events.dispatchEvent(new Event("library:invalidate"));keeper.ui.toast(`Restored “${item.title}”.`)}catch(error){alert(error.message)}}
    async function purge(ids){const all=!ids?.length,count=all?trash.length:ids.length;if(!count)return;if(!confirm(`Permanently purge ${all?"all Trash":count===1?"this Trash item":`${count} Trash items`}?\n\nAny EPUB and cover objects used only by the selected Trash entries will be deleted from B2. This cannot be undone.`))return;try{const result=await action("purge-trash",{ids:ids||[]});render(result);keeper.events.dispatchEvent(new Event("trash:changed"));keeper.ui.toast(all?"Trash purged.":"Trash item purged.")}catch(error){alert(error.message)}}
    list.addEventListener("click",event=>{const restoreButton=event.target.closest("[data-restore-trash]"),purgeButton=event.target.closest("[data-purge-trash]");if(restoreButton)void restore(restoreButton.dataset.restoreTrash);if(purgeButton)void purge([purgeButton.dataset.purgeTrash])});$("#purgeAllTrash")?.addEventListener("click",()=>void purge([]));
    keeper.events.addEventListener("maintenance:opened",()=>void load());keeper.events.addEventListener("trash:changed",()=>void load());keeper.events.addEventListener("session:locked",()=>{trash=[];list.innerHTML=""});
    return{load};
  });
})();