/* Shadow Garden v2.8 — Reader lifecycle resume coordination. */
import { holdRenditionNavigation } from "./navigation-state.js";
import { captureContinuousScrollPosition,restoreContinuousScrollPosition } from "./rendition.js";

const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

export function createReaderResumeController({
  getRendition,getFlow,getPageMap,getPosition,getCfi,capturePosition,renewAccess,resetInput,
  resizeRendition,configureRendition,layoutChanged,onLayoutChanged
}={}){
  const state={anchor:null,cfi:"",scroll:null,running:null,capturing:null,queued:false,bound:false};
  let cleanup=null;

  function remember(position=getPosition?.()){
    const next=position||getPosition?.()||null;
    const cfi=next?.cfi||getCfi?.()||"";
    if(next)state.anchor={...next};
    if(cfi)state.cfi=cfi;
    return state.anchor;
  }

  function rememberNativeScroll(rendition=getRendition?.()){
    if(!rendition||getFlow?.()!=="scrolled-doc"){state.scroll=null;return null}
    const position=captureContinuousScrollPosition(rendition);
    if(position)state.scroll={rendition,position:{...position}};
    return position;
  }

  function capture(){
    if(state.capturing)return state.capturing;
    const rendition=getRendition?.();
    if(!rendition)return Promise.resolve(remember());
    const flow=getFlow?.()==="scrolled-doc"?"scrolled-doc":"paginated";
    /* Snapshot native Continuous geometry synchronously before currentLocation/Page Map work.
       Browser lifecycle events can adjust scroll anchoring while those async calls settle. */
    if(flow==="scrolled-doc")rememberNativeScroll(rendition);else state.scroll=null;
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

  async function restoreOnce(rendition,position,cfi,nativeScroll){
    try{await renewAccess?.()}catch(error){console.warn("Reader access resume renewal delayed",error)}
    if(rendition!==getRendition?.())return false;

    const flow=getFlow?.()==="scrolled-doc"?"scrolled-doc":"paginated";
    const changed=layoutChanged?.()===true;
    resetInput?.();

    /* A foreground/BFCache resume with unchanged Continuous geometry should preserve the
       exact native viewport, not reinterpret it through a CFI or device Page Map. Chromium
       and Firefox can move that viewport by a few lines during pageshow even when EPUB.js
       itself does no resize. Reapply the pre-suspend offset across paint while suppressing
       the Continuous manager's synthetic scroll handling. This snapshot is transient only;
       persistent progress remains CFI/Page Map owned. */
    if(flow==="scrolled-doc"&&!changed){
      if(nativeScroll){
        restoreContinuousScrollPosition(rendition,nativeScroll);
        await nextPaint();
        if(rendition!==getRendition?.())return false;
        restoreContinuousScrollPosition(rendition,nativeScroll);
      }
      return rendition===getRendition?.();
    }

    try{resizeRendition?.(rendition)}catch(error){console.warn("Reader resume resize skipped",error)}
    try{configureRendition?.(rendition,flow)}catch(error){console.warn("Reader resume spread update skipped",error)}
    await nextPaint();
    if(rendition!==getRendition?.())return false;

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

    /* Suspension/resize handlers capture before the viewport can move. Reuse that frozen
       semantic/native anchor here instead of sampling again after pageshow/reflow. */
    const position=state.anchor||getPosition?.()||null;
    const cfi=position?.cfi||state.cfi||getCfi?.()||"";
    const nativeScroll=state.scroll?.rendition===rendition?{...state.scroll.position}:null;
    const task=restoreOnce(rendition,position,cfi,nativeScroll).catch(error=>{
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
