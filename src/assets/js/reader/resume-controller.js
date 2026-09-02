/* Shadow Garden v2.8 — Reader lifecycle resume coordination. */
import { holdRenditionNavigation } from "./navigation-state.js";

const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

export function createReaderResumeController({
  getRendition,getFlow,getPageMap,getPosition,getCfi,capturePosition,renewAccess,resetInput,
  resizeRendition,configureRendition,layoutChanged,onLayoutChanged
}={}){
  const state={anchor:null,cfi:"",running:null,capturing:null,queued:false,bound:false};
  let cleanup=null;

  function remember(position=getPosition?.()){
    const next=position||getPosition?.()||null;
    const cfi=next?.cfi||getCfi?.()||"";
    if(next)state.anchor={...next};
    if(cfi)state.cfi=cfi;
    return state.anchor;
  }

  function capture(){
    if(state.capturing)return state.capturing;
    const rendition=getRendition?.();
    if(!rendition)return Promise.resolve(remember());
    const flow=getFlow?.()==="scrolled-doc"?"scrolled-doc":"paginated";
    const fallback=state.anchor||getPosition?.()||null;
    const task=Promise.resolve(capturePosition?.({rendition,flow,pageMap:getPageMap?.(),fallback})||fallback)
      .then(position=>remember(position||fallback))
      .catch(error=>{
        console.warn("Reader resume live capture skipped",error);
        return remember(fallback);
      });
    let tracked;
    tracked=task.finally(()=>{if(state.capturing===tracked)state.capturing=null});
    state.capturing=tracked;
    return tracked;
  }

  async function restoreOnce(rendition,position,cfi){
    try{await renewAccess?.()}catch(error){console.warn("Reader access resume renewal delayed",error)}
    if(rendition!==getRendition?.())return false;

    resetInput?.();
    try{resizeRendition?.(rendition)}catch(error){console.warn("Reader resume resize skipped",error)}
    try{configureRendition?.(rendition,getFlow?.())}catch(error){console.warn("Reader resume spread update skipped",error)}
    await nextPaint();
    if(rendition!==getRendition?.())return false;

    const flow=getFlow?.()==="scrolled-doc"?"scrolled-doc":"paginated";
    const changed=layoutChanged?.()===true;
    let target=cfi||position?.cfi||"";
    if(!target&&!changed&&position){
      try{
        target=await getPageMap?.()?.targetForPosition?.(position,{includeFraction:flow==="scrolled-doc"})||"";
      }catch(error){console.warn("Reader resume canonical target fallback",error)}
    }
    if(!target)target=position?.href||"";

    if(target&&rendition===getRendition?.()){
      await rendition.display(target);
      if(flow==="scrolled-doc"){
        await nextPaint();
        if(rendition===getRendition?.())await rendition.display(target);
      }
    }
    if(changed)onLayoutChanged?.();
    return rendition===getRendition?.();
  }

  function restore({queue=false}={}){
    if(state.running){if(queue)state.queued=true;return state.running}
    const rendition=getRendition?.();
    if(!rendition)return Promise.resolve(false);

    const task=(async()=>{
      const position=await capture();
      if(rendition!==getRendition?.())return false;
      const cfi=position?.cfi||state.cfi||getCfi?.()||"";
      return restoreOnce(rendition,position,cfi);
    })().catch(error=>{
      console.warn("Reader resume recovery skipped",error);
      return false;
    });
    let tracked;
    tracked=task.finally(()=>{
      if(state.running===tracked)state.running=null;
      if(state.queued){
        state.queued=false;
        queueMicrotask(()=>void restore());
      }else{
        queueMicrotask(()=>void capture());
      }
    });
    state.running=tracked;
    holdRenditionNavigation(rendition,tracked);
    return tracked;
  }

  function wait(){return state.running||Promise.resolve()}

  function bind(){
    if(state.bound)return cleanup||(()=>{});
    state.bound=true;
    const onVisibility=()=>{if(document.hidden)void capture();else void restore()};
    const onPageHide=()=>void capture();
    const onPageShow=()=>void restore();
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("pagehide",onPageHide);
    window.addEventListener("pageshow",onPageShow);
    cleanup=()=>{
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("pagehide",onPageHide);
      window.removeEventListener("pageshow",onPageShow);
      state.bound=false;
      cleanup=null;
    };
    return cleanup;
  }

  return{remember,capture,restore,wait,bind,isRestoring:()=>Boolean(state.running)};
}
