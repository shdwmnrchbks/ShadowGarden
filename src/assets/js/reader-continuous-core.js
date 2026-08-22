/* Shadow Garden v1.4.0 — authoritative Continuous reader controller.
 *
 * Replaces the accumulated v1.1-v1.3 Continuous manager shims with one owner for:
 * - bounded previous/next spine buffering around the visible section;
 * - scroll bookkeeping and SCROLLED/location reporting;
 * - idle trimming without hiding retained iframes;
 * - seek/display deduplication;
 * - boundary recovery; and
 * - the end-of-volume page.
 *
 * The v1.3 Visual Page Cache still runs before this layer, so standalone visual XHTML is
 * already normalized before EPUB.js measures it.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const BUFFER_EACH_SIDE=4;
  const MAX_RETAINED_VIEWS=12;
  const CHECK_TIMEOUT_MS=5000;
  const DISPLAY_DEDUPE_MS=900;
  const SCROLL_SETTLE_MS=70;
  const TRIM_IDLE_MS=1400;

  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));
  const targetKey=target=>typeof target==="string"?target:target?.toString?.()||"";

  function cleanHref(value){
    let href=String(value||"").split("#")[0].split("?")[0];
    try{href=decodeURIComponent(href)}catch{}
    return href.replace(/^\.\//,"").replace(/^\//,"");
  }
  function hrefMatches(a,b){
    const left=cleanHref(a),right=cleanHref(b);
    return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
  }
  function isContinuous(options,rendition){
    return options?.manager==="continuous"||String(options?.flow||rendition?.settings?.flow||"").startsWith("scrolled");
  }
  function loadedViews(manager){
    try{return manager?.views?.all?.()||[]}catch{return[]}
  }
  function linearSpine(rendition){
    const raw=rendition?.book?.spine?.spineItems||[];
    const linear=raw.filter(item=>item?.href&&item.linear!=="no");
    return linear.length?linear:raw.filter(item=>item?.href);
  }
  function lastSpineItem(rendition){
    const items=linearSpine(rendition);
    return items[items.length-1]||null;
  }

  function renderSeekPreview(range){
    const value=clamp01(Number(range?.value||0)/1000);
    const total=Number(window.__sgCanonicalPageMap?.totalPages)||0;
    const text=document.getElementById("progressText");
    if(!text)return;
    if(total>0){
      const page=value>=1?total:Math.min(total,Math.floor(value*total)+1);
      text.textContent=`${page}/${total}`;
      text.title=`Page ${page} of ${total} · ${Math.round(value*100)}% · release to navigate`;
    }else{
      text.textContent=`${Math.round(value*100)}%`;
      text.title="Release the seek bar to navigate";
    }
  }

  /* The core reader still has older drag-time listeners. Make drag input preview-only and
     allow exactly the normal change event to commit navigation. */
  document.addEventListener("input",event=>{
    if(event.target?.id!=="progressRange")return;
    event.stopImmediatePropagation();
    renderSeekPreview(event.target);
  },true);
  document.addEventListener("pointerup",event=>{
    if(event.target?.id==="progressRange")event.stopImmediatePropagation();
  },true);
  document.addEventListener("touchend",event=>{
    if(event.target?.id==="progressRange")event.stopImmediatePropagation();
  },true);

  function masterEndPage(){return document.getElementById("volumeEndPage")}
  function pagedEndVisible(){return masterEndPage()?.classList.contains("active")===true}
  function hidePagedEnd(){
    const page=masterEndPage();if(!page)return;
    page.classList.add("hidden");page.classList.remove("active");
  }
  function showPagedEnd(){
    const page=masterEndPage();
    if(!page||!document.body.classList.contains("reader-flow-paginated"))return;
    page.classList.remove("hidden");page.classList.add("active");
    requestAnimationFrame(()=>page.querySelector("a:not(.hidden)")?.focus?.({preventScroll:true}));
  }
  function stripCloneIds(root){
    root.removeAttribute("id");root.removeAttribute("aria-labelledby");root.removeAttribute("aria-describedby");
    root.querySelectorAll?.("[id]").forEach(node=>node.removeAttribute("id"));
  }
  function syncContinuousEnd(rendition){
    const manager=rendition?.manager,container=manager?.container;
    if(!manager||!container||!document.body.classList.contains("reader-flow-scrolled"))return;
    const finalSection=lastSpineItem(rendition);
    const views=loadedViews(manager);
    const finalLoaded=Boolean(finalSection&&views.some(view=>view?.displayed&&hrefMatches(view?.section?.href,finalSection.href)));
    const existing=container.querySelector?.(".volume-end-page-continuous");
    if(!finalLoaded){existing?.remove();return}
    if(existing)return;
    const master=masterEndPage();if(!master)return;
    const clone=master.cloneNode(true);
    stripCloneIds(clone);
    clone.classList.remove("hidden","active");
    clone.classList.add("continuous-end","volume-end-page-continuous");
    container.appendChild(clone);
  }
  function locationAtBookEnd(rendition){
    const location=rendition?.location;
    if(location?.atEnd===true)return true;
    const last=lastSpineItem(rendition),end=location?.end||location?.start;
    if(!last||!end||!hrefMatches(end.href,last.href))return false;
    const displayed=end.displayed||location?.start?.displayed;
    const page=Number(displayed?.page),total=Number(displayed?.total);
    return Number.isFinite(page)&&Number.isFinite(total)&&total>0&&page>=total;
  }

  function scrollerFor(manager){return manager?.settings?.fullsize?window:manager?.container}
  function getScrollPosition(manager){
    if(!manager)return{top:0,left:0};
    const dir=manager.settings?.direction==="rtl"&&manager.settings?.rtlScrollType==="default"?-1:1;
    if(manager.settings?.fullsize)return{top:(Number(window.scrollY)||0)*dir,left:(Number(window.scrollX)||0)*dir};
    return{top:Number(manager.container?.scrollTop)||0,left:Number(manager.container?.scrollLeft)||0};
  }
  function syncScrollPosition(manager){
    const position=getScrollPosition(manager);
    manager.scrollTop=position.top;
    manager.scrollLeft=position.left;
    return position;
  }

  function visibleRange(manager){
    const views=loadedViews(manager);
    if(!views.length)return{views,first:-1,last:-1};
    const viewport=manager.container?.getBoundingClientRect?.();
    const indices=[];
    if(viewport){
      views.forEach((view,index)=>{
        const rect=view?.element?.getBoundingClientRect?.();
        if(!rect)return;
        const vertical=rect.bottom>viewport.top+1&&rect.top<viewport.bottom-1;
        const horizontal=rect.right>viewport.left+1&&rect.left<viewport.right-1;
        if(vertical&&horizontal)indices.push(index);
      });
    }
    if(indices.length)return{views,first:indices[0],last:indices[indices.length-1]};

    const axis=manager.settings?.axis==="horizontal"?"horizontal":"vertical";
    const center=axis==="horizontal"?(viewport?.left||0)+(viewport?.width||0)/2:(viewport?.top||0)+(viewport?.height||0)/2;
    let nearest=0,distance=Infinity;
    views.forEach((view,index)=>{
      const rect=view?.element?.getBoundingClientRect?.();if(!rect)return;
      const itemCenter=axis==="horizontal"?(rect.left+rect.right)/2:(rect.top+rect.bottom)/2;
      const next=Math.abs(itemCenter-center);
      if(next<distance){distance=next;nearest=index}
    });
    return{views,first:nearest,last:nearest};
  }

  async function displayView(view,manager){
    if(!view)return false;
    try{
      const work=Promise.resolve(view.display(manager.request)).then(result=>{
        const shown=result||view;
        shown.stopExpanding=false;
        shown.show?.();
        return true;
      });
      const result=await Promise.race([work,delay(CHECK_TIMEOUT_MS).then(()=>false)]);
      if(result!==true)console.warn("Continuous neighbor display timed out",view?.section?.href||"");
      return result===true;
    }catch(error){
      console.warn("Continuous neighbor display skipped",view?.section?.href||"",error);
      return false;
    }
  }

  async function prependOne(manager){
    const first=manager.views?.first?.(),section=first?.section?.prev?.();
    if(!section)return false;
    let view=null;
    try{view=manager.prepend(section)}catch(error){console.warn("Continuous prepend skipped",error);return false}
    return displayView(view,manager);
  }
  async function appendOne(manager){
    const last=manager.views?.last?.(),section=last?.section?.next?.();
    if(!section)return false;
    let view=null;
    try{view=manager.append(section)}catch(error){console.warn("Continuous append skipped",error);return false}
    return displayView(view,manager);
  }

  function preserveAnchorBeforePrepend(range){
    const view=range.views[range.first];
    const top=view?.element?.getBoundingClientRect?.().top;
    return Number.isFinite(top)?{view,top}:null;
  }
  async function restorePrependAnchor(manager,anchor){
    if(!anchor?.view?.element||!manager.container)return;
    await paint();
    const top=anchor.view.element.getBoundingClientRect?.().top;
    if(!Number.isFinite(top))return;
    const delta=top-anchor.top;
    if(Math.abs(delta)>1){
      manager.__sgSuppressScrollUntil=performance.now()+100;
      manager.container.scrollTop=(Number(manager.container.scrollTop)||0)+delta;
    }
    manager.ignore=false;
    syncScrollPosition(manager);
  }

  function scheduleTrim(manager,rendition){
    clearTimeout(manager.__sgCoreTrimTimer);
    manager.__sgCoreTrimTimer=setTimeout(()=>{
      if(manager.__sgDestroyed)return;
      if(Date.now()-(Number(manager.__sgLastUserScrollAt)||0)<650){scheduleTrim(manager,rendition);return}
      const range=visibleRange(manager),views=range.views;
      if(range.first<0||views.length<=MAX_RETAINED_VIEWS)return;
      const keepStart=Math.max(0,range.first-BUFFER_EACH_SIDE);
      const keepEnd=Math.min(views.length-1,range.last+BUFFER_EACH_SIDE);
      const above=views.slice(0,keepStart);
      const below=views.slice(keepEnd+1);
      try{above.forEach(view=>manager.erase?.(view,true))}catch(error){console.warn("Continuous upper trim skipped",error)}
      try{below.slice().reverse().forEach(view=>manager.erase?.(view))}catch(error){console.warn("Continuous lower trim skipped",error)}
      manager.ignore=false;
      syncScrollPosition(manager);
      syncContinuousEnd(rendition);
    },TRIM_IDLE_MS);
  }

  async function ensureNeighborhood(manager,rendition){
    if(manager.__sgCoreCheckPromise)return manager.__sgCoreCheckPromise;
    const run=async()=>{
      if(manager.__sgDestroyed||!manager.container||!manager.views)return false;
      syncScrollPosition(manager);
      let range=visibleRange(manager);
      if(range.first<0)return false;
      const anchor=preserveAnchorBeforePrepend(range);
      let changed=false;

      const before=Math.max(0,range.first);
      for(let count=before;count<BUFFER_EACH_SIDE;count+=1){
        if(!await prependOne(manager))break;
        changed=true;
      }
      if(changed)await restorePrependAnchor(manager,anchor);

      range=visibleRange(manager);
      const after=Math.max(0,range.views.length-1-range.last);
      for(let count=after;count<BUFFER_EACH_SIDE;count+=1){
        if(!await appendOne(manager))break;
        changed=true;
      }

      await paint();
      manager.ignore=false;
      syncScrollPosition(manager);
      scheduleTrim(manager,rendition);
      syncContinuousEnd(rendition);
      return changed;
    };
    manager.__sgCoreCheckPromise=run().finally(()=>{manager.__sgCoreCheckPromise=null});
    return manager.__sgCoreCheckPromise;
  }

  function wireBoundaryContents(contents,manager){
    const doc=contents?.document;
    if(!doc||doc.documentElement?.dataset.sgContinuousCoreBoundary==="1")return;
    doc.documentElement.dataset.sgContinuousCoreBoundary="1";
    doc.documentElement.style.setProperty("overflow-anchor","none","important");
    doc.body?.style?.setProperty("overflow-anchor","none","important");
    const request=()=>{Promise.resolve(manager.check?.()).catch(error=>console.warn("Continuous boundary check skipped",error))};
    doc.addEventListener("wheel",event=>{
      if(Math.abs(Number(event.deltaY)||0)>1)request();
    },{passive:true});
    let startY=null;
    doc.addEventListener("touchstart",event=>{startY=Number(event.touches?.[0]?.clientY);if(!Number.isFinite(startY))startY=null},{passive:true});
    doc.addEventListener("touchmove",event=>{
      if(startY==null)return;
      const y=Number(event.touches?.[0]?.clientY);
      if(Number.isFinite(y)&&Math.abs(y-startY)>18)request();
    },{passive:true});
    doc.addEventListener("touchend",()=>{startY=null},{passive:true});
  }

  function installManager(rendition){
    const manager=rendition?.manager;
    if(!manager||manager.__sgContinuousCoreInstalled)return Boolean(manager?.__sgContinuousCoreInstalled);
    if(!manager.container||!manager.views){
      clearTimeout(rendition.__sgContinuousCoreInstallTimer);
      rendition.__sgContinuousCoreInstallTimer=setTimeout(()=>installManager(rendition),30);
      return false;
    }

    manager.__sgContinuousCoreInstalled=true;
    manager.__sgDestroyed=false;
    const scroller=scrollerFor(manager);
    try{manager._scrolled?.cancel?.()}catch{}
    try{if(manager._onScroll&&scroller)scroller.removeEventListener("scroll",manager._onScroll)}catch{}

    manager.getScrollPosition=()=>getScrollPosition(manager);
    manager.syncScrollPosition=()=>syncScrollPosition(manager);
    manager.update=()=>Promise.resolve();
    manager.check=()=>ensureNeighborhood(manager,rendition);
    manager.fill=()=>manager.check();
    manager.scheduleTrim=()=>scheduleTrim(manager,rendition);

    manager._scrolled=()=>{
      clearTimeout(manager.__sgCoreScrollTimer);
      manager.__sgCoreScrollTimer=setTimeout(()=>manager.scrolled(),SCROLL_SETTLE_MS);
    };
    manager.onScroll=()=>{
      const position=syncScrollPosition(manager);
      if(performance.now()<(Number(manager.__sgSuppressScrollUntil)||0))return;
      manager.ignore=false;
      manager.__sgLastUserScrollAt=Date.now();
      try{manager.emit?.("scroll",position)}catch{}
      manager._scrolled();
    };
    manager.scrolled=()=>{
      const requestId=(manager.__sgCoreScrollRequestId||0)+1;
      manager.__sgCoreScrollRequestId=requestId;
      const immediate=syncScrollPosition(manager);

      /* Location reporting must never sit behind image/chapter buffering. Emit SCROLLED now so
         Rendition.reportLocation() updates the canonical page counter from the live viewport. */
      try{manager.emit?.("scrolled",immediate)}catch{}

      Promise.resolve(manager.check()).catch(error=>console.warn("Continuous scroll neighborhood skipped",error)).finally(()=>{
        if(requestId!==manager.__sgCoreScrollRequestId)return;
        const settled=syncScrollPosition(manager);
        try{manager.emit?.("scrolled",settled)}catch{}
      });
    };
    manager._onScroll=manager.onScroll;
    try{scroller?.addEventListener?.("scroll",manager._onScroll,{passive:true})}catch{}

    try{rendition.getContents?.().forEach(contents=>wireBoundaryContents(contents,manager))}catch{}
    try{rendition.hooks?.content?.register?.(contents=>wireBoundaryContents(contents,manager))}catch{}
    try{rendition.on?.("rendered",()=>{
      try{rendition.getContents?.().forEach(contents=>wireBoundaryContents(contents,manager))}catch{}
      Promise.resolve(manager.check()).catch(()=>{});
    })}catch{}

    const rawDestroy=typeof manager.destroy==="function"?manager.destroy.bind(manager):null;
    if(rawDestroy)manager.destroy=(...args)=>{
      manager.__sgDestroyed=true;
      clearTimeout(manager.__sgCoreScrollTimer);
      clearTimeout(manager.__sgCoreTrimTimer);
      clearTimeout(rendition.__sgContinuousCoreInstallTimer);
      try{if(manager._onScroll&&scroller)scroller.removeEventListener("scroll",manager._onScroll)}catch{}
      return rawDestroy(...args);
    };

    manager.ignore=false;
    syncScrollPosition(manager);
    setTimeout(()=>{Promise.resolve(manager.check()).catch(()=>{})},0);
    return true;
  }

  function patchRendition(rendition,options){
    if(!rendition||rendition.__sgContinuousCorePatched)return rendition;
    rendition.__sgContinuousCorePatched=true;
    const continuous=isContinuous(options,rendition);
    let lastDisplayKey="",lastDisplayDoneAt=0,lastDisplayPromise=null,lastDisplayResult=null;

    if(typeof rendition.display==="function"){
      const rawDisplay=rendition.display.bind(rendition);
      rendition.display=(...args)=>{
        hidePagedEnd();
        const key=targetKey(args[0]);
        const now=performance.now();
        if(continuous&&key&&key===lastDisplayKey){
          if(lastDisplayPromise)return lastDisplayPromise;
          if(now-lastDisplayDoneAt<DISPLAY_DEDUPE_MS)return Promise.resolve(lastDisplayResult||rendition);
        }
        lastDisplayKey=key;
        const task=Promise.resolve(rawDisplay(...args)).then(async result=>{
          lastDisplayResult=result;
          if(continuous){
            installManager(rendition);
            try{await rendition.manager?.check?.()}catch(error){console.warn("Continuous post-display neighborhood skipped",error)}
            if(rendition.manager){
              rendition.manager.ignore=false;
              syncScrollPosition(rendition.manager);
            }
            syncContinuousEnd(rendition);
          }
          return result;
        }).finally(()=>{
          lastDisplayDoneAt=performance.now();
          lastDisplayPromise=null;
        });
        lastDisplayPromise=task;
        return task;
      };
    }

    if(typeof rendition.next==="function"){
      const rawNext=rendition.next.bind(rendition);
      rendition.next=(...args)=>{
        if(!continuous&&locationAtBookEnd(rendition)){
          showPagedEnd();return Promise.resolve();
        }
        hidePagedEnd();return rawNext(...args);
      };
    }
    if(typeof rendition.prev==="function"){
      const rawPrev=rendition.prev.bind(rendition);
      rendition.prev=(...args)=>{
        if(!continuous&&pagedEndVisible()){
          hidePagedEnd();return Promise.resolve();
        }
        return rawPrev(...args);
      };
    }

    if(continuous){
      const install=()=>installManager(rendition);
      install();
      try{rendition.on?.("started",install)}catch{}
      try{Promise.resolve(rendition.started).then(()=>{install();setTimeout(install,0)}).catch(()=>{})}catch{}
      try{rendition.on?.("rendered",()=>syncContinuousEnd(rendition))}catch{}
    }else{
      try{rendition.on?.("relocated",()=>hidePagedEnd())}catch{}
    }
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgContinuousCoreBookPatched||typeof book.renderTo!=="function")return book;
    book.__sgContinuousCoreBookPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options),options);
    return book;
  }

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
