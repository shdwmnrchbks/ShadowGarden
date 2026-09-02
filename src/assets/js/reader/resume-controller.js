/* Shadow Garden v2.8 — Reader lifecycle resume coordination. */
import { holdRenditionNavigation } from "./navigation-state.js";

const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

export function createReaderResumeController({
  getRendition,getFlow,getPageMap,getPosition,getCfi,renewAccess,resetInput,
  resizeRendition,configureRendition,layoutChanged,onLayoutChanged
}={}){
  const state={anchor:null,cfi:"",running:null,queued:false,bound:false};
  let cleanup=null;

  function remember(){
    const position=getPosition?.();
    const cfi=getCfi?.()||position?.cfi||"";
    if(position)state.anchor={...position};
    if(cfi)state.cfi=cfi;
    return state.anchor;
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
    if(!changed&&position){
      try{
        target=await getPageMap?.()?.targetForPosition?.(position,{includeFraction:flow==="scrolled-doc"})||target;
      }catch(error){console.warn("Reader resume canonical target fallback",error)}
    }

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
    const position=state.anchor||getPosition?.()||null;
    const cfi=state.cfi||getCfi?.()||position?.cfi||"";

    const task=restoreOnce(rendition,position,cfi).catch(error=>{
      console.warn("Reader resume recovery skipped",error);
      return false;
    });
    let tracked;
    tracked=task.finally(()=>{
      if(state.running===tracked)state.running=null;
      remember();
      if(state.queued){
        state.queued=false;
        queueMicrotask(()=>void restore());
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
    const onVisibility=()=>{if(document.hidden)remember();else void restore()};
    const onPageHide=()=>remember();
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

  return{remember,restore,wait,bind,isRestoring:()=>Boolean(state.running)};
}
