/* Shadow Garden v1.2.2 — authoritative Continuous navigation + end-page controller. */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));
  const paint=()=>new Promise(resolve=>requestAnimationFrame(resolve));
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
  function linearSpine(rendition){
    const raw=rendition?.book?.spine?.spineItems||[];
    const linear=raw.filter(item=>item?.href&&item.linear!=="no");
    return linear.length?linear:raw.filter(item=>item?.href);
  }
  function lastSpineItem(rendition){const items=linearSpine(rendition);return items[items.length-1]||null}

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

  /* One seek == one navigation. reader.js still owns the committed `change` event; the noisy
     drag-time input plus its pointer/touch duplicate commits are stopped before they reach it. */
  document.addEventListener("input",event=>{
    if(event.target?.id!=="progressRange")return;
    event.stopImmediatePropagation();
    renderSeekPreview(event.target);
  },true);
  document.addEventListener("change",event=>{
    if(event.target?.id!=="progressRange")return;
    window.__sgSeekCommitSerial=(Number(window.__sgSeekCommitSerial)||0)+1;
    window.__sgSeekCommitExpires=performance.now()+1200;
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
  function finalViewLoaded(rendition){
    const manager=rendition?.manager,views=manager?.views?.all?.()||[];
    const rendered=views.filter(view=>view?.displayed&&view?.section);
    const last=rendered[rendered.length-1],finalSection=lastSpineItem(rendition);
    return Boolean(last?.section&&finalSection&&hrefMatches(last.section.href,finalSection.href));
  }
  function syncContinuousEnd(rendition,force=false){
    if(!rendition||!document.body.classList.contains("reader-flow-scrolled"))return;
    const manager=rendition.manager,container=manager?.container;
    if(!container)return;
    const existing=container.querySelector?.(".volume-end-page-continuous");
    if(!finalViewLoaded(rendition)){
      existing?.remove();
      return;
    }
    if(existing&&!force)return;
    const master=masterEndPage();if(!master)return;
    const clone=master.cloneNode(true);
    stripCloneIds(clone);
    clone.classList.remove("hidden","active");
    clone.classList.add("continuous-end","volume-end-page-continuous");
    if(existing)existing.replaceWith(clone);else container.appendChild(clone);
  }

  function locationAtBookEnd(rendition){
    let location=rendition?.location;
    try{
      const live=rendition?.currentLocation?.();
      if(live&&typeof live.then!=="function")location=live;
    }catch{}
    if(location?.atEnd===true)return true;
    const last=lastSpineItem(rendition);if(!last)return false;
    const end=location?.end||location?.start;
    if(!end||!hrefMatches(end.href,last.href))return false;
    const displayed=end.displayed||location?.start?.displayed;
    const page=Number(displayed?.page),total=Number(displayed?.total);
    if(Number.isFinite(page)&&Number.isFinite(total)&&total>0&&page>=total)return true;
    const endIndex=Number(end.index),lastIndex=Number(last.index);
    const percentage=Number(end.percentage);
    if(Number.isFinite(endIndex)&&Number.isFinite(lastIndex)&&endIndex>=lastIndex&&Number.isFinite(percentage)&&percentage>=.999)return true;
    const text=String(document.getElementById("progressText")?.textContent||"");
    const match=text.match(/^(\d+)\s*\/\s*(\d+)$/);
    return Boolean(match&&Number(match[2])>0&&Number(match[1])>=Number(match[2]));
  }

  function syncRealScroll(manager){
    if(!manager)return{top:0,left:0};
    const dir=manager.settings?.direction==="rtl"&&manager.settings?.rtlScrollType==="default"?-1:1;
    const top=manager.settings?.fullsize?(Number(window.scrollY)||0)*dir:Number(manager.container?.scrollTop)||0;
    const left=manager.settings?.fullsize?(Number(window.scrollX)||0)*dir:Number(manager.container?.scrollLeft)||0;
    manager.scrollTop=top;manager.scrollLeft=left;
    return{top,left};
  }

  async function boundedCheck(rendition,manager,_offsetLeft,_offsetTop){
    if(manager.__sgBoundedCheckPromise)return manager.__sgBoundedCheckPromise;
    const run=async()=>{
      let added=false,stalled=0,lastLength=-1,lastDelta=Number(manager.settings?.offset)||0;
      for(let step=0;step<8;step++){
        if(manager.__sgDestroyed)return added;
        syncRealScroll(manager);
        const horizontal=manager.settings?.axis==="horizontal";
        const bounds=manager._bounds||manager.bounds?.();
        const box=manager.container;
        if(!bounds||!box)break;
        const visibleLength=horizontal?Math.floor(Number(bounds.width)||box.clientWidth):Number(bounds.height)||box.clientHeight;
        const contentLength=horizontal?Number(box.scrollWidth)||0:Number(box.scrollHeight)||0;
        const offset=horizontal?Number(manager.scrollLeft)||0:Number(manager.scrollTop)||0;
        let delta=Number(manager.settings?.offset)||0;
        if(horizontal&&Number(_offsetLeft)>0)delta=Number(_offsetLeft);
        if(!horizontal&&Number(_offsetTop)>0)delta=Number(_offsetTop);
        delta=Math.max(delta,Math.round(visibleLength*1.25));
        lastDelta=delta;

        const needBefore=offset-delta<0;
        const needAfter=offset+visibleLength+delta>=contentLength;
        const newViews=[];
        if(needBefore){
          const first=manager.views?.first?.(),previous=first?.section?.prev?.();
          if(previous)newViews.push(manager.prepend(previous));
        }
        if(needAfter){
          const last=manager.views?.last?.(),next=last?.section?.next?.();
          if(next)newViews.push(manager.append(next));
        }
        if(!newViews.length)break;

        added=true;
        await Promise.allSettled(newViews.map(view=>Promise.resolve(view.display(manager.request)).then(()=>{
          try{view.stopExpanding=false;view.show?.()}catch{}
        })));
        await paint();
        syncRealScroll(manager);

        const nextLength=horizontal?Number(box.scrollWidth)||0:Number(box.scrollHeight)||0;
        if(nextLength<=Math.max(lastLength,contentLength)+1)stalled++;else stalled=0;
        lastLength=nextLength;
        if(stalled>=2){
          console.warn("Continuous loader stopped after two no-growth spine inserts");
          break;
        }
      }
      try{await manager.update?.(lastDelta)}catch(error){console.warn("Continuous visibility refresh skipped",error)}
      syncRealScroll(manager);
      syncContinuousEnd(rendition);
      return added;
    };
    manager.__sgBoundedCheckPromise=run().finally(()=>{manager.__sgBoundedCheckPromise=null});
    return manager.__sgBoundedCheckPromise;
  }

  function installContinuousManager(rendition){
    const manager=rendition?.manager;
    if(!manager||manager.__sgBoundedContinuousInstalled)return;
    manager.__sgBoundedContinuousInstalled=true;

    manager.check=(_offsetLeft,_offsetTop)=>boundedCheck(rendition,manager,_offsetLeft,_offsetTop);
    manager.fill=full=>{
      const task=manager.check();
      if(full&&typeof full.resolve==="function"){
        task.then(value=>full.resolve(value),error=>full.reject?.(error));
        return full.promise||task;
      }
      return task;
    };

    manager.scrolled=()=>{
      const settled=syncRealScroll(manager);
      try{manager.emit?.("scroll",settled)}catch{}
      clearTimeout(manager.afterScrolled);
      manager.afterScrolled=setTimeout(()=>{
        Promise.resolve(manager.check()).catch(error=>console.warn("Continuous scroll check skipped",error)).finally(()=>{
          const position=syncRealScroll(manager);
          try{manager.emit?.("scrolled",position)}catch{}
          syncContinuousEnd(rendition);
        });
      },Math.max(18,Number(manager.settings?.afterScrolledTimeout)||18));
    };

    /* addScrollListeners() may already have bound the previous scrolled() implementation.
       Replace the debounced callback too, so onScroll always reaches the bounded controller. */
    try{manager._scrolled?.cancel?.()}catch{}
    manager._scrolled=()=>{
      clearTimeout(manager.__sgBoundedScrollTimer);
      manager.__sgBoundedScrollTimer=setTimeout(()=>manager.scrolled(),30);
    };

    let lastNudge=0;
    const nudge=direction=>{
      const now=Date.now();if(now-lastNudge<80)return;
      const box=manager.container;if(!box)return;
      const top=Number(box.scrollTop)||0,max=Math.max(0,(Number(box.scrollHeight)||0)-(Number(box.clientHeight)||0));
      const threshold=Math.max(18,(Number(box.clientHeight)||0)*.14);
      if(direction<0&&top>threshold)return;
      if(direction>0&&max-top>threshold)return;
      lastNudge=now;
      Promise.resolve(manager.check()).catch(error=>console.warn("Continuous boundary recovery skipped",error));
    };

    const wireContents=contents=>{
      const doc=contents?.document;
      if(!doc||doc.documentElement?.dataset.sgBoundedBoundary==="1")return;
      doc.documentElement.dataset.sgBoundedBoundary="1";
      doc.addEventListener("wheel",event=>{
        const dy=Number(event.deltaY)||0;if(Math.abs(dy)>1)nudge(Math.sign(dy));
      },{passive:true});
      let touchY=null;
      doc.addEventListener("touchstart",event=>{touchY=Number(event.touches?.[0]?.clientY);if(!Number.isFinite(touchY))touchY=null},{passive:true});
      doc.addEventListener("touchmove",event=>{
        if(touchY==null)return;
        const y=Number(event.touches?.[0]?.clientY);if(Number.isFinite(y)&&Math.abs(y-touchY)>12)nudge(touchY>y?1:-1);
      },{passive:true});
      doc.addEventListener("touchend",event=>{
        const y=Number(event.changedTouches?.[0]?.clientY);
        if(touchY!=null&&Number.isFinite(y)&&Math.abs(y-touchY)>8)nudge(touchY>y?1:-1);
        touchY=null;
      },{passive:true});
    };

    try{rendition.getContents?.().forEach(wireContents)}catch{}
    try{rendition.hooks?.content?.register?.(wireContents)}catch{}
    try{rendition.on?.("rendered",()=>{
      try{rendition.getContents?.().forEach(wireContents)}catch{}
      syncContinuousEnd(rendition);
    })}catch{}
    try{manager.container?.addEventListener?.("wheel",event=>{const dy=Number(event.deltaY)||0;if(Math.abs(dy)>1)nudge(Math.sign(dy))},{passive:true})}catch{}

    const oldDestroy=typeof manager.destroy==="function"?manager.destroy.bind(manager):null;
    if(oldDestroy)manager.destroy=(...args)=>{
      clearTimeout(manager.__sgBoundedScrollTimer);
      clearTimeout(manager.afterScrolled);
      return oldDestroy(...args);
    };

    /* Prime adjacent views without entering EPUB.js's recursive fill loop. */
    setTimeout(()=>{Promise.resolve(manager.check()).catch(()=>{})},0);
  }

  function patchRendition(rendition,options){
    if(!rendition||rendition.__sgRuntimeStabilityPatched)return rendition;
    rendition.__sgRuntimeStabilityPatched=true;
    const continuous=options?.manager==="continuous"||String(options?.flow||rendition.settings?.flow||"").startsWith("scrolled");
    let lastSeekSerial=0,lastSeekTarget="";

    if(typeof rendition.display==="function"){
      const rawDisplay=rendition.display.bind(rendition);
      rendition.display=(...args)=>{
        hidePagedEnd();
        const serial=Number(window.__sgSeekCommitSerial)||0;
        const seekActive=continuous&&serial>0&&performance.now()<(Number(window.__sgSeekCommitExpires)||0);
        const key=targetKey(args[0]);
        if(seekActive&&serial===lastSeekSerial&&key&&key===lastSeekTarget){
          syncContinuousEnd(rendition);
          return Promise.resolve(rendition);
        }
        if(seekActive){lastSeekSerial=serial;lastSeekTarget=key}
        return Promise.resolve(rawDisplay(...args)).finally(()=>{
          if(continuous)syncContinuousEnd(rendition);
        });
      };
    }

    if(typeof rendition.next==="function"){
      const rawNext=rendition.next.bind(rendition);
      rendition.next=(...args)=>{
        if(!continuous&&locationAtBookEnd(rendition)){
          showPagedEnd();
          return Promise.resolve();
        }
        hidePagedEnd();
        return rawNext(...args);
      };
    }
    if(typeof rendition.prev==="function"){
      const rawPrev=rendition.prev.bind(rendition);
      rendition.prev=(...args)=>{
        if(!continuous&&pagedEndVisible()){
          hidePagedEnd();
          return Promise.resolve();
        }
        return rawPrev(...args);
      };
    }

    try{rendition.on?.("relocated",()=>{
      if(!continuous)hidePagedEnd();
      else syncContinuousEnd(rendition);
    })}catch{}

    if(continuous){
      const install=()=>installContinuousManager(rendition);
      install();
      try{Promise.resolve(rendition.started).then(install).catch(()=>{})}catch{}
      try{rendition.on?.("started",install)}catch{}
      setTimeout(install,0);
    }
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgRuntimeStabilityBookPatched||typeof book.renderTo!=="function")return book;
    book.__sgRuntimeStabilityBookPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options),options);
    return book;
  }

  function syncMasterClone(){
    const master=masterEndPage();if(!master)return;
    document.querySelectorAll("#viewer .volume-end-page-continuous").forEach(existing=>{
      const replacement=master.cloneNode(true);stripCloneIds(replacement);
      replacement.classList.remove("hidden","active");replacement.classList.add("continuous-end","volume-end-page-continuous");
      existing.replaceWith(replacement);
    });
  }
  function initEndPageObserver(){
    const master=masterEndPage();
    if(master)new MutationObserver(syncMasterClone).observe(master,{subtree:true,childList:true,characterData:true,attributes:true});
    new MutationObserver(()=>{
      if(document.body.classList.contains("reader-flow-paginated"))document.querySelectorAll("#viewer .volume-end-page-continuous").forEach(node=>node.remove());
      else hidePagedEnd();
    }).observe(document.body,{attributes:true,attributeFilter:["class"]});
  }

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initEndPageObserver,{once:true});
  else initEndPageObserver();
})();
