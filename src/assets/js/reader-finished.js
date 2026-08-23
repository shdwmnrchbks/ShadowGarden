/* Shadow Garden v1.15.3 — Reader end-page finished toggle. */
(async()=>{
  const status=window.ShadowGardenReadingStatus;
  const actions=document.querySelector("#volumeEndPage .volume-complete-actions");
  if(!status||!actions)return;

  if(!document.querySelector('link[data-reading-status-style]')){
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="/assets/css/reading-status.css?v=1.15.3";
    link.dataset.readingStatusStyle="1";
    document.head.appendChild(link);
  }

  let toggle=document.getElementById("finishedToggle");
  let text=document.getElementById("finishedToggleText");
  if(!toggle){
    const label=document.createElement("label");
    label.className="volume-finished-toggle";
    label.innerHTML='<input id="finishedToggle" type="checkbox" role="switch"><span id="finishedToggleText">Mark as Finished</span>';
    actions.prepend(label);
    toggle=label.querySelector("input");
    text=label.querySelector("span");
  }

  const params=new URLSearchParams(location.search);
  const seriesId=String(params.get("series")||"").trim();
  const queryBookId=String(params.get("book")||"").trim();
  let ticket=null;
  try{ticket=await window.ShadowGardenBookAccess?.initial}catch{}
  const ticketBookId=String(ticket?.bookId||ticket?.identity||"").trim();
  const publicBookId=String(window.__sgReaderPublicBookId||ticketBookId||queryBookId||"").trim();
  const sourcePath=String(window.__sgReaderSourcePath||ticket?.sourcePath||"").trim();

  /* Resolve the exact volume object used by the Series page. That gives completion the
     same public `volume.file` key that Series/Library render against, instead of asking
     the Reader's internal media/ticket identity to predict it. */
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

  /* Normalize any older completion key into every identity that can represent this same
     volume. This repairs v1.15.0-v1.15.2 state and makes future Series/Reader checks agree. */
  if(status.isAnyFinished?.(aliases)&&aliases.length)status.setAliasesFinished?.(aliases,true);

  function notify(message){
    const toast=document.getElementById("toast");
    if(!toast)return;
    toast.textContent=message;
    toast.classList.remove("hidden");
    setTimeout(()=>toast.classList.add("hidden"),1800);
  }
  function finishedNow(){return Boolean(aliases.length&&(status.isAnyFinished?.(aliases)??aliases.some(id=>status.isFinished(id))))}
  function sync(){
    const finished=finishedNow();
    toggle.checked=finished;
    toggle.disabled=!primary;
    toggle.setAttribute("aria-checked",finished?"true":"false");
    toggle.closest(".volume-finished-toggle")?.classList.toggle("is-finished",finished);
    if(text)text.textContent=primary?(finished?"Finished":"Mark as Finished"):"Reading status unavailable";
  }
  toggle.addEventListener("change",()=>{
    const wanted=toggle.checked;
    const ok=aliases.length
      ?(status.setAliasesFinished?.(aliases,wanted)??status.setFinished(primary,wanted))
      :false;
    if(!ok||finishedNow()!==wanted){
      sync();
      notify("Could not save reading status");
      return;
    }
    sync();
    notify(wanted?"Marked as finished":"Marked as unfinished");
  });
  window.addEventListener(status.EVENT,event=>{
    const changed=Array.isArray(event.detail?.bookIds)?event.detail.bookIds:[event.detail?.bookId];
    if(changed.some(id=>aliases.includes(String(id||""))))sync();
  });
  sync();
})();
