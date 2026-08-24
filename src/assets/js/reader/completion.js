/* Shadow Garden R4 — one Reader completion owner for Page and Continuous end pages. */
import { catalog as catalogDomain, readingState, urls } from "../domain/index.js";

const arr=value=>Array.isArray(value)?value:[];

function orderedEntries(series){
  return arr(series?.volumes).map((volume,index)=>({volume,index})).sort((a,b)=>{
    const an=Number(a.volume?.number),bn=Number(b.volume?.number);
    const av=Number.isFinite(an)?an:999999,bv=Number.isFinite(bn)?bn:999999;
    return av-bv||a.index-b.index;
  });
}

export async function createCompletionController({session,elements,toast}={}){
  const masterActions=elements.volumeEndPage?.querySelector(".volume-complete-actions")||document.querySelector("#volumeEndPage .volume-complete-actions");
  if(!masterActions)return{sync(){},destroy(){}};

  let series=null,volume=null,volumeIndex=-1,nextVolume=null;
  try{
    if(session?.seriesId&&window.ShadowGardenData?.loadCatalog){
      const shelf=await window.ShadowGardenData.loadCatalog(session.adult);
      const found=catalogDomain.findVolumeEntry(shelf,session.seriesId,session.publicBookId||session.requested,[session.sourcePath,session.ticket?.identity,session.ticket?.requestedIdentity]);
      if(found){
        series=found.series;volume=found.volume;volumeIndex=found.index;
        const ordered=orderedEntries(series),current=ordered.findIndex(entry=>entry.volume===volume||entry.index===volumeIndex);
        nextVolume=current>=0?ordered[current+1]?.volume||null:null;
      }
    }
  }catch(error){console.warn("Reader completion context unavailable",error)}

  const aliases=readingState.volumeAliases?.(session?.seriesId,volume,volumeIndex,[volume?.file,volume?.bookId,session?.publicBookId,session?.requested,session?.sourcePath,session?.ticket?.identity])
    ||[volume?.file,volume?.bookId,session?.publicBookId,session?.requested,session?.sourcePath].filter(Boolean);
  const primary=String(volume?.file||session?.publicBookId||session?.requested||aliases[0]||"").trim();

  function installControl(actions,{master=false}={}){
    if(!actions)return null;
    let label=actions.querySelector(":scope > .volume-finished-toggle");
    if(!label){
      label=document.createElement("label");label.className="volume-finished-toggle";
      label.innerHTML=`<input ${master?'id="finishedToggle" ':''}data-sg-finished-toggle="1" type="checkbox" role="switch"><span ${master?'id="finishedToggleText" ':''}>Mark as Finished</span>`;
      actions.prepend(label);
    }
    const input=label.querySelector('input[type="checkbox"]');if(input)input.dataset.sgFinishedToggle="1";return input;
  }

  function configureCopy(){
    const title=elements.volumeCompleteTitle||document.getElementById("volumeCompleteTitle");
    const detail=elements.volumeCompleteDetail||document.getElementById("volumeCompleteDetail");
    const next=elements.nextVolumeLink||document.getElementById("nextVolumeLink");
    const back=elements.completeReturnLink||document.getElementById("completeReturnLink");
    if(title)title.textContent=volume?.title||elements.bookTitle?.textContent||"This volume";
    if(back)back.href=session?.seriesId?urls.seriesUrl(session.seriesId):urls.libraryUrl(session?.adult);
    if(nextVolume?.file&&next){
      const nextTitle=nextVolume.title||`Volume ${nextVolume.number??"next"}`;
      if(detail)detail.textContent=`${nextTitle} is ready beneath the next branch of the Garden.`;
      next.textContent=`Read ${nextTitle} ▶`;next.href=urls.readerUrl(nextVolume.file,session.seriesId);next.classList.remove("hidden");
    }else{
      if(detail)detail.textContent=series?"You've reached the latest volume currently growing in this series.":"You've reached the end of this volume.";
      next?.classList.add("hidden");next?.removeAttribute("href");
    }
  }

  installControl(masterActions,{master:true});configureCopy();
  if(readingState.isAnyFinished?.(aliases)&&aliases.length)readingState.setAliasesFinished?.(aliases,true);

  const finishedNow=()=>Boolean(aliases.length&&(readingState.isAnyFinished?.(aliases)??aliases.some(id=>readingState.isFinished(id))));
  function allControls(){
    return[...document.querySelectorAll('.volume-end-page .volume-complete-actions')].map((actions,index)=>installControl(actions,{master:actions===masterActions||index===0})).filter(Boolean);
  }
  function sync(){
    const finished=finishedNow();
    for(const toggle of allControls()){
      toggle.checked=finished;toggle.disabled=!primary;toggle.setAttribute("aria-checked",finished?"true":"false");
      const label=toggle.closest(".volume-finished-toggle");label?.classList.toggle("is-finished",finished);
      const text=label?.querySelector("span");if(text)text.textContent=primary?(finished?"Finished":"Mark as Finished"):"Reading status unavailable";
    }
  }
  function persist(wanted,{quiet=false}={}){
    const ok=aliases.length?(readingState.setAliasesFinished?.(aliases,wanted)??readingState.setFinished(primary,wanted)):false;
    if(!ok||finishedNow()!==wanted){sync();toast?.("Could not save reading status");return false}
    sync();if(!quiet)toast?.(wanted?"Marked as finished":"Marked as unfinished");return true;
  }

  function onChange(event){
    const toggle=event.target?.closest?.('[data-sg-finished-toggle="1"],.volume-finished-toggle input[type="checkbox"]');
    if(toggle)persist(Boolean(toggle.checked));
  }
  function onClick(event){
    const next=event.target?.closest?.(".volume-end-page .volume-complete-next");
    if(!next||finishedNow())return;
    if(!persist(true,{quiet:true})){event.preventDefault();event.stopPropagation()}
  }
  function onState(event){
    const changed=Array.isArray(event.detail?.bookIds)?event.detail.bookIds:[event.detail?.bookId];
    if(changed.some(id=>aliases.includes(String(id||""))))sync();
  }

  document.addEventListener("change",onChange,true);
  document.addEventListener("click",onClick,true);
  window.addEventListener(readingState.EVENT,onState);

  /* Continuous mode clones the master end page inside EPUB.js's manager. The clone is a
     third-party lifecycle boundary, so this observer only initializes newly mounted clones;
     it does not own general Reader rendering. */
  const host=elements.viewerShell||document.body;
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(mutation=>[...mutation.addedNodes].some(node=>node?.nodeType===1&&(node.matches?.(".volume-end-page-continuous")||node.querySelector?.(".volume-end-page-continuous")))))sync();
  });
  observer.observe(host,{childList:true,subtree:true});
  sync();

  return{
    sync,persist,finished:finishedNow,
    destroy(){observer.disconnect();document.removeEventListener("change",onChange,true);document.removeEventListener("click",onClick,true);window.removeEventListener(readingState.EVENT,onState)}
  };
}
