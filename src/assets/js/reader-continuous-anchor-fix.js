/* Shadow Garden v1.1.4 — EPUB.js Continuous-mode stable-view and visual-page fix.
 *
 * Keeps the v1.1.3 reverse-scroll position synchronization, but avoids toggling
 * retained iframe visibility while the user is moving quickly. Visual-only XHTML
 * is normalized immediately after iframe load and before EPUB.js performs its first
 * layout/expand measurement.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const VISUAL_SELECTOR="img,svg,picture,video,object,canvas";
  const MEDIA_SELECTOR="img,svg image,video,object";
  const KEEP_VIEWS_EACH_SIDE=4;

  const noAnchor=element=>{
    if(!element?.style)return;
    try{element.style.setProperty("overflow-anchor","none","important")}catch{}
  };

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

  function isVisualDominant(doc){
    const body=doc?.body;
    if(!body||!body.querySelector(VISUAL_SELECTOR))return false;
    const text=String(body.innerText||body.textContent||"").replace(/\s+/g," ").trim();
    return text.length<=320;
  }

  function normalizeVisualDocument(contents,manager,target){
    const doc=contents?.document,body=doc?.body;
    if(!doc?.head||!body||!isVisualDominant(doc))return false;

    const height=viewportHeight(manager,target);
    body.setAttribute("data-sg-visual-page","1");

    /* Full-page cover XHTML often uses a 100vh wrapper around a percentage-height SVG.
       Inside an auto-height EPUB iframe that becomes circular sizing: iframe height sets
       100vh, 100vh grows the content, and content grows the iframe again. Mark only those
       wrappers in the rendered copy so they can size intrinsically without editing EPUB. */
    try{
      body.querySelectorAll("[style]").forEach(node=>{
        const value=String(node.style?.height||"");
        if(/vh/i.test(value))node.setAttribute("data-sg-vh-wrapper","1");
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
    `;
    return true;
  }

  function visualHeight(contents,manager,target,rawHeight){
    const doc=contents?.document;
    if(!doc)return Number(rawHeight)||0;
    const viewport=viewportHeight(manager,target);
    normalizeVisualDocument(contents,manager,target);

    let measured=Number(rawHeight)||0;
    const body=doc.body,root=doc.documentElement;
    measured=Math.max(
      measured,
      Number(root?.scrollHeight)||0,
      Number(body?.scrollHeight)||0,
      Number(root?.getBoundingClientRect?.().height)||0,
      Number(body?.getBoundingClientRect?.().height)||0
    );
    try{
      const bodyTop=body?.getBoundingClientRect?.().top||0;
      doc.querySelectorAll(VISUAL_SELECTOR).forEach(node=>{
        const rect=node.getBoundingClientRect?.();
        if(rect&&Number.isFinite(rect.bottom))measured=Math.max(measured,Math.ceil(rect.bottom-bodyTop));
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
    setTimeout(remeasure,120);
    setTimeout(remeasure,450);
    setTimeout(remeasure,1000);
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

    /* IframeView.render() calls load(), then layout.format(), then expand(). Repair the
       rendered document at load completion so visual-only pages are valid before the
       very first textHeight() call. This is earlier than rendition hooks.content. */
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
        /* Do not hide retained offscreen iframes. EPUB.js hide() sets stopExpanding=true;
           fast chapter traversal then re-shows a stale frame and causes the boundary
           flicker / blank media behavior reported in v1.1.3. Idle trim bounds memory. */
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

  function patchContinuousRendition(rendition,target,options){
    if(!rendition||rendition.__sgContinuousAnchorPatched)return rendition;
    const continuous=options?.manager==="continuous"||options?.flow==="scrolled-doc";
    if(!continuous)return rendition;
    rendition.__sgContinuousAnchorPatched=true;

    try{
      rendition.hooks?.content?.register?.(contents=>{
        prepareContents(contents,rendition.manager,target);
      });
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
    book.renderTo=(target,options={})=>patchContinuousRendition(rawRenderTo(target,options),target,options);
    return book;
  }

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
