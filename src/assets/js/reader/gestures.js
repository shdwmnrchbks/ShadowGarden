/* Shadow Garden R4 — one owner for swipe, wheel, pinch, pan and zoom. */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const distance=(a,b)=>Math.hypot((Number(a?.screenX)||0)-(Number(b?.screenX)||0),(Number(a?.screenY)||0)-(Number(b?.screenY)||0));
const midpoint=(a,b)=>({screenX:((Number(a?.screenX)||0)+(Number(b?.screenX)||0))/2,screenY:((Number(a?.screenY)||0)+(Number(b?.screenY)||0))/2});

function interactiveTarget(target){
  return typeof target?.closest==="function"&&Boolean(target.closest("a,button,input,select,textarea,label,[contenteditable=true],[role=button],[role=slider]"));
}
function hasSelection(doc){try{return Boolean(doc?.getSelection?.()?.toString().trim())}catch{return false}}
function isVisualDocument(doc){return doc?.body?.dataset?.sgSyntheticVisual==="1"||Boolean(doc?.querySelector?.(".sg-synthetic-visual-page"))}

export function createGestureController({
  viewport,
  layer,
  getFlow,
  getSwipeTurns,
  turn,
  zoomValue,
  zoomInButton,
  zoomOutButton,
  zoomResetButton
}={}){
  const docs=new Set();
  const finePointer=window.matchMedia?.("(pointer:fine)");
  const desktop=window.matchMedia?.("(min-width:900px)");
  const state={scale:1,x:0,y:0,maxScale:3,gesture:null,lastTap:null,suppressClickUntil:0,wheelAccumulated:0,lastWheelTurn:0};

  function bounds(scale=state.scale){
    const width=Math.max(1,Number(viewport?.clientWidth)||Number(window.innerWidth)||1);
    const height=Math.max(1,Number(viewport?.clientHeight)||Number(window.innerHeight)||1);
    return{minX:width*(1-scale),maxX:0,minY:height*(1-scale),maxY:0};
  }
  function clampPan(x,y,scale=state.scale){
    if(scale<=1.001)return{x:0,y:0};
    const box=bounds(scale);
    return{x:clamp(x,box.minX,box.maxX),y:clamp(y,box.minY,box.maxY)};
  }
  function syncDocuments(){
    const zoomed=state.scale>1.001;
    for(const doc of [...docs]){
      if(!doc?.documentElement){docs.delete(doc);continue}
      doc.documentElement.dataset.sgReaderZoomed=zoomed?"1":"0";
      doc.documentElement.dataset.sgReaderFlow=getFlow?.()==="scrolled-doc"?"scrolled":"paginated";
    }
  }
  function syncUi(){
    if(layer)layer.style.transform=`translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`;
    const zoomed=state.scale>1.001;
    document.body.classList.toggle("reader-zoomed",zoomed);
    if(zoomValue)zoomValue.textContent=`${Math.round(state.scale*100)}%`;
    if(zoomOutButton)zoomOutButton.disabled=state.scale<=1.001;
    if(zoomResetButton)zoomResetButton.disabled=state.scale<=1.001;
    if(zoomInButton)zoomInButton.disabled=state.scale>=state.maxScale-.001;
    syncDocuments();
  }
  function setTransform(scale,x=state.x,y=state.y,{maxScale=state.maxScale}={}){
    state.maxScale=Math.max(1,Number(maxScale)||3);
    state.scale=clamp(scale,1,state.maxScale);
    const pan=clampPan(x,y,state.scale);
    state.x=pan.x;state.y=pan.y;
    if(state.scale<=1.001){state.scale=1;state.x=0;state.y=0}
    syncUi();
    return state.scale;
  }
  function zoomAt(scale,point={x:(viewport?.clientWidth||0)/2,y:(viewport?.clientHeight||0)/2},maxScale=state.maxScale){
    const next=clamp(scale,1,maxScale);
    const old=Math.max(1,state.scale);
    const px=Number(point.x)||0,py=Number(point.y)||0;
    const contentX=(px-state.x)/old,contentY=(py-state.y)/old;
    return setTransform(next,px-contentX*next,py-contentY*next,{maxScale});
  }
  function reset({silent=false}={}){
    const changed=state.scale>1.001||state.x!==0||state.y!==0;
    state.maxScale=3;
    setTransform(1,0,0,{maxScale:3});
    state.gesture=null;
    if(changed&&!silent)state.suppressClickUntil=Date.now()+120;
  }
  function zoomIn(){zoomAt(Math.min(state.maxScale,state.scale+.35))}
  function zoomOut(){zoomAt(Math.max(1,state.scale-.35))}
  function zoomPointForDocument(doc,touch){
    const rect=viewport?.getBoundingClientRect?.()||{left:0,top:0};
    const frame=doc?.defaultView?.frameElement;
    const frameRect=frame?.getBoundingClientRect?.();
    if(frameRect)return{x:frameRect.left-rect.left+(Number(touch?.clientX)||0),y:frameRect.top-rect.top+(Number(touch?.clientY)||0)};
    return{x:(Number(touch?.clientX)||0)-rect.left,y:(Number(touch?.clientY)||0)-rect.top};
  }
  function prevent(event){try{event?.preventDefault?.()}catch{}}

  function beginTouch(event,doc){
    const touches=event.touches||[];
    if(touches.length>=2){
      const a=touches[0],b=touches[1],mid=midpoint(a,b);
      state.maxScale=isVisualDocument(doc)?4:3;
      state.gesture={
        mode:"pinch",
        distance:Math.max(1,distance(a,b)),
        scale:state.scale,
        x:state.x,y:state.y,
        midpoint:mid,
        anchor:zoomPointForDocument(doc,{clientX:((Number(a.clientX)||0)+(Number(b.clientX)||0))/2,clientY:((Number(a.clientY)||0)+(Number(b.clientY)||0))/2})
      };
      prevent(event);return;
    }
    const touch=touches[0];
    if(!touch||interactiveTarget(event.target)){state.gesture=null;return}
    if(state.scale>1.001){
      state.gesture={mode:"pan",screenX:Number(touch.screenX)||0,screenY:Number(touch.screenY)||0,x:state.x,y:state.y};
      prevent(event);return;
    }
    state.gesture={mode:"swipe",screenX:Number(touch.screenX)||0,screenY:Number(touch.screenY)||0,clientX:Number(touch.clientX)||0,clientY:Number(touch.clientY)||0,at:performance.now(),interactive:false,doc};
  }

  function moveTouch(event,doc){
    const gesture=state.gesture,touches=event.touches||[];
    if(!gesture)return;
    if(gesture.mode==="pinch"&&touches.length>=2){
      const a=touches[0],b=touches[1],ratio=distance(a,b)/gesture.distance;
      const next=clamp(gesture.scale*ratio,1,state.maxScale);
      const current=midpoint(a,b);
      const dx=current.screenX-gesture.midpoint.screenX,dy=current.screenY-gesture.midpoint.screenY;
      const contentX=(gesture.anchor.x-gesture.x)/gesture.scale;
      const contentY=(gesture.anchor.y-gesture.y)/gesture.scale;
      setTransform(next,gesture.anchor.x-contentX*next+dx,gesture.anchor.y-contentY*next+dy,{maxScale:state.maxScale});
      prevent(event);return;
    }
    if(gesture.mode==="pan"&&touches.length){
      const touch=touches[0];
      setTransform(state.scale,gesture.x+(Number(touch.screenX)||0)-gesture.screenX,gesture.y+(Number(touch.screenY)||0)-gesture.screenY);
      prevent(event);
    }
  }

  function finishTapOrSwipe(event,doc){
    const gesture=state.gesture;
    state.gesture=null;
    if(!gesture)return;
    if(gesture.mode==="pinch"||gesture.mode==="pan"){
      state.suppressClickUntil=Date.now()+260;
      if(state.scale<1.04)reset({silent:true});
      prevent(event);return;
    }
    if(gesture.mode!=="swipe"||hasSelection(doc))return;
    const touch=event.changedTouches?.[0];if(!touch)return;
    const dx=(Number(touch.screenX)||0)-gesture.screenX,dy=(Number(touch.screenY)||0)-gesture.screenY,elapsed=performance.now()-gesture.at;
    if(getFlow?.()==="paginated"&&getSwipeTurns?.()!==false&&elapsed<1000&&Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.18){
      state.suppressClickUntil=Date.now()+420;prevent(event);turn?.(dx<0?1:-1);return;
    }
    if(elapsed>360||Math.hypot(dx,dy)>24)return;
    const now=Date.now(),point=zoomPointForDocument(doc,touch),last=state.lastTap;
    if(last&&now-last.at<320&&Math.hypot((Number(touch.screenX)||0)-last.screenX,(Number(touch.screenY)||0)-last.screenY)<42){
      state.lastTap=null;state.suppressClickUntil=now+360;prevent(event);
      if(state.scale>1.001)reset({silent:true});
      else{state.maxScale=isVisualDocument(doc)?4:3;zoomAt(2.2,point,state.maxScale)}
    }else state.lastTap={at:now,screenX:Number(touch.screenX)||0,screenY:Number(touch.screenY)||0};
  }

  function normalizeWheel(event){
    let y=Number(event.deltaY)||0,x=Number(event.deltaX)||0;
    if(event.deltaMode===1){x*=18;y*=18}else if(event.deltaMode===2){x*=window.innerWidth;y*=window.innerHeight}
    return{x,y};
  }
  function handleWheel(event,doc=null){
    const delta=normalizeWheel(event);
    const point=doc?zoomPointForDocument(doc,event):(()=>{const rect=viewport?.getBoundingClientRect?.()||{left:0,top:0};return{x:(Number(event.clientX)||0)-rect.left,y:(Number(event.clientY)||0)-rect.top}})();
    if(event.ctrlKey||event.metaKey){
      prevent(event);state.maxScale=isVisualDocument(doc)?4:Math.max(3,state.maxScale);zoomAt(state.scale*Math.exp(-delta.y*.0022),point,state.maxScale);return;
    }
    if(state.scale>1.001){prevent(event);setTransform(state.scale,state.x-delta.x,state.y-delta.y);return}
    if(getFlow?.()!=="paginated"||finePointer?.matches===false||desktop?.matches===false)return;
    if(Math.abs(delta.y)<Math.abs(delta.x))return;
    prevent(event);
    const now=performance.now();if(now-state.lastWheelTurn<190)return;
    state.wheelAccumulated+=delta.y;
    if(Math.abs(state.wheelAccumulated)<48)return;
    const direction=state.wheelAccumulated>0?1:-1;state.wheelAccumulated=0;state.lastWheelTurn=now;turn?.(direction);
  }

  function installDocument(doc){
    if(!doc?.documentElement||doc.documentElement.dataset.sgReaderGestures==="1")return;
    doc.documentElement.dataset.sgReaderGestures="1";docs.add(doc);
    try{
      const style=doc.createElement("style");
      style.id="sg-reader-gesture-style";
      style.textContent="html,body{overscroll-behavior:contain!important;touch-action:pan-y!important}html[data-sg-reader-zoomed='1'],html[data-sg-reader-zoomed='1'] body{touch-action:none!important;overscroll-behavior:none!important}";
      doc.head?.appendChild(style);
    }catch{}
    doc.addEventListener("touchstart",event=>beginTouch(event,doc),{capture:true,passive:false});
    doc.addEventListener("touchmove",event=>moveTouch(event,doc),{capture:true,passive:false});
    doc.addEventListener("touchcancel",()=>{state.gesture=null},{capture:true,passive:true});
    doc.addEventListener("touchend",event=>finishTapOrSwipe(event,doc),{capture:true,passive:false});
    doc.addEventListener("wheel",event=>handleWheel(event,doc),{capture:true,passive:false});
    doc.addEventListener("click",event=>{
      if(Date.now()<state.suppressClickUntil&&!interactiveTarget(event.target)){event.preventDefault();event.stopImmediatePropagation()}
    },true);
    syncDocuments();
  }

  function attachRendition(rendition){
    if(!rendition||rendition.__sgR4Gestures)return;
    rendition.__sgR4Gestures=true;
    try{rendition.hooks?.content?.register?.(contents=>installDocument(contents?.document||contents?.contentDocument))}catch(error){console.warn("Reader gesture content hook unavailable",error)}
    try{rendition.on?.("rendered",(_section,view)=>installDocument(view?.contents?.document||view?.contents?.contentDocument))}catch{}
    try{rendition.getContents?.().forEach(contents=>installDocument(contents?.document||contents?.contentDocument))}catch{}
  }

  viewport?.addEventListener("wheel",event=>handleWheel(event),{capture:true,passive:false});
  zoomInButton?.addEventListener("click",zoomIn);
  zoomOutButton?.addEventListener("click",zoomOut);
  zoomResetButton?.addEventListener("click",()=>reset());
  window.addEventListener("resize",()=>setTransform(state.scale,state.x,state.y));
  document.addEventListener("keydown",event=>{
    if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
    if(event.key==="0"&&(event.ctrlKey||event.metaKey)){event.preventDefault();reset();return}
    if((event.key==="+"||event.key==="=")&&(event.ctrlKey||event.metaKey)){event.preventDefault();zoomIn();return}
    if(event.key==="-"&&(event.ctrlKey||event.metaKey)){event.preventDefault();zoomOut()}
  });
  syncUi();

  return{
    attachRendition,installDocument,reset,zoomIn,zoomOut,zoomAt,
    scale:()=>state.scale,
    isZoomed:()=>state.scale>1.001,
    syncFlow:syncDocuments
  };
}
