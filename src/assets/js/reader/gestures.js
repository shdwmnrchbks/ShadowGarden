/* Shadow Garden v1.18.2 — page navigation plus image-focus gestures. */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const distance=(a,b)=>Math.hypot((Number(a?.clientX)||0)-(Number(b?.clientX)||0),(Number(a?.clientY)||0)-(Number(b?.clientY)||0));
const midpoint=(a,b)=>({x:((Number(a?.clientX)||0)+(Number(b?.clientX)||0))/2,y:((Number(a?.clientY)||0)+(Number(b?.clientY)||0))/2});

function interactiveTarget(target){
  return typeof target?.closest==="function"&&Boolean(target.closest("a,button,input,select,textarea,label,[contenteditable=true],[role=button],[role=slider]"));
}
function hasSelection(doc){try{return Boolean(doc?.getSelection?.()?.toString().trim())}catch{return false}}
function imageTarget(target){return typeof target?.closest==="function"?target.closest("img"):null}
function imageSource(image,doc){
  const raw=String(image?.currentSrc||image?.src||image?.getAttribute?.("src")||"").trim();
  if(!raw)return"";
  try{return new URL(raw,doc?.baseURI||location.href).href}catch{return raw}
}

export function createGestureController({
  getFlow,
  getSwipeTurns,
  turn,
  imageFocus,
  imageFocusViewport,
  imageFocusLayer,
  imageFocusImage,
  imageFocusClose
}={}){
  const docs=new Set();
  const finePointer=window.matchMedia?.("(pointer:fine)");
  const desktop=window.matchMedia?.("(min-width:900px)");
  const state={swipe:null,suppressClickUntil:0,wheelAccumulated:0,lastWheelTurn:0,returnFocus:null,focus:{active:false,scale:1,x:0,y:0,maxScale:4,gesture:null}};

  function focusBounds(scale=state.focus.scale){
    const width=Math.max(1,Number(imageFocusViewport?.clientWidth)||Number(window.innerWidth)||1);
    const height=Math.max(1,Number(imageFocusViewport?.clientHeight)||Number(window.innerHeight)||1);
    return{minX:width*(1-scale),maxX:0,minY:height*(1-scale),maxY:0};
  }
  function clampFocusPan(x,y,scale=state.focus.scale){
    if(scale<=1.001)return{x:0,y:0};
    const box=focusBounds(scale);
    return{x:clamp(x,box.minX,box.maxX),y:clamp(y,box.minY,box.maxY)};
  }
  function renderFocus(){
    const focus=state.focus;
    if(imageFocusLayer)imageFocusLayer.style.transform=`translate3d(${focus.x}px,${focus.y}px,0) scale(${focus.scale})`;
    document.body.classList.toggle("reader-image-focused",focus.active);
  }
  function setFocusTransform(scale,x=state.focus.x,y=state.focus.y){
    const focus=state.focus;
    focus.scale=clamp(scale,1,focus.maxScale);
    const pan=clampFocusPan(x,y,focus.scale);
    focus.x=pan.x;focus.y=pan.y;
    if(focus.scale<=1.001){focus.scale=1;focus.x=0;focus.y=0}
    renderFocus();
    return focus.scale;
  }
  function focusZoomAt(scale,point={x:(imageFocusViewport?.clientWidth||0)/2,y:(imageFocusViewport?.clientHeight||0)/2}){
    const focus=state.focus,next=clamp(scale,1,focus.maxScale),old=Math.max(1,focus.scale);
    const px=Number(point.x)||0,py=Number(point.y)||0;
    const contentX=(px-focus.x)/old,contentY=(py-focus.y)/old;
    return setFocusTransform(next,px-contentX*next,py-contentY*next);
  }
  function openImageFocus(image,doc){
    const src=imageSource(image,doc);if(!src||!imageFocus||!imageFocusImage)return false;
    state.returnFocus=document.activeElement;
    state.focus.active=true;state.focus.scale=1;state.focus.x=0;state.focus.y=0;state.focus.gesture=null;
    imageFocusImage.src=src;
    imageFocusImage.alt=String(image?.alt||"Book image");
    imageFocus.classList.remove("hidden");
    imageFocus.setAttribute("aria-hidden","false");
    renderFocus();
    requestAnimationFrame(()=>imageFocusClose?.focus?.({preventScroll:true}));
    return true;
  }
  function closeImageFocus({restoreFocus=true}={}){
    if(!state.focus.active)return false;
    state.focus.active=false;state.focus.scale=1;state.focus.x=0;state.focus.y=0;state.focus.gesture=null;
    if(imageFocusLayer)imageFocusLayer.style.transform="";
    imageFocus?.classList.add("hidden");imageFocus?.setAttribute("aria-hidden","true");
    if(imageFocusImage){imageFocusImage.removeAttribute("src");imageFocusImage.alt=""}
    document.body.classList.remove("reader-image-focused");
    if(restoreFocus&&state.returnFocus&&document.contains(state.returnFocus))requestAnimationFrame(()=>state.returnFocus?.focus?.({preventScroll:true}));
    state.returnFocus=null;
    return true;
  }
  function reset(){
    state.swipe=null;state.wheelAccumulated=0;closeImageFocus({restoreFocus:false});
  }

  function beginSwipe(event,doc){
    if(state.focus.active||getFlow?.()!=="paginated"||getSwipeTurns?.()===false)return;
    const touches=event.touches||[];if(touches.length!==1||interactiveTarget(event.target))return;
    const touch=touches[0];
    state.swipe={screenX:Number(touch.screenX)||0,screenY:Number(touch.screenY)||0,at:performance.now(),doc};
  }
  function finishSwipe(event,doc){
    const swipe=state.swipe;state.swipe=null;
    if(!swipe||getFlow?.()!=="paginated"||getSwipeTurns?.()===false||hasSelection(doc))return;
    const touch=event.changedTouches?.[0];if(!touch)return;
    const dx=(Number(touch.screenX)||0)-swipe.screenX,dy=(Number(touch.screenY)||0)-swipe.screenY,elapsed=performance.now()-swipe.at;
    if(elapsed<1000&&Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.18){
      state.suppressClickUntil=Date.now()+420;
      try{event.preventDefault()}catch{}
      turn?.(dx<0?1:-1);
    }
  }

  function normalizeWheel(event){
    let y=Number(event.deltaY)||0,x=Number(event.deltaX)||0;
    if(event.deltaMode===1){x*=18;y*=18}else if(event.deltaMode===2){x*=window.innerWidth;y*=window.innerHeight}
    return{x,y};
  }
  function handleReaderWheel(event){
    if(state.focus.active||getFlow?.()!=="paginated"||finePointer?.matches===false||desktop?.matches===false)return;
    const delta=normalizeWheel(event);if(Math.abs(delta.y)<Math.abs(delta.x))return;
    try{event.preventDefault()}catch{}
    const now=performance.now();if(now-state.lastWheelTurn<190)return;
    state.wheelAccumulated+=delta.y;
    if(Math.abs(state.wheelAccumulated)<48)return;
    const direction=state.wheelAccumulated>0?1:-1;state.wheelAccumulated=0;state.lastWheelTurn=now;turn?.(direction);
  }

  function installDocument(doc){
    if(!doc?.documentElement||doc.documentElement.dataset.sgReaderGestures==="1")return;
    doc.documentElement.dataset.sgReaderGestures="1";docs.add(doc);
    try{
      const style=doc.createElement("style");style.id="sg-reader-gesture-style";style.textContent="img{cursor:zoom-in}";doc.head?.appendChild(style);
    }catch{}
    doc.addEventListener("touchstart",event=>beginSwipe(event,doc),{capture:true,passive:true});
    doc.addEventListener("touchcancel",()=>{state.swipe=null},{capture:true,passive:true});
    doc.addEventListener("touchend",event=>finishSwipe(event,doc),{capture:true,passive:false});
    doc.addEventListener("wheel",handleReaderWheel,{capture:true,passive:false});
    doc.addEventListener("click",event=>{
      const image=imageTarget(event.target);
      if(image){
        if(Date.now()<state.suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();return}
        event.preventDefault();event.stopImmediatePropagation();openImageFocus(image,doc);return;
      }
      if(Date.now()<state.suppressClickUntil&&!interactiveTarget(event.target)){event.preventDefault();event.stopImmediatePropagation()}
    },true);
  }

  function attachRendition(rendition){
    if(!rendition||rendition.__sgR4Gestures)return;
    rendition.__sgR4Gestures=true;
    try{rendition.hooks?.content?.register?.(contents=>installDocument(contents?.document||contents?.contentDocument))}catch(error){console.warn("Reader gesture content hook unavailable",error)}
    try{rendition.on?.("rendered",(_section,view)=>installDocument(view?.contents?.document||view?.contents?.contentDocument))}catch{}
    try{rendition.getContents?.().forEach(contents=>installDocument(contents?.document||contents?.contentDocument))}catch{}
  }

  function beginFocusTouch(event){
    if(!state.focus.active)return;
    const touches=event.touches||[];
    if(touches.length>=2){
      const a=touches[0],b=touches[1];
      state.focus.gesture={mode:"pinch",distance:Math.max(1,distance(a,b)),scale:state.focus.scale,x:state.focus.x,y:state.focus.y,midpoint:midpoint(a,b)};
      event.preventDefault();return;
    }
    const touch=touches[0];if(!touch)return;
    if(state.focus.scale>1.001)state.focus.gesture={mode:"pan",clientX:Number(touch.clientX)||0,clientY:Number(touch.clientY)||0,x:state.focus.x,y:state.focus.y};
    else state.focus.gesture={mode:"tap",clientX:Number(touch.clientX)||0,clientY:Number(touch.clientY)||0};
    event.preventDefault();
  }
  function moveFocusTouch(event){
    const gesture=state.focus.gesture,touches=event.touches||[];if(!gesture)return;
    if(gesture.mode==="pinch"&&touches.length>=2){
      const a=touches[0],b=touches[1],ratio=distance(a,b)/gesture.distance,current=midpoint(a,b),next=clamp(gesture.scale*ratio,1,state.focus.maxScale);
      const contentX=(gesture.midpoint.x-gesture.x)/gesture.scale,contentY=(gesture.midpoint.y-gesture.y)/gesture.scale;
      setFocusTransform(next,current.x-contentX*next,current.y-contentY*next);event.preventDefault();return;
    }
    if(gesture.mode==="pan"&&touches.length){
      const touch=touches[0];setFocusTransform(state.focus.scale,gesture.x+(Number(touch.clientX)||0)-gesture.clientX,gesture.y+(Number(touch.clientY)||0)-gesture.clientY);event.preventDefault();return;
    }
    if(gesture.mode==="tap"&&touches.length){
      const touch=touches[0];if(Math.hypot((Number(touch.clientX)||0)-gesture.clientX,(Number(touch.clientY)||0)-gesture.clientY)>12)gesture.mode="moved";
      event.preventDefault();
    }
  }
  function endFocusTouch(event){
    const gesture=state.focus.gesture;if(!gesture)return;
    if(gesture.mode==="pinch"&&event.touches?.length===1){
      const touch=event.touches[0];state.focus.gesture={mode:"pan",clientX:Number(touch.clientX)||0,clientY:Number(touch.clientY)||0,x:state.focus.x,y:state.focus.y};event.preventDefault();return;
    }
    state.focus.gesture=null;
    if(gesture.mode==="tap"){
      state.suppressClickUntil=Date.now()+400;event.preventDefault();closeImageFocus();return;
    }
    if(gesture.mode==="pinch"||gesture.mode==="pan"||gesture.mode==="moved"){
      state.suppressClickUntil=Date.now()+300;event.preventDefault();
    }
  }
  function focusWheel(event){
    if(!state.focus.active)return;
    event.preventDefault();const delta=normalizeWheel(event);
    if(event.ctrlKey||event.metaKey){
      const rect=imageFocusViewport?.getBoundingClientRect?.()||{left:0,top:0};
      focusZoomAt(state.focus.scale*Math.exp(-delta.y*.0022),{x:(Number(event.clientX)||0)-rect.left,y:(Number(event.clientY)||0)-rect.top});return;
    }
    if(state.focus.scale>1.001)setFocusTransform(state.focus.scale,state.focus.x-delta.x,state.focus.y-delta.y);
  }

  imageFocusViewport?.addEventListener("touchstart",beginFocusTouch,{passive:false});
  imageFocusViewport?.addEventListener("touchmove",moveFocusTouch,{passive:false});
  imageFocusViewport?.addEventListener("touchend",endFocusTouch,{passive:false});
  imageFocusViewport?.addEventListener("touchcancel",()=>{state.focus.gesture=null},{passive:true});
  imageFocusViewport?.addEventListener("wheel",focusWheel,{passive:false});
  imageFocusViewport?.addEventListener("click",event=>{
    if(Date.now()<state.suppressClickUntil)return;
    event.preventDefault();closeImageFocus();
  });
  imageFocusClose?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();closeImageFocus()});
  window.addEventListener("resize",()=>{if(state.focus.active)setFocusTransform(state.focus.scale,state.focus.x,state.focus.y)});
  renderFocus();

  return{
    attachRendition,installDocument,reset,openImageFocus,closeImageFocus,
    isImageFocused:()=>state.focus.active,
    syncFlow:()=>{}
  };
}
