/* Shadow Garden v1.15.0 — Reader end-page finished toggle. */
(()=>{
  const status=window.ShadowGardenReadingStatus;
  const actions=document.querySelector("#volumeEndPage .volume-complete-actions");
  if(!status||!actions)return;

  if(!document.querySelector('link[data-reading-status-style]')){
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="/assets/css/reading-status.css?v=1.15.0";
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

  const bookId=new URLSearchParams(location.search).get("book")||"";
  function sync(){
    const finished=status.isFinished(bookId);
    toggle.checked=finished;
    toggle.setAttribute("aria-checked",finished?"true":"false");
    toggle.closest(".volume-finished-toggle")?.classList.toggle("is-finished",finished);
    if(text)text.textContent=finished?"Finished":"Mark as Finished";
  }
  toggle.addEventListener("change",()=>{
    status.setFinished(bookId,toggle.checked);
    sync();
    const toast=document.getElementById("toast");
    if(toast){
      toast.textContent=toggle.checked?"Marked as finished":"Marked as unfinished";
      toast.classList.remove("hidden");
      setTimeout(()=>toast.classList.add("hidden"),1600);
    }
  });
  window.addEventListener(status.EVENT,event=>{if(event.detail?.bookId===bookId)sync()});
  sync();
})();
