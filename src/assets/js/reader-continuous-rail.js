/* Dedicated Continuous-mode seek rail.
 * The visible vertical rail is not a native <input type="range">. Pointer/keyboard
 * interaction is mapped to the existing horizontal progress input only long enough for
 * reader.js to invoke its normal seek path. This avoids browser-specific vertical-range
 * behavior and bypasses the older Continuous range adapter without changing reader state.
 */
(()=>{
  let activePointer=null;
  let rail=null,track=null,thumb=null,label=null,range=null,coreText=null;

  const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));

  function isContinuous(){
    return document.body?.classList.contains("reader-flow-scrolled")===true;
  }

  function init(){
    rail=document.getElementById("continuousSeek");
    track=document.getElementById("continuousSeekTrack");
    thumb=document.getElementById("continuousSeekThumb");
    label=document.getElementById("continuousSeekText");
    range=document.getElementById("progressRange");
    coreText=document.getElementById("progressText");
    if(!rail||!track||!thumb||!label||!range||!coreText)return;

    syncFromCore();
    new MutationObserver(syncFromCore).observe(coreText,{childList:true,characterData:true,subtree:true});

    track.addEventListener("pointerdown",pointerDown);
    rail.addEventListener("keydown",keyDown);
  }

  function syncFromCore(){
    if(!range||!rail)return;
    const p=clamp01(Number(range.value||0)/1000);
    rail.style.setProperty("--sg-progress",`${p*100}%`);
    rail.setAttribute("aria-valuenow",String(Math.round(p*100)));
    if(label)label.textContent=coreText?.textContent||`${Math.round(p*100)}%`;
  }

  function valueFromY(clientY){
    const rect=track?.getBoundingClientRect();
    if(!rect||!rect.height)return clamp01(Number(range?.value||0)/1000);
    return clamp01((clientY-rect.top)/rect.height);
  }

  function setCoreValue(percentage){
    const p=clamp01(percentage);
    range.value=String(Math.round(p*1000));
    syncFromCore();
    return p;
  }

  /* reader-epub-adapter.js still has legacy handlers for #progressRange in Continuous
     mode. Temporarily remove only the CSS mode marker while dispatching, so those capture
     handlers ignore the synthetic event and reader.js receives it directly. The actual
     rendition remains Continuous because reader state is unchanged. */
  function dispatchToReader(type){
    const body=document.body;
    const hadScrolled=body?.classList.contains("reader-flow-scrolled");
    if(hadScrolled)body.classList.remove("reader-flow-scrolled");
    try{range.dispatchEvent(new Event(type,{bubbles:true}))}
    finally{if(hadScrolled)body.classList.add("reader-flow-scrolled")}
  }

  function preview(percentage){
    setCoreValue(percentage);
    dispatchToReader("input");
  }

  function commit(percentage){
    setCoreValue(percentage);
    dispatchToReader("change");
  }

  function pointerDown(event){
    if(!isContinuous())return;
    event.preventDefault();
    activePointer=event.pointerId;
    try{track.setPointerCapture?.(event.pointerId)}catch{}
    preview(valueFromY(event.clientY));
    track.addEventListener("pointermove",pointerMove);
    track.addEventListener("pointerup",pointerUp);
    track.addEventListener("pointercancel",pointerCancel);
  }

  function pointerMove(event){
    if(event.pointerId!==activePointer)return;
    event.preventDefault();
    preview(valueFromY(event.clientY));
  }

  function finishPointer(event,shouldCommit){
    if(event.pointerId!==activePointer)return;
    event.preventDefault();
    const percentage=valueFromY(event.clientY);
    activePointer=null;
    try{track.releasePointerCapture?.(event.pointerId)}catch{}
    track.removeEventListener("pointermove",pointerMove);
    track.removeEventListener("pointerup",pointerUp);
    track.removeEventListener("pointercancel",pointerCancel);
    if(shouldCommit)commit(percentage);
  }

  function pointerUp(event){finishPointer(event,true)}
  function pointerCancel(event){finishPointer(event,false)}

  function keyDown(event){
    if(!isContinuous())return;
    let p=clamp01(Number(range.value||0)/1000),handled=true;
    if(event.key==="ArrowUp")p-=.01;
    else if(event.key==="ArrowDown")p+=.01;
    else if(event.key==="PageUp")p-=.1;
    else if(event.key==="PageDown")p+=.1;
    else if(event.key==="Home")p=0;
    else if(event.key==="End")p=1;
    else handled=false;
    if(!handled)return;
    event.preventDefault();
    commit(clamp01(p));
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
