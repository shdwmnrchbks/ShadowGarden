/* Shadow Garden v1.1.5 — Continuous-mode startup, visual-page, and flow-anchor hardening.
 *
 * Keeps the reverse-scroll synchronization/stable retained views from v1.1.4, while:
 * - preserving the real viewport location when switching Paginated <-> Continuous;
 * - resolving Continuous display as soon as the requested section is ready, with fill/preload in background;
 * - giving pure cover/illustration XHTML deterministic, non-circular layout before first measurement.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const VISUAL_SELECTOR="img,svg,picture,video,object,canvas";
  const MEDIA_SELECTOR="img,svg image,video,object";
  const KEEP_VIEWS_EACH_SIDE=4;
  let activeRendition=null;
  let activeFlow="";
  let lastAnchor=null;
  let pendingFlowAnchor=null;

  const noAnchor=element=>{
    if(!element?.style)return;
    try{element.style.setProperty("overflow-anchor","none","important")}catch{}
  };

  const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

  function normalizeFlow(value){
    return value==="scrolled-doc"||value==="scrolled"||value==="scrolled-continuous"?"scrolled-doc":"paginated";
  }

  function anchorFromLocation(location){
    const start=location?.start;
    if(!start)return null;
    const cfi=typeof start.cfi==="string"?start.cfi:"";
    const href=typeof start.href==="string"?start.href:"";
    const percentage=Number(start.percentage);
    const index=Number(start.index);
    if(!cfi&&!href&&!Number.isFinite(index))return null;
    return{
      cfi,
      href,
      percentage:Number.isFinite(percentage)?Math.min(1,Math.max(0,percentage)):null,
      index:Number.isFinite(index)?index:null
    };
  }

  function captureRenditionAnchor(rendition=activeRendition){
    if(!rendition)return lastAnchor;
    try{
      const location=rendition.currentLocation?.();
      if(location&&typeof location.then!=="function"){
        const anchor=anchorFromLocation(location);
        if(anchor){lastAnchor=anchor;return anchor;}
      }
    }catch(error){console.warn("Flow anchor capture fell back to reported location",error)}
    const reported=anchorFromLocation(rendition.location);
    if(reported){lastAnchor=reported;return reported;}
    return lastAnchor;
  }

  /* Capture in the capture phase: reader.js handles this same change event later and
     destroys the old rendition. currentLocation() here still reflects the exact viewport. */
  document.addEventListener("change",event=>{
    if(event.target?.id!=="flowSelect")return;
    pendingFlowAnchor=captureRenditionAnchor(activeRendition);
  },true);

  function viewerElement(target){
    if(target&&typeof target==="object"&&target.nodeType===1)return target;
    if(typeof target==="string"){
      try{return document.getElementById(target)||document.querySelector(target)}catch{}
    }
    return document.getElementById("viewer");
  }

  function viewportHeight(manager,target){
    const viewer=viewerElement(target);
    const values=[
      Number(manager?.container?.clientHeight),
      Number(manager?._bounds?.height),
      Number(viewer?.clientHeight),
      Number(viewer?.getBoundingClientRect?.().height),
      Number(window.visualViewport?.height),
      Number(window.innerHeight)*0.72
    ].filter(value=>Number.isFinite(value)&&value>80);
    return Math.max(240,Math.round(values[0]||values[values.length-1]||640));
  }

  function viewportWidth(manager,target){
    const viewer=viewerElement(target);
    const values=[
      Number(manager?.container?.clientWidth),
      Number(manager?._bounds?.width),
      Number(viewer?.clientWidth),
      Number(viewer?.getBoundingClientRect?.().width),
      Number(window.visualViewport?.width),
      Number(window.innerWidth)
    ].filter(value=>Number.isFinite(value)&&value>80);
    return Math.max(240,Math.round(values[0]||values[values.length-1]||720));
  }

  function disableContentAnchoring(contents){
    const doc=contents?.document;
    if(!doc)return;
    noAnchor(doc.documentElement);
    noAnchor(doc.body);
  }

  function disableManagerAnchoring(rendition,target){
    const manager=rendition?.manager;
    noAnchor(manager?.container);
    noAnchor(manager?.stage?.container);
    noAnchor(manager?.stage?.element);
    const viewer=viewerElement(target);
    noAnchor(viewer);
    try{viewer?.querySelectorAll?.(".epub-container,.epub-view,iframe").forEach(noAnchor)}catch{}
  }

  function visualText(doc){
    return String(doc?.body?.innerText||doc?.body?.textContent||"").replace(/\s+/g," ").trim();
  }

  function isVisualDominant(doc){
    const body=doc?.body;
    if(!body||!body.querySelector(VISUAL_SELECTOR))return false;
    return visualText(doc).length<=320;
  }

  function isPureVisual(doc){
    return isVisualDominant(doc)&&visualText(doc).length<=24;
  }

  function normalizeVisualDocument(contents,manager,target){
    const doc=contents?.document,body=doc?.body;
    if(!doc?.head||!body||!isVisualDominant(doc))return false;

    const height=viewportHeight(manager,target);
    body.setAttribute("data-sg-visual-page","1");
    if(isPureVisual(doc))body.setAttribute("data-sg-pure-visual","1");
    else body.removeAttribute("data-sg-pure-visual");

    /* 100vh/percentage-height wrappers are circular inside EPUB.js auto-height iframes.
       Neutralize only the rendered copy; source EPUB XHTML remains untouched. */
    try{
      body.querySelectorAll("[style]").forEach(node=>{
        const heightValue=String(node.style?.height||"");
        const minHeightValue=String(node.style?.minHeight||"");
        if(/vh/i.test(heightValue)||/vh/i.test(minHeightValue))node.setAttribute("data-sg-vh-wrapper","1");
      });
    }catch{}

    let style=doc.getElementById("sg-continuous-visual-page");
    if(!style){
      style=doc.createElement("style");
      style.id="sg-continuous-visual-page";
      doc.head.appendChild(style);
    }
    style.textContent=`
      html,body{min-height:${height}px!important;overflow-anchor:none!important}
      body[data-sg-visual-page="1"]{min-height:${height}px!important}
      body[data-sg-visual-page="1"] [data-sg-vh-wrapper="1"]{height:auto!important;min-height:0!important;max-height:none!important}
      body[data-sg-visual-page="1"] img{display:block!important;max-width:100%!important;height:auto!important}
      body[data-sg-visual-page="1"] svg[viewBox]{display:block!important;width:100%!important;height:auto!important;max-width:100%!important}
      body[data-sg-visual-page="1"] picture{display:block!important;max-width:100%!important}
      body[data-sg-visual-page="1"] figure{max-width:100%!important}
      body[data-sg-pure-visual="1"]{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;box-sizing:border-box!important}
      body[data-sg-pure-visual="1"]>figure{width:100%!important;margin:0!important;padding:0!important}
      body[data-sg-pure-visual="1"] img{margin-left:auto!important;margin-right:auto!important}
    `;
    return true;
  }

  function svgAspectHeight(node,width){
    try{
      const vb=node?.viewBox?.baseVal;
      if(vb?.width>0&&vb?.height>0&&width>0)return width*(vb.height/vb.width);
      const text=node?.getAttribute?.("viewBox")||"";
      const nums=text.trim().split(/[\s,]+/).map(Number);
      if(nums.length===4&&nums[2]>0&&nums[3]>0&&width>0)return width*(nums[3]/nums[2]);
    }catch{}
    return 0;
  }

  function imageAspectHeight(node,width){
    const naturalWidth=Number(node?.naturalWidth)||0;
    const naturalHeight=Number(node?.naturalHeight)||0;
    if(naturalWidth>0&&naturalHeight>0&&width>0)return width*(naturalHeight/naturalWidth);
    return 0;
  }

  function visualHeight(contents,manager,target,rawHeight){
    const doc=contents?.document;
    if(!doc)return Number(rawHeight)||0;
    const viewport=viewportHeight(manager,target);
    const width=viewportWidth(manager,target);
    const cap=Math.max(viewport,viewport*8);
    normalizeVisualDocument(contents,manager,target);

    let measured=Math.max(viewport,Math.min(cap,Number(rawHeight)||0));
    const body=doc.body;
    try{
      const bodyTop=body?.getBoundingClientRect?.().top||0;
      doc.querySelectorAll(VISUAL_SELECTOR).forEach(node=>{
        const rect=node.getBoundingClientRect?.();
        if(rect&&Number.isFinite(rect.bottom)&&rect.bottom>bodyTop){
          measured=Math.max(measured,Math.min(cap,Math.ceil(rect.bottom-bodyTop)));
        }
        const tag=node.tagName;
        const basis=Math.max(1,Number(rect?.width)||Math.min(width,Number(body?.getBoundingClientRect?.().width)||width));
        if(tag==="SVG")measured=Math.max(measured,Math.min(cap,Math.ceil(svgAspectHeight(node,basis)||0)));
        if(tag==="IMG")measured=Math.max(measured,Math.min(cap,Math.ceil(imageAspectHeight(node,basis)||0)));
      });
    }catch{}
    return Math.max(1,viewport,Math.ceil(measured));
  }

  function prepareContents(contents,manager,target){
    if(!contents)return false;
    disableContentAnchoring(contents);
    if(!isVisualDominant(contents.document))return false;
    normalizeVisualDocument(contents,manager,target);
    if(!contents.__sgVisualHeightPatched&&typeof contents.textHeight==="function"){
      const rawTextHeight=contents.textHeight.bind(contents);
      contents.textHeight=()=>visualHeight(contents,manager,target,rawTextHeight());
      contents.__sgVisualHeightPatched=true;
    }
    return true;
  }

  function refreshView(view,manager,target){
    if(!view?.displayed)return;
    requestAnimationFrame(()=>{
      try{prepareContents(view.contents,manager,target)}catch{}
      try{view.stopExpanding=false;view.expand?.(true)}catch{}
      try{
        const result=manager?.update?.();
        if(result&&typeof result.catch==="function")result.catch(()=>{});
      }catch{}
    });
  }

  function armMediaRemeasure(view,manager,target){
    const contents=view?.contents,doc=contents?.document;
    if(!doc||doc.__sgMediaRemeasureArmed||!isVisualDominant(doc))return;
    doc.__sgMediaRemeasureArmed=true;
    prepareContents(contents,manager,target);

    const remeasure=()=>refreshView(view,manager,target);
    try{
      doc.querySelectorAll(MEDIA_SELECTOR).forEach(node=>{
        if(node.tagName==="IMG"&&node.complete)return;
        node.addEventListener?.("load",remeasure,{once:true,passive:true});
        node.addEventListener?.("error",remeasure,{once:true,passive:true});
        if(node.tagName==="VIDEO")node.addEventListener?.("loadedmetadata",remeasure,{once:true,passive:true});
      });
    }catch{}
    try{doc.fonts?.ready?.then(remeasure)?.catch?.(()=>{})}catch{}
    setTimeout(remeasure,80);
    setTimeout(remeasure,300);
    setTimeout(remeasure,900);
  }

  function patchView(view,manager,target){
    if(!view||view.__sgContinuousViewPatched)return view;
    view.__sgContinuousViewPatched=true;
    noAnchor(view.element);

    if(typeof view.create==="function"){
      const rawCreate=view.create.bind(view);
      view.create=(...args)=>{
        const iframe=rawCreate(...args);
        noAnchor(view.element);
        noAnchor(iframe);
        return iframe;
      };
    }

    if(typeof view.load==="function"){
      const rawLoad=view.load.bind(view);
      view.load=(...args)=>Promise.resolve(rawLoad(...args)).then(result=>{
        if(prepareContents(view.contents,manager,target))armMediaRemeasure(view,manager,target);
        return result;
      });
    }

    if(typeof view.expand==="function"){
      const rawExpand=view.expand.bind(view);
      view.expand=(...args)=>{
        try{prepareContents(view.contents,manager,target)}catch{}
        return rawExpand(...args);
      };
    }

    if(typeof view.show==="function"){
      const rawShow=view.show.bind(view);
      view.show=(...args)=>{
        noAnchor(view.element);
        noAnchor(view.iframe);
        view.stopExpanding=false;
        return rawShow(...args);
      };
    }
    return view;
  }

  function syncScrollPosition(manager){
    if(!manager)return{top:0,left:0};
    const dir=manager.settings?.direction==="rtl"&&manager.settings?.rtlScrollType==="default"?-1:1;
    let top=0,left=0;
    if(manager.settings?.fullsize){
      top=(Number(window.scrollY)||0)*dir;
      left=(Number(window.scrollX)||0)*dir;
    }else{
      top=Number(manager.container?.scrollTop)||0;
      left=Number(manager.container?.scrollLeft)||0;
    }
    manager.scrollTop=top;
    manager.scrollLeft=left;
    return{top,left};
  }

  function scrollingActive(manager){
    const recent=Date.now()-(Number(manager?.__sgLastScrollAt)||0)<550;
    const moving=(Number(manager?.scrollDeltaVert)||0)>2||(Number(manager?.scrollDeltaHorz)||0)>2;
    return recent||moving;
  }

  function stableTrim(manager){
    clearTimeout(manager.__sgStableTrimTimer);
    manager.__sgStableTrimTimer=setTimeout(()=>{
      if(!manager?.views||scrollingActive(manager)){
        stableTrim(manager);
        return;
      }
      const views=manager.views.all?.()||[];
      if(views.length<=KEEP_VIEWS_EACH_SIDE*2+3)return;
      const bounds=manager.bounds?.();
      if(!bounds)return;

      const visible=[];
      for(let i=0;i<views.length;i++){
        try{if(manager.isVisible?.(views[i],0,0,bounds))visible.push(i)}catch{}
      }
      if(!visible.length)return;

      const keepStart=Math.max(0,visible[0]-KEEP_VIEWS_EACH_SIDE);
      const keepEnd=Math.min(views.length-1,visible[visible.length-1]+KEEP_VIEWS_EACH_SIDE);
      const above=views.slice(0,keepStart);
      const below=views.slice(keepEnd+1);
      try{above.forEach(view=>manager.erase?.(view,true))}catch(error){console.warn("Continuous upper trim skipped",error)}
      try{below.slice().reverse().forEach(view=>manager.erase?.(view))}catch(error){console.warn("Continuous lower trim skipped",error)}
      syncScrollPosition(manager);
    },1200);
  }

  function stableUpdate(manager,_offset){
    const container=manager.bounds?.();
    const views=manager.views?.all?.()||[];
    const offset=typeof _offset!=="undefined"?_offset:(manager.settings?.offset||0);
    const promises=[];

    for(const view of views){
      let visible=false;
      try{visible=manager.isVisible?.(view,offset,offset,container)===true}catch{}
      if(!visible)continue;

      if(!view.displayed){
        const displayed=view.display(manager.request).then(next=>{
          try{next.stopExpanding=false;next?.show?.()}catch{}
          return next;
        },()=>undefined);
        promises.push(displayed);
      }else{
        const elementHidden=view.element?.style?.visibility==="hidden";
        const iframeHidden=view.iframe?.style?.visibility==="hidden";
        if(elementHidden||iframeHidden){
          try{view.stopExpanding=false;view.show?.()}catch{}
        }
      }
    }

    stableTrim(manager);
    return promises.length?Promise.all(promises).then(()=>undefined):Promise.resolve();
  }

  function defaultManagerDisplay(manager){
    try{
      const continuousProto=Object.getPrototypeOf(manager);
      const defaultProto=continuousProto&&Object.getPrototypeOf(continuousProto);
      return typeof defaultProto?.display==="function"?defaultProto.display:null;
    }catch{return null;}
  }

  function patchManager(rendition,target){
    const manager=rendition?.manager;
    if(!manager||manager.__sgContinuousManagerPatched)return;
    manager.__sgContinuousManagerPatched=true;
    disableManagerAnchoring(rendition,target);

    if(typeof manager.createView==="function"){
      const rawCreateView=manager.createView.bind(manager);
      manager.createView=(...args)=>patchView(rawCreateView(...args),manager,target);
    }
    try{manager.views?.all?.().forEach(view=>patchView(view,manager,target))}catch{}

    /* ContinuousViewManager.display() waits for fill(), so one malformed/heavy neighboring
       image section can hold the rendition queue and leave the app on “Opening the book…”.
       Use DefaultViewManager.display() for the requested section, then preload/fill on the
       manager's own queue after the requested section has resolved. */
    const baseDisplay=defaultManagerDisplay(manager);
    if(baseDisplay){
      manager.display=(section,displayTarget)=>Promise.resolve(baseDisplay.call(manager,section,displayTarget)).then(result=>{
        clearTimeout(manager.__sgBackgroundFillTimer);
        manager.__sgBackgroundFillTimer=setTimeout(()=>{
          if(manager.__sgDestroyed)return;
          try{
            const fill=manager.fill?.();
            if(fill&&typeof fill.catch==="function")fill.catch(error=>console.warn("Continuous background fill skipped",error));
          }catch(error){console.warn("Continuous background fill skipped",error)}
        },0);
        return result;
      });
    }

    if(typeof manager.check==="function"){
      const rawCheck=manager.check.bind(manager);
      manager.check=(...args)=>{
        syncScrollPosition(manager);
        return rawCheck(...args);
      };
    }

    if(typeof manager.update==="function")manager.update=_offset=>stableUpdate(manager,_offset);
    manager.scheduleTrim=()=>stableTrim(manager);

    if(typeof manager.addScrollListeners==="function"){
      const rawAddScrollListeners=manager.addScrollListeners.bind(manager);
      manager.addScrollListeners=(...args)=>{
        const result=rawAddScrollListeners(...args);
        const {top,left}=syncScrollPosition(manager);
        manager.prevScrollTop=top;
        manager.prevScrollLeft=left;
        return result;
      };
    }

    if(typeof manager.onScroll==="function"){
      const rawOnScroll=manager.onScroll.bind(manager);
      manager.onScroll=(...args)=>{
        manager.__sgLastScrollAt=Date.now();
        return rawOnScroll(...args);
      };
    }

    if(typeof manager.scrolled==="function"){
      manager.scrolled=()=>{
        const task=manager.q?.enqueue?.(()=>manager.check?.());
        const requestId=(manager.__sgScrolledRequestId||0)+1;
        manager.__sgScrolledRequestId=requestId;
        const {top,left}=syncScrollPosition(manager);
        try{manager.emit?.("scroll",{top,left})}catch{}

        clearTimeout(manager.afterScrolled);
        manager.afterScrolled=setTimeout(()=>{
          Promise.resolve(task).catch(()=>{}).then(()=>{
            if(requestId!==manager.__sgScrolledRequestId)return;
            if(manager.snapper?.supportsTouch&&manager.snapper.needsSnap?.())return;
            const settled=syncScrollPosition(manager);
            try{manager.emit?.("scrolled",settled)}catch{}
          });
        },Number(manager.settings?.afterScrolledTimeout)||10);
      };
    }

    if(typeof manager.destroy==="function"){
      const rawDestroy=manager.destroy.bind(manager);
      manager.destroy=(...args)=>{
        manager.__sgDestroyed=true;
        clearTimeout(manager.__sgBackgroundFillTimer);
        clearTimeout(manager.__sgStableTrimTimer);
        clearTimeout(manager.afterScrolled);
        clearTimeout(manager.trimTimeout);
        clearTimeout(manager.scrollTimeout);
        return rawDestroy(...args);
      };
    }

    try{
      const minimumOffset=Math.round(viewportHeight(manager,target)*2.25);
      if(manager.settings)manager.settings.offset=Math.max(Number(manager.settings.offset)||0,minimumOffset);
    }catch{}
  }

  function patchFlowHandoff(rendition,options){
    if(!rendition||rendition.__sgFlowHandoffPatched)return rendition;
    rendition.__sgFlowHandoffPatched=true;
    const nextFlow=normalizeFlow(options?.flow||rendition.settings?.flow);
    const previousFlow=activeFlow;
    const previousRendition=activeRendition;
    const switching=Boolean(previousRendition&&previousFlow&&previousFlow!==nextFlow);
    const handoff=pendingFlowAnchor||(switching?lastAnchor:null);

    activeRendition=rendition;
    activeFlow=nextFlow;

    try{
      rendition.on?.("relocated",location=>{
        if(rendition!==activeRendition)return;
        const anchor=anchorFromLocation(location);
        if(anchor)lastAnchor=anchor;
      });
    }catch{}

    if(handoff&&typeof rendition.display==="function"){
      const rawDisplay=rendition.display.bind(rendition);
      let firstDisplay=true;
      rendition.display=target=>{
        if(!firstDisplay)return rawDisplay(target);
        firstDisplay=false;
        const anchorTarget=handoff.cfi||handoff.href||target;
        const finish=result=>{
          pendingFlowAnchor=null;
          return result;
        };
        return Promise.resolve(rawDisplay(anchorTarget)).then(async result=>{
          /* Continuous may prepend/append immediately after the first frame. Re-apply the
             same exact CFI after two paints so the viewport itself, not chapter start,
             survives the flow change. */
          if(nextFlow==="scrolled-doc"&&anchorTarget){
            await nextPaint();
            try{await rawDisplay(anchorTarget)}catch(error){console.warn("Flow anchor settle skipped",error)}
          }
          return finish(result);
        },async error=>{
          if(anchorTarget!==target&&target){
            try{return finish(await rawDisplay(target))}catch{}
          }
          pendingFlowAnchor=null;
          throw error;
        });
      };
    }
    return rendition;
  }

  function patchContinuousRendition(rendition,target,options){
    if(!rendition||rendition.__sgContinuousAnchorPatched)return rendition;
    const continuous=normalizeFlow(options?.flow||rendition.settings?.flow)==="scrolled-doc"||options?.manager==="continuous";
    if(!continuous)return rendition;
    rendition.__sgContinuousAnchorPatched=true;

    try{
      rendition.hooks?.content?.register?.(contents=>prepareContents(contents,rendition.manager,target));
    }catch{}

    const install=()=>patchManager(rendition,target);
    try{rendition.on?.("started",install)}catch{}
    try{Promise.resolve(rendition.started).then(install).catch(()=>{})}catch{}
    install();

    try{
      rendition.on("rendered",(_,view)=>{
        patchManager(rendition,target);
        patchView(view,rendition.manager,target);
        disableManagerAnchoring(rendition,target);
        if(view?.contents&&prepareContents(view.contents,rendition.manager,target)){
          armMediaRemeasure(view,rendition.manager,target);
          refreshView(view,rendition.manager,target);
        }
        try{rendition.getContents?.().forEach(contents=>prepareContents(contents,rendition.manager,target))}catch{}
      });
    }catch{}

    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgContinuousAnchorBookPatched||typeof book.renderTo!=="function")return book;
    book.__sgContinuousAnchorBookPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>{
      const rendition=rawRenderTo(target,options);
      patchFlowHandoff(rendition,options);
      return patchContinuousRendition(rendition,target,options);
    };
    return book;
  }

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
