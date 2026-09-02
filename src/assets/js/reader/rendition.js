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

function continuousViewport(manager){
  const fullsize=manager?.settings?.fullsize===true;
  if(fullsize){
    if(typeof window==="undefined")return null;
    return{fullsize:true,top:0,left:0,height:Math.max(1,Number(window.innerHeight)||1),width:Math.max(1,Number(window.innerWidth)||1)};
  }
  const container=manager?.container;
  if(!container)return null;
  const rect=container.getBoundingClientRect?.()||{top:0,left:0,width:container.clientWidth,height:container.clientHeight};
  return{
    fullsize:false,
    top:Number(rect.top)||0,left:Number(rect.left)||0,
    height:Math.max(1,Number(container.clientHeight)||Number(rect.height)||1),
    width:Math.max(1,Number(container.clientWidth)||Number(rect.width)||1)
  };
}

function continuousViews(manager){
  try{
    const all=manager?.views?.all?.();
    return Array.isArray(all)?all:[];
  }catch{return[]}
}

function viewIdentity(view){
  const section=view?.section;
  const index=Number(section?.index??view?.index);
  return{
    index:Number.isFinite(index)?index:null,
    href:String(section?.href||""),
    id:String(view?.id||"")
  };
}

function findContinuousAnchorView(manager,viewport){
  const targetY=viewport.top+Math.min(viewport.height*.3,Math.max(1,viewport.height-1));
  let best=null;
  for(const view of continuousViews(manager)){
    const element=view?.element;
    if(!element?.getBoundingClientRect)continue;
    const rect=element.getBoundingClientRect();
    const top=Number(rect.top),bottom=Number(rect.bottom);
    if(!Number.isFinite(top)||!Number.isFinite(bottom)||bottom<=top)continue;
    const distance=targetY<top?top-targetY:targetY>bottom?targetY-bottom:0;
    if(!best||distance<best.distance)best={view,rect,distance};
  }
  return best;
}

function resolveContinuousAnchorView(manager,snapshot){
  const views=continuousViews(manager);
  if(snapshot?.index!==null&&snapshot?.index!==undefined){
    const byIndex=views.find(view=>Number(view?.section?.index??view?.index)===Number(snapshot.index));
    if(byIndex)return byIndex;
  }
  if(snapshot?.href){
    const byHref=views.find(view=>String(view?.section?.href||"")===String(snapshot.href));
    if(byHref)return byHref;
  }
  if(snapshot?.id)return views.find(view=>String(view?.id||"")===String(snapshot.id))||null;
  return null;
}

/* Continuous buffering deliberately changes absolute scrollTop when views are prepended or
   trimmed. Capture the visible EPUB view relative to the Reader viewport instead; that
   content-relative geometry survives those manager mutations while remaining transient. */
export function captureContinuousScrollPosition(rendition){
  const manager=rendition?.manager;
  const viewport=continuousViewport(manager);
  if(!manager||!viewport)return null;
  const anchor=findContinuousAnchorView(manager,viewport);
  if(!anchor)return null;
  const identity=viewIdentity(anchor.view);
  return{
    ...identity,
    top:(Number(anchor.rect.top)||0)-viewport.top,
    left:(Number(anchor.rect.left)||0)-viewport.left,
    fullsize:viewport.fullsize
  };
}

export function restoreContinuousScrollPosition(rendition,snapshot){
  const manager=rendition?.manager;
  const viewport=continuousViewport(manager);
  if(!manager||!snapshot||!viewport||Boolean(snapshot.fullsize)!==viewport.fullsize)return false;
  const view=resolveContinuousAnchorView(manager,snapshot);
  const element=view?.element;
  if(!element?.getBoundingClientRect)return false;
  const rect=element.getBoundingClientRect();
  const currentTop=(Number(rect.top)||0)-viewport.top;
  const currentLeft=(Number(rect.left)||0)-viewport.left;
  const deltaTop=currentTop-(Number(snapshot.top)||0);
  const deltaLeft=currentLeft-(Number(snapshot.left)||0);
  if(!Number.isFinite(deltaTop)||!Number.isFinite(deltaLeft))return false;

  const now=globalThis.performance?.now?.()||Date.now();
  manager.__sgSuppressScrollUntil=now+320;
  try{manager._scrolled?.cancel?.()}catch{}

  if(Math.abs(deltaTop)>=.5||Math.abs(deltaLeft)>=.5){
    if(viewport.fullsize){
      if(typeof window==="undefined")return false;
      window.scrollBy(deltaLeft,deltaTop);
    }else{
      const container=manager.container;
      if(!container)return false;
      const maxTop=Math.max(0,(Number(container.scrollHeight)||0)-(Number(container.clientHeight)||0));
      const maxLeft=Math.max(0,(Number(container.scrollWidth)||0)-(Number(container.clientWidth)||0));
      container.scrollTop=Math.max(0,Math.min(maxTop,(Number(container.scrollTop)||0)+deltaTop));
      container.scrollLeft=Math.max(0,Math.min(maxLeft,(Number(container.scrollLeft)||0)+deltaLeft));
    }
  }

  const top=viewport.fullsize?Number(window.scrollY)||0:Number(manager.container?.scrollTop)||0;
  const left=viewport.fullsize?Number(window.scrollX)||0:Number(manager.container?.scrollLeft)||0;
  manager.scrollTop=top;manager.scrollLeft=left;
  manager.prevScrollTop=top;manager.prevScrollLeft=left;
  manager.scrollDeltaVert=0;manager.scrollDeltaHorz=0;manager.didScroll=false;
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
  const clock=()=>globalThis.performance?.now?.()||Date.now();
  const suppressed=()=>Number(manager.__sgSuppressScrollUntil||0)>clock();
  const safe=(...args)=>{
    clearTimeout(timer);timer=0;
    if(suppressed())return;
    timer=setTimeout(()=>{
      timer=0;
      if(manager.__sgDestroyed||suppressed())return;
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
