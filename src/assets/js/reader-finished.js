/* Shadow Garden v1.15.2 — Reader end-page finished toggle. */
(async()=>{
  const status=window.ShadowGardenReadingStatus;
  const actions=document.querySelector("#volumeEndPage .volume-complete-actions");
  if(!status||!actions)return;

  if(!document.querySelector('link[data-reading-status-style]')){
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="/assets/css/reading-status.css?v=1.15.2";
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

  const queryBookId=new URLSearchParams(location.search).get("book")||"";
  let ticket=null;
  try{ticket=await window.ShadowGardenBookAccess?.initial}catch{}
  const ticketBookId=String(ticket?.bookId||ticket?.identity||"").trim();
  const bookId=String(window.__sgReaderPublicBookId||ticketBookId||queryBookId||"").trim();
  const sourcePath=String(window.__sgReaderSourcePath||ticket?.sourcePath||"").trim();

  /* Migrate every known legacy alias into the canonical public identity. This covers
     old Reader tabs/bookmarks whose URL still contains the private media path as well
     as v1.15.0/v1.15.1 completion values created from that path. */
  for(const alias of new Set([sourcePath,queryBookId].filter(Boolean))){
    if(alias!==bookId&&status.isFinished(alias)&&!status.isFinished(bookId))status.migrateFinished?.(alias,bookId);
    else if(alias!==bookId&&status.isFinished(alias)&&status.isFinished(bookId))status.setFinished(alias,false);
  }

  function notify(message){
    const toast=document.getElementById("toast");
    if(!toast)return;
    toast.textContent=message;
    toast.classList.remove("hidden");
    setTimeout(()=>toast.classList.add("hidden"),1600);
  }
  function sync(){
    const finished=Boolean(bookId&&status.isFinished(bookId));
    toggle.checked=finished;
    toggle.disabled=!bookId;
    toggle.setAttribute("aria-checked",finished?"true":"false");
    toggle.closest(".volume-finished-toggle")?.classList.toggle("is-finished",finished);
    if(text)text.textContent=bookId?(finished?"Finished":"Mark as Finished"):"Reading status unavailable";
  }
  toggle.addEventListener("change",()=>{
    const wanted=toggle.checked;
    if(!bookId||!status.setFinished(bookId,wanted)){
      sync();
      notify("Could not save reading status");
      return;
    }
    sync();
    notify(wanted?"Marked as finished":"Marked as unfinished");
  });
  window.addEventListener(status.EVENT,event=>{if(event.detail?.bookId===bookId)sync()});
  sync();
})();
