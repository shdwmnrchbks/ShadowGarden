/* Shadow Garden v1.15.4 — Reader end-page finished toggle. */
(async()=>{
  const status=window.ShadowGardenReadingStatus;
  const masterActions=document.querySelector("#volumeEndPage .volume-complete-actions");
  if(!status||!masterActions)return;

  if(!document.querySelector('link[data-reading-status-style]')){
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="/assets/css/reading-status.css?v=1.15.3";
    link.dataset.readingStatusStyle="1";
    document.head.appendChild(link);
  }

  function installControl(actions,{master=false}={}){
    if(!actions)return null;
    let label=actions.querySelector(":scope > .volume-finished-toggle");
    if(!label){
      label=document.createElement("label");
      label.className="volume-finished-toggle";
      label.innerHTML=`<input ${master?'id="finishedToggle" ':''}data-sg-finished-toggle="1" type="checkbox" role="switch"><span ${master?'id="finishedToggleText" ':''}>Mark as Finished</span>`;
      actions.prepend(label);
    }
    const input=label.querySelector('input[type="checkbox"]');
    if(input)input.dataset.sgFinishedToggle="1";
    return input;
  }

  installControl(masterActions,{master:true});

  const params=new URLSearchParams(location.search);
  const seriesId=String(params.get("series")||"").trim();
  const queryBookId=String(params.get("book")||"").trim();
  let ticket=null;
  try{ticket=await window.ShadowGardenBookAccess?.initial}catch{}
  const ticketBookId=String(ticket?.bookId||ticket?.identity||"").trim();
  const publicBookId=String(window.__sgReaderPublicBookId||ticketBookId||queryBookId||"").trim();
  const sourcePath=String(window.__sgReaderSourcePath||ticket?.sourcePath||"").trim();

  let series=null,volume=null,volumeIndex=-1;
  if(seriesId&&window.ShadowGardenData?.loadCatalog){
    try{
      const catalog=await window.ShadowGardenData.loadCatalog(seriesId.startsWith("adult-"));
      series=(Array.isArray(catalog?.series)?catalog.series:[]).find(item=>String(item?.id||"")===seriesId)||null;
      const volumes=Array.isArray(series?.volumes)?series.volumes:[];
      const candidates=new Set([queryBookId,publicBookId,ticketBookId,sourcePath].filter(Boolean));
      volumeIndex=volumes.findIndex(item=>candidates.has(String(item?.file||""))||candidates.has(String(item?.bookId||"")));
      if(volumeIndex<0&&volumes.length===1)volumeIndex=0;
      volume=volumeIndex>=0?volumes[volumeIndex]:null;
    }catch(error){console.warn("Finished-state catalog identity lookup skipped",error)}
  }

  const aliases=status.volumeAliases?.(seriesId,volume,volumeIndex,[volume?.file,volume?.bookId,queryBookId,publicBookId,ticketBookId,sourcePath])
    ||[volume?.file,volume?.bookId,queryBookId,publicBookId,ticketBookId,sourcePath].filter(Boolean);
  const primary=String(volume?.file||publicBookId||queryBookId||aliases[0]||"").trim();

  if(status.isAnyFinished?.(aliases)&&aliases.length)status.setAliasesFinished?.(aliases,true);

  function notify(message){
    const toast=document.getElementById("toast");
    if(!toast)return;
    toast.textContent=message;
    toast.classList.remove("hidden");
    setTimeout(()=>toast.classList.add("hidden"),1800);
  }
  function finishedNow(){return Boolean(aliases.length&&(status.isAnyFinished?.(aliases)??aliases.some(id=>status.isFinished(id))))}
  function allControls(){
    return [...document.querySelectorAll('.volume-end-page .volume-complete-actions')].map((actions,index)=>installControl(actions,{master:actions===masterActions||index===0})).filter(Boolean);
  }
  function sync(){
    const finished=finishedNow();
    for(const toggle of allControls()){
      toggle.checked=finished;
      toggle.disabled=!primary;
      toggle.setAttribute("aria-checked",finished?"true":"false");
      const label=toggle.closest(".volume-finished-toggle");
      label?.classList.toggle("is-finished",finished);
      const text=label?.querySelector("span");
      if(text)text.textContent=primary?(finished?"Finished":"Mark as Finished"):"Reading status unavailable";
    }
  }
  function persist(wanted){
    const ok=aliases.length
      ?(status.setAliasesFinished?.(aliases,wanted)??status.setFinished(primary,wanted))
      :false;
    if(!ok||finishedNow()!==wanted){
      sync();
      notify("Could not save reading status");
      return false;
    }
    sync();
    notify(wanted?"Marked as finished":"Marked as unfinished");
    return true;
  }

  /* Continuous mode clones #volumeEndPage with cloneNode(true). Native listeners are not
     copied by cloneNode, so the old master-only `change` listener made the cloned switch
     look interactive without ever persisting anything. Delegate at document level so the
     master Pages control and every Continuous clone share the exact same persistence path. */
  document.addEventListener("change",event=>{
    const toggle=event.target?.closest?.('[data-sg-finished-toggle="1"],.volume-finished-toggle input[type="checkbox"]');
    if(!toggle)return;
    persist(Boolean(toggle.checked));
  },true);

  window.addEventListener(status.EVENT,event=>{
    const changed=Array.isArray(event.detail?.bookIds)?event.detail.bookIds:[event.detail?.bookId];
    if(changed.some(id=>aliases.includes(String(id||""))))sync();
  });

  const cloneHost=document.getElementById("viewerShell")||document.body;
  new MutationObserver(mutations=>{
    if(mutations.some(mutation=>[...mutation.addedNodes].some(node=>node?.nodeType===1&&(node.matches?.(".volume-end-page-continuous")||node.querySelector?.(".volume-end-page-continuous")))))sync();
  }).observe(cloneHost,{childList:true,subtree:true});

  sync();
})();
