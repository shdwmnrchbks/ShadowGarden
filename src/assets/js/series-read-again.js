/* Shadow Garden v1.15.13 — confirmed Read Again reset flow. */
(()=>{
  const root=document.getElementById("seriesRoot");
  if(!root)return;

  let pending=null;

  function ensureDialog(){
    let dialog=document.getElementById("readAgainDialog");
    if(dialog)return dialog;
    dialog=document.createElement("dialog");
    dialog.id="readAgainDialog";
    dialog.className="read-again-dialog";
    dialog.innerHTML=`
      <form method="dialog" class="read-again-card">
        <div class="read-again-mark" aria-hidden="true">↺</div>
        <p class="read-again-kicker">RETURN TO THE FIRST PAGE</p>
        <h2>Walk this volume from the beginning?</h2>
        <p class="read-again-copy">The reading trail for <strong data-read-again-title>this volume</strong> will be cleared and its Finished mark lifted. You will return to page 1; bookmarks remain untouched.</p>
        <div class="read-again-actions">
          <button class="read-again-cancel" value="cancel" type="submit">Keep My Place</button>
          <button class="read-again-confirm" value="confirm" type="submit">Begin Again</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close("cancel")});
    dialog.addEventListener("cancel",()=>{if(pending){pending.resolve(false);pending=null}});
    dialog.addEventListener("close",()=>{
      if(!pending)return;
      pending.resolve(dialog.returnValue==="confirm");
      pending=null;
    });
    return dialog;
  }

  function confirmRestart(title){
    const dialog=ensureDialog();
    dialog.querySelector("[data-read-again-title]").textContent=title||"this volume";
    if(typeof dialog.showModal!=="function")return Promise.resolve(window.confirm(`Walk ${title||"this volume"} from the beginning?\n\nIts reading trail will be cleared, the Finished mark lifted, and the book reopened at page 1. Bookmarks remain untouched.`));
    if(dialog.open)dialog.close("cancel");
    return new Promise(resolve=>{
      pending={resolve};
      dialog.returnValue="cancel";
      dialog.showModal();
      requestAnimationFrame(()=>dialog.querySelector(".read-again-cancel")?.focus());
    });
  }

  async function readingApi(){
    if(window.ShadowGardenReadingStatus)return window.ShadowGardenReadingStatus;
    await import("/assets/js/reading-status.js?v=1.15.6");
    return window.ShadowGardenReadingStatus;
  }

  async function clearFinishedState(seriesId,bookId){
    const reading=await readingApi();
    if(!reading)return;
    try{
      const adult=String(seriesId||"").startsWith("adult-");
      const catalog=await window.ShadowGardenData?.loadCatalog?.(adult);
      const series=(Array.isArray(catalog?.series)?catalog.series:[]).find(item=>String(item?.id||"")===String(seriesId||""));
      const volumes=Array.isArray(series?.volumes)?series.volumes:[];
      const index=volumes.findIndex(volume=>String(volume?.file||volume?.bookId||"")===String(bookId||""));
      if(series&&index>=0){
        reading.setVolumeFinished?.(series.id,volumes[index],false,index);
        return;
      }
    }catch(error){
      console.warn("Read Again catalog lookup skipped",error);
    }
    reading.setFinished?.(bookId,false);
  }

  function isReadAgainLink(link){
    if(!link?.matches?.(".series-actions .primary-button,.volume-actions a.read"))return false;
    return link.textContent.trim().toLowerCase()==="read again";
  }

  document.addEventListener("click",async event=>{
    const link=event.target.closest?.("a");
    if(!isReadAgainLink(link))return;
    event.preventDefault();
    event.stopPropagation();

    const target=new URL(link.href,location.href);
    const bookId=target.searchParams.get("book")||"";
    const seriesId=target.searchParams.get("series")||new URLSearchParams(location.search).get("id")||"";
    const card=link.closest(".volume-card");
    const title=card?.querySelector(".volume-title")?.textContent?.trim()||document.querySelector(".series-info h1")?.textContent?.trim()||"this volume";
    if(!bookId)return;

    const confirmed=await confirmRestart(title);
    if(!confirmed)return;

    try{
      await clearFinishedState(seriesId,bookId);
      localStorage.removeItem(`sg-progress:${bookId}`);
    }catch(error){
      console.warn("Read Again local reset was incomplete; Reader will retry it",error);
    }

    target.searchParams.set("restart","1");
    location.assign(`${target.pathname}${target.search}${target.hash}`);
  },true);
})();
