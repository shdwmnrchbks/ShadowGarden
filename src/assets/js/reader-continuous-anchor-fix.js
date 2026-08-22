/* Shadow Garden v1.1.2 — EPUB.js Continuous-mode stability layer.
 *
 * Two EPUB.js edge cases meet in scrolled-doc + continuous mode:
 * 1) previous spine views are dynamically prepended while scrolling upward, where
 *    browser scroll anchoring can pull the viewport back down;
 * 2) image/SVG-only sections can initially measure at or near zero height, so the
 *    continuous manager may hide/skip the view before media establishes layout.
 *
 * Keep these workarounds outside reader.js so Paginated navigation/state stays frozen.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const VISUAL_SELECTOR="img,svg,picture,video,object,canvas";
  const MEDIA_SELECTOR="img,svg image,video,object";

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
      Number(window.innerHeight)*0.72
    ].filter(value=>Number.isFinite(value)&&value>80);
    return Math.max(240,Math.round(values[0]||values[values.length-1]||640));
  }

  function disableContentAnchoring(contents){
    const doc=contents?.document;
    if(!doc)return;
    noAnchor(doc.documentElement);
    noAnchor(doc.body);
    try{doc.querySelectorAll(".epub-container,.epub-view").forEach(noAnchor)}catch{}
  }

  function disableManagerAnchoring(rendition,target){
    const manager=rendition?.manager;
    noAnchor(manager?.container);
    noAnchor(manager?.stage?.container);
    noAnchor(manager?.stage?.element);

    const viewer=viewerElement(target);
    noAnchor(viewer);
    try{viewer?.querySelectorAll?.(".epub-container,.epub-view").forEach(noAnchor)}catch{}
  }

  function isVisualDominant(doc){
    const body=doc?.body;
    if(!body||!body.querySelector(VISUAL_SELECTOR))return false;
    const text=String(body.innerText||body.textContent||"").replace(/\s+/g," ").trim();
    return text.length<=320;
  }

  function visualHeight(contents,manager,target,rawHeight){
    const doc=contents?.document;
    if(!doc)return Number(rawHeight)||0;
    const viewport=viewportHeight(manager,target);

    /* A full-page SVG frequently lives inside a 100vh wrapper. If iframe height is
       calculated from that same 100vh content, every remeasure can make the iframe
       taller again. Give SVG-dominant pages one stable reader-viewport instead. */
    if(doc.body?.querySelector("svg")&&!doc.body?.querySelector("img"))return viewport;

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
        if(rect)measured=Math.max(measured,Math.ceil(rect.bottom-bodyTop));
      });
    }catch{}

    measured=Math.max(measured,viewport);
    return Math.max(1,Math.ceil(measured));
  }

  function refreshView(view,manager){
    if(!view?.displayed)return;
    requestAnimationFrame(()=>{
      try{view.expand?.(true)}catch{}
      try{
        const result=manager?.update?.();
        if(result&&typeof result.catch==="function")result.catch(()=>{});
      }catch{}
    });
  }

  function armMediaRemeasure(view,manager){
    const contents=view?.contents,doc=contents?.document;
    if(!doc||doc.__sgMediaRemeasureArmed||!isVisualDominant(doc))return;
    doc.__sgMediaRemeasureArmed=true;

    const remeasure=()=>refreshView(view,manager);
    try{
      doc.querySelectorAll(MEDIA_SELECTOR).forEach(node=>{
        if(node.tagName==="IMG"&&node.complete)return;
        node.addEventListener?.("load",remeasure,{once:true,passive:true});
        node.addEventListener?.("error",remeasure,{once:true,passive:true});
        if(node.tagName==="VIDEO")node.addEventListener?.("loadedmetadata",remeasure,{once:true,passive:true});
      });
    }catch{}
    try{doc.fonts?.ready?.then(remeasure)?.catch?.(()=>{})}catch{}
    setTimeout(remeasure,60);
    setTimeout(remeasure,420);
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

    if(typeof view.expand==="function"){
      const rawExpand=view.expand.bind(view);
      view.expand=force=>{
        const contents=view.contents,doc=contents?.document;
        if(contents){
          disableContentAnchoring(contents);
          if(isVisualDominant(doc)){
            armMediaRemeasure(view,manager);
            if(!contents.__sgVisualHeightPatched&&typeof contents.textHeight==="function"){
              const rawTextHeight=contents.textHeight.bind(contents);
              contents.textHeight=()=>visualHeight(contents,manager,target,rawTextHeight());
              contents.__sgVisualHeightPatched=true;
            }
          }
        }
        return rawExpand(force);
      };
    }

    if(typeof view.show==="function"){
      const rawShow=view.show.bind(view);
      view.show=(...args)=>{
        noAnchor(view.element);
        noAnchor(view.iframe);
        return rawShow(...args);
      };
    }
    return view;
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

    /* Preload at least about one viewport around the current position. The stock
       500px window is often too small on modern phones and makes reverse chapter
       loading occur only after the reader is already pinned at the boundary. */
    try{
      const minimumOffset=Math.round(viewportHeight(manager,target)*1.15);
      if(manager.settings)manager.settings.offset=Math.max(Number(manager.settings.offset)||0,minimumOffset);
    }catch{}
  }

  function patchContinuousRendition(rendition,target,options){
    if(!rendition||rendition.__sgContinuousAnchorPatched)return rendition;
    const continuous=options?.manager==="continuous"||options?.flow==="scrolled-doc";
    if(!continuous)return rendition;
    rendition.__sgContinuousAnchorPatched=true;

    /* Content hooks run after a view has rendered, so they are a fallback. The manager
       createView patch below marks .epub-view itself before prepend/layout occurs. */
    try{rendition.hooks?.content?.register?.(contents=>disableContentAnchoring(contents))}catch{}

    const install=()=>patchManager(rendition,target);
    try{rendition.on?.("started",install)}catch{}
    try{Promise.resolve(rendition.started).then(install).catch(()=>{})}catch{}
    install();

    try{
      rendition.on("rendered",(_,view)=>{
        patchManager(rendition,target);
        patchView(view,rendition.manager,target);
        disableManagerAnchoring(rendition,target);
        if(view?.contents){
          disableContentAnchoring(view.contents);
          if(isVisualDominant(view.contents.document)){
            armMediaRemeasure(view,rendition.manager);
            refreshView(view,rendition.manager);
          }
        }
        try{rendition.getContents?.().forEach(disableContentAnchoring)}catch{}
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
