/* Shadow Garden R4 — EPUB.js rendition lifecycle adapter. */

export function paginatedNeedsSinglePage(){
  const visualWidth=Number(window.visualViewport?.width),innerWidth=Number(window.innerWidth),clientWidth=Number(document.documentElement?.clientWidth);
  const widths=[visualWidth,innerWidth,clientWidth].filter(value=>Number.isFinite(value)&&value>0);
  const viewportWidth=widths.length?Math.min(...widths):0;
  const coarsePointer=window.matchMedia?.("(pointer: coarse)")?.matches===true;
  const mobileUa=navigator.userAgentData?.mobile===true||/Android|iPhone|iPod|Mobile/i.test(navigator.userAgent||"");
  return mobileUa||(viewportWidth>0&&viewportWidth<900)||(coarsePointer&&viewportWidth>0&&viewportWidth<=1024);
}

export function pageMapLayoutMetrics(viewerShell){
  const shell=viewerShell;
  const rect=shell?.getBoundingClientRect?.();
  const width=Math.max(320,Math.round(Number(rect?.width)||Number(shell?.clientWidth)||Number(window.innerWidth)||720));
  const height=Math.max(320,Math.round(Number(rect?.height)||Number(shell?.clientHeight)||Number(window.innerHeight)*.8||800));
  const single=paginatedNeedsSinglePage()||width<900;
  return{width,height,spread:single?"single":"spread"};
}

export function configureSpread(rendition,flow="paginated"){
  if(!rendition)return;
  try{
    if(flow==="paginated"){
      if(paginatedNeedsSinglePage())rendition.spread("none");
      else rendition.spread("auto",900);
    }else rendition.spread("none");
  }catch(error){console.warn("Reader spread configuration skipped",error)}
}

/* Continuous BFCache/foreground recovery needs the exact native viewport offset in addition
   to the persistent semantic CFI. Keep that transient geometry at the EPUB.js adapter
   boundary so the lifecycle controller does not own manager internals. */
export function captureContinuousScrollPosition(rendition){
  const manager=rendition?.manager;
  if(!manager)return null;
  const fullsize=manager.settings?.fullsize===true;
  if(fullsize){
    if(typeof window==="undefined")return null;
    return{top:Number(window.scrollY)||0,left:Number(window.scrollX)||0,fullsize:true};
  }
  const container=manager.container;
  if(!container)return null;
  return{top:Number(container.scrollTop)||0,left:Number(container.scrollLeft)||0,fullsize:false};
}

export function restoreContinuousScrollPosition(rendition,snapshot){
  const manager=rendition?.manager;
  if(!manager||!snapshot)return false;
  const fullsize=manager.settings?.fullsize===true;
  if(Boolean(snapshot.fullsize)!==fullsize)return false;
  const requestedTop=Math.max(0,Number(snapshot.top)||0),requestedLeft=Number(snapshot.left)||0;
  const now=globalThis.performance?.now?.()||Date.now();
  manager.__sgSuppressScrollUntil=now+240;

  let top=requestedTop,left=requestedLeft;
  if(fullsize){
    if(typeof window==="undefined")return false;
    const doc=document.documentElement,body=document.body;
    const maxTop=Math.max(0,Math.max(Number(doc?.scrollHeight)||0,Number(body?.scrollHeight)||0)-Number(window.innerHeight||0));
    top=Math.min(requestedTop,maxTop);
    window.scrollTo(left,top);
    top=Number(window.scrollY)||0;left=Number(window.scrollX)||0;
  }else{
    const container=manager.container;
    if(!container)return false;
    const maxTop=Math.max(0,(Number(container.scrollHeight)||0)-(Number(container.clientHeight)||0));
    top=Math.min(requestedTop,maxTop);
    container.scrollTop=top;
    container.scrollLeft=left;
    top=Number(container.scrollTop)||0;left=Number(container.scrollLeft)||0;
  }

  manager.scrollTop=top;manager.scrollLeft=left;
  manager.prevScrollTop=top;manager.prevScrollLeft=left;
  manager.scrollDeltaVert=0;manager.scrollDeltaHorz=0;manager.didScroll=false;manager.ignore=false;
  return true;
}

/* EPUB.js versions differ in whether ContinuousManager keeps `scrolled` callable after
   internal lifecycle work. Shadow Garden's Continuous core deliberately routes scroll
   events through manager._scrolled, so keep that debounce defensive at the rendition
   boundary instead of allowing a late callback to throw after a flow switch/relayout. */
export function stabilizeContinuousScrollLifecycle(rendition){
  const manager=rendition?.manager;
  if(!manager||manager.__sgSafeScrollLifecycle)return Boolean(manager?.__sgSafeScrollLifecycle);
  const current=manager._scrolled;
  if(typeof current!=="function")return false;
  let timer=0;
  const safe=(...args)=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      timer=0;
      if(manager.__sgDestroyed)return;
      const scrolled=manager.scrolled;
      if(typeof scrolled==="function")scrolled.apply(manager,args);
    },30);
  };
  safe.cancel=()=>{clearTimeout(timer);timer=0;try{current.cancel?.()}catch{}};
  try{current.cancel?.()}catch{}
  manager._scrolled=safe;
  manager.__sgSafeScrollLifecycle=true;
  return true;
}

export function createRendition({book,target,viewerId="viewer",flow="paginated",wire,onCreate,themeCss}={}){
  if(!book)throw new Error("EPUB is not open");
  const scrolled=flow==="scrolled-doc",singlePage=!scrolled&&paginatedNeedsSinglePage();
  const rendition=book.renderTo(viewerId,{
    width:"100%",height:"100%",manager:scrolled?"continuous":"default",flow:scrolled?"scrolled-doc":"paginated",
    spread:scrolled||singlePage?"none":"auto",minSpreadWidth:900
  });
  onCreate?.(rendition);
  wire?.(rendition);
  try{if(themeCss)rendition.themes.default(themeCss)}catch{}
  configureSpread(rendition,flow);
  return rendition.display(target||undefined).then(()=>{
    if(scrolled)stabilizeContinuousScrollLifecycle(rendition);
    return rendition;
  });
}

export async function captureRenditionPosition({rendition,flow,pageMap,fallback}={}){
  if(!rendition)return fallback||null;
  let location=rendition.location;
  try{
    const live=rendition.currentLocation?.();
    if(live&&typeof live.then==="function")location=await live;else if(live)location=live;
  }catch{}
  return pageMap?.positionForLocation?.(location,{rendition,flow})||fallback||null;
}

export function destroyRendition(rendition,viewer){
  try{rendition?.destroy?.()}catch(error){console.warn("Old rendition cleanup skipped",error)}
  if(viewer)viewer.innerHTML="";
}
