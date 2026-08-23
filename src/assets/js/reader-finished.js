/* Shadow Garden v1.15.0 — Reader end-page finished toggle. */
(()=>{
  const status=window.ShadowGardenReadingStatus;
  const toggle=document.getElementById("finishedToggle");
  const text=document.getElementById("finishedToggleText");
  if(!status||!toggle)return;
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
