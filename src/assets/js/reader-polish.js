/* Shadow Garden v1.10.1 — Reader swipe, completion, and settings polish. */
(()=>{
  const SETTINGS_KEY="sg-reader-polish-settings";
  const defaults={swipeTurns:true};
  const state={
    settings:loadSettings(),
    readerReady:false,
    seenBelowEnd:false,
    completionShown:false,
    currentVolume:null,
    nextVolume:null,
    series:null
  };

  const $=selector=>document.querySelector(selector);
  const arr=value=>Array.isArray(value)?value:[];
  const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));
  const decode=value=>{try{return decodeURIComponent(value)}catch{return value}};

  function loadSettings(){
    try{
      const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"null")||{};
      return{...defaults,swipeTurns:saved.swipeTurns!==false};
    }catch{return{...defaults}}
  }
  function saveSettings(){
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(state.settings))}
    catch(error){console.warn("Reader polish settings could not be saved",error)}
  }

  function normalizedFile(value){
    try{return decode(new URL(String(value||""),location.origin).pathname).replace(/\/+$/g,"")}
    catch{return decode(String(value||"").split(/[?#]/)[0]).replace(/\/+$/g,"")}
  }

  function sameFile(a,b){return Boolean(a&&b&&normalizedFile(a)===normalizedFile(b))}

  function orderedVolumes(series){
    return arr(series?.volumes).map((volume,index)=>({volume,index})).sort((a,b)=>{
      const an=Number(a.volume?.number),bn=Number(b.volume?.number);
      const av=Number.isFinite(an)?an:999999,bv=Number.isFinite(bn)?bn:999999;
      return av-bv||a.index-b.index;
    }).map(item=>item.volume);
  }

  async function loadSeriesContext(){
    const params=new URLSearchParams(location.search);
    const seriesId=params.get("series"),bookUrl=params.get("book");
    if(!seriesId||!bookUrl||!window.ShadowGardenData?.loadCatalog)return;
    try{
      const adult=String(seriesId).startsWith("adult-");
      const catalog=await window.ShadowGardenData.loadCatalog(adult);
      const series=arr(catalog?.series).find(item=>item?.id===seriesId);
      if(!series)return;
      const volumes=orderedVolumes(series);
      const index=volumes.findIndex(volume=>sameFile(volume?.file,bookUrl));
      state.series=series;
      state.currentVolume=index>=0?volumes[index]:null;
      state.nextVolume=index>=0&&index+1<volumes.length?volumes[index+1]:null;
      syncCompletionCopy();
    }catch(error){console.warn("Next-volume context unavailable",error)}
  }

  function syncCompletionCopy(){
    const title=$("#volumeCompleteTitle"),detail=$("#volumeCompleteDetail"),next=$("#nextVolumeLink"),back=$("#completeReturnLink");
    if(!title||!detail||!next||!back)return;
    const params=new URLSearchParams(location.search),seriesId=params.get("series");
    const currentTitle=state.currentVolume?.title||$("#bookTitle")?.textContent||"This volume";
    title.textContent=currentTitle;
    back.href=seriesId?`/series.html?id=${encodeURIComponent(seriesId)}`:"/";
    if(state.nextVolume?.file){
      const nextTitle=state.nextVolume.title||`Volume ${state.nextVolume.number??"next"}`;
      detail.textContent=`${nextTitle} is ready beneath the next branch of the Garden.`;
      next.textContent=`Read ${nextTitle} ▶`;
      next.href=`/reader.html?book=${encodeURIComponent(state.nextVolume.file)}${seriesId?`&series=${encodeURIComponent(seriesId)}`:""}`;
      next.classList.remove("hidden");
    }else{
      detail.textContent=state.series?"You've reached the latest volume currently growing in this series.":"You've reached the end of this volume.";
      next.classList.add("hidden");
      next.removeAttribute("href");
    }
  }

  function closeDrawers(){
    document.querySelectorAll(".reader-drawer").forEach(drawer=>drawer.classList.remove("open"));
    $("#drawerBackdrop")?.classList.add("hidden");
  }

  function showCompletion(){
    const dialog=$("#volumeComplete");
    if(!dialog||dialog.open||state.completionShown)return;
    state.completionShown=true;
    closeDrawers();
    syncCompletionCopy();
    try{dialog.showModal()}catch{dialog.setAttribute("open","")}
    const focusTarget=!$("#nextVolumeLink")?.classList.contains("hidden")?$("#nextVolumeLink"):$("#completeReturnLink");
    setTimeout(()=>focusTarget?.focus?.(),40);
  }

  function hideCompletion(){
    const dialog=$("#volumeComplete");
    if(!dialog)return;
    try{if(dialog.open)dialog.close()}catch{dialog.removeAttribute("open")}
  }

  function progressValue(){return clamp01(Number($("#progressRange")?.value||0)/1000)}

  function updateCompletionState(){
    if(!state.readerReady)return;
    const progress=progressValue();
    if(progress<.985){
      state.seenBelowEnd=true;
      if(progress<.97)state.completionShown=false;
      return;
    }
    if(progress>=.995&&state.seenBelowEnd&&!state.completionShown)showCompletion();
  }

  function baselineCompletionState(){
    if(state.readerReady)return;
    state.readerReady=true;
    const progress=progressValue();
    state.seenBelowEnd=progress<.995;
  }

  function interactiveTarget(target){
    return typeof target?.closest==="function"&&Boolean(target.closest("a,button,input,select,textarea,label,[contenteditable=true],[role=button],[role=slider]"));
  }

  function hasSelection(doc){
    try{return Boolean(doc.getSelection?.()?.toString().trim())}catch{return false}
  }

  let turnQueued=false;
  function pageTurn(direction){
    if(turnQueued||!document.body.classList.contains("reader-flow-paginated"))return;
    turnQueued=true;
    requestAnimationFrame(()=>{
      turnQueued=false;
      if(!document.body.classList.contains("reader-flow-paginated"))return;
      const button=direction<0?$("#prevBottom"):$("#nextBottom");
      button?.click();
    });
  }

  let touchGesture=null;
  let suppressClickUntil=0;

  function preventOriginal(detail){
    try{detail?.originalEvent?.preventDefault?.()}catch{}
  }

  function beginTouch(detail){
    if(detail?.interactive){touchGesture=null;return}
    touchGesture={
      x:Number(detail?.x)||0,
      y:Number(detail?.y)||0,
      at:performance.now()
    };
  }

  function endTouch(detail){
    if(!touchGesture)return;
    const start=touchGesture;
    touchGesture=null;
    if(detail?.selection)return;
    const x=Number(detail?.x)||0,y=Number(detail?.y)||0;
    const dx=x-start.x,dy=y-start.y,elapsed=performance.now()-start.at;
    const paginated=document.body.classList.contains("reader-flow-paginated");
    if(paginated&&state.settings.swipeTurns&&elapsed<1000&&Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.18){
      preventOriginal(detail);
      suppressClickUntil=Date.now()+420;
      pageTurn(dx<0?1:-1);
    }
  }

  function bindRenditionTouchBridge(){
    document.addEventListener("sg-reader-touch",event=>{
      const detail=event.detail||{};
      if(detail.type==="start")beginTouch(detail);
      else if(detail.type==="end")endTouch(detail);
    });
  }

  function bindDirectTouchFallback(doc){
    if(window.__sgReaderRenditionTouchBridge)return;
    let fallback=null;
    doc.addEventListener("touchstart",event=>{
      const point=event.touches?.[0];
      if(!point||interactiveTarget(event.target)){fallback=null;return}
      fallback={x:point.clientX,y:point.clientY,at:performance.now()};
    },{capture:true,passive:true});
    doc.addEventListener("touchcancel",()=>{fallback=null},{capture:true,passive:true});
    doc.addEventListener("touchend",event=>{
      if(!fallback)return;
      const point=event.changedTouches?.[0];
      const start=fallback;fallback=null;
      if(!point||hasSelection(doc))return;
      beginTouch({x:start.x,y:start.y});
      if(touchGesture)touchGesture.at=start.at;
      endTouch({x:point.clientX,y:point.clientY,selection:false,originalEvent:event});
    },{capture:true,passive:false});
  }

  function installGestures(doc){
    const root=doc?.documentElement;
    if(!root||root.dataset.sgReaderPolish==="1")return;
    root.dataset.sgReaderPolish="1";
    try{
      const style=doc.createElement("style");
      style.id="sg-reader-polish-gestures";
      style.textContent="html,body{overscroll-behavior-x:contain!important;touch-action:pan-y pinch-zoom!important;min-height:100%!important}";
      doc.head?.appendChild(style);
    }catch{}

    bindDirectTouchFallback(doc);

    doc.addEventListener("click",event=>{
      if(Date.now()<suppressClickUntil&&!interactiveTarget(event.target)){
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },true);
  }

  function bindEpubContentLifecycle(){
    document.addEventListener("sg-reader-content",event=>{
      const doc=event.detail?.document;
      if(doc)installGestures(doc);
    });
    arr(window.__sgReaderGestureDocuments).forEach(doc=>installGestures(doc));
  }

  function wireIframe(iframe){
    if(!iframe||iframe.dataset.sgReaderPolishFrame==="1")return;
    iframe.dataset.sgReaderPolishFrame="1";
    const wire=()=>{try{if(iframe.contentDocument)installGestures(iframe.contentDocument)}catch{}};
    iframe.addEventListener("load",wire);
    wire();
  }

  function watchReaderFrames(){
    const viewer=$("#viewer");if(!viewer)return;
    const wire=()=>viewer.querySelectorAll("iframe").forEach(wireIframe);
    wire();
    new MutationObserver(wire).observe(viewer,{childList:true,subtree:true});
  }

  function syncSettingsUi(){
    const swipe=$("#swipeTurnsToggle");
    if(swipe)swipe.checked=state.settings.swipeTurns!==false;
  }

  function syncTextWidthVisibility(){
    const setting=$("#textWidthSetting")||$("#widthRange")?.closest("label");
    const flow=$("#flowSelect");
    if(!setting||!flow)return;
    setting.hidden=flow.value==="paginated";
  }

  function bindUi(){
    $("#swipeTurnsToggle")?.addEventListener("change",event=>{state.settings.swipeTurns=event.target.checked;saveSettings()});
    $("#flowSelect")?.addEventListener("change",syncTextWidthVisibility);
    $("#resetReader")?.addEventListener("click",()=>setTimeout(syncTextWidthVisibility,0));
    $("#volumeCompleteClose")?.addEventListener("click",hideCompletion);
    $("#volumeComplete")?.addEventListener("click",event=>{if(event.target===$("#volumeComplete"))hideCompletion()});
    $("#volumeComplete")?.addEventListener("cancel",event=>{event.preventDefault();hideCompletion()});
    syncSettingsUi();
    syncTextWidthVisibility();
  }

  function watchProgress(){
    const text=$("#progressText"),loading=$("#readerLoading");
    if(text)new MutationObserver(()=>updateCompletionState()).observe(text,{childList:true,characterData:true,subtree:true});
    if(loading){
      const ready=()=>{if(loading.classList.contains("hidden")){baselineCompletionState();updateCompletionState()}};
      new MutationObserver(ready).observe(loading,{attributes:true,attributeFilter:["class"]});
      ready();
    }
  }

  function init(){
    bindUi();
    bindRenditionTouchBridge();
    bindEpubContentLifecycle();
    watchReaderFrames();
    watchProgress();
    loadSeriesContext();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
