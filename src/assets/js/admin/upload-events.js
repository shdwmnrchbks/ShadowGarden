/* Shadow Garden R5 — Upload workflow lifecycle bridge. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const state=document.querySelector("#uploadState"),q=keeper.state.batch;if(!state||!q)return;
  let last="";
  function publish(){const next=String(state.textContent||"").trim().toUpperCase();if(next!==last&&next.startsWith("COMPLETE")){keeper.state.management=null;keeper.events.dispatchEvent(new CustomEvent("upload:completed",{detail:{status:next}}))}last=next}
  new MutationObserver(()=>queueMicrotask(publish)).observe(state,{childList:true,subtree:true,characterData:true});publish();
})();