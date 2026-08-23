/* Shadow Garden v1.15.1 — Reader end-page finished toggle. */
(()=>{
  const status=window.ShadowGardenReadingStatus;
  const actions=document.querySelector("#volumeEndPage .volume-complete-actions");
  if(!status||!actions)return;

  if(!document.querySelector('link[data-reading-status-style]')){
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="/assets/css/reading-status.css?v=1.15.1";
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
  const bookId=String(window.__sgReaderPublicBookId||queryBookId||"").trim();
  const sourcePath=String(window.__sgReaderSourcePath||"").trim();

  /* v1.15.0 could key the toggle against the Reader's temporary private media path
     in some startup timings. Recover that state once and move it to the public bk_ id
     used by Series/Library pages. */
  if(bookId&&sourcePath&&bookId!==sourcePath&&status.isFinished(sourcePath)&&!status.isFinished(bookId)){
    status.migrateFinished?.(sourcePath,bookId);
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
