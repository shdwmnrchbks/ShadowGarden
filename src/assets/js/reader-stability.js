/* Shadow Garden v1.2.1 — Continuous navigation stability guard. */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));
  const targetKey=target=>typeof target==="string"?target:target?.toString?.()||"";

  function settleSeekNavigation(){
    if(!window.__sgSeekNavigationPending)return;
    window.__sgSeekNavigationPending=false;
    document.dispatchEvent(new CustomEvent("sg-reader-navigation-settled"));
  }

  function canonicalEnd(){
    if(window.__sgSeekPreviewActive||window.__sgSeekNavigationPending)return false;
    const total=Number(window.__sgCanonicalPageMap?.totalPages)||0;
    const text=String(document.getElementById("progressText")?.textContent||"").trim();
    const match=text.match(/^(\d+)\s*\/\s*(\d+)$/);
    return Boolean(total>0&&match&&Number(match[1])>=Number(match[2])&&Number(match[2])===total);
  }

  function renderSeekPreview(range){
    const value=clamp01(Number(range?.value||0)/1000);
    const total=Number(window.__sgCanonicalPageMap?.totalPages)||0;
    const text=document.getElementById("progressText");
    if(!text)return;
    if(total>0){
      const page=value>=1?total:Math.min(total,Math.floor(value*total)+1);
      text.textContent=`${page}/${total}`;
      text.title=`Page ${page} of ${total} · ${Math.round(value*100)}%`;
    }else{
      text.textContent=`${Math.round(value*100)}%`;
      text.title="Release the seek bar to navigate";
    }
  }

  /* Scrubbing used to call rendition.display() repeatedly while the Continuous manager was
     still filling/prepending image sections. Preview the thumb during input and navigate only
     once, on change. Also suppress the core pointer/touch duplicate commits. */
  document.addEventListener("input",event=>{
    if(event.target?.id!=="progressRange")return;
    window.__sgSeekPreviewActive=true;
    event.stopImmediatePropagation();
    renderSeekPreview(event.target);
  },true);
  document.addEventListener("change",event=>{
    if(event.target?.id!=="progressRange")return;
    window.__sgSeekPreviewActive=false;
    window.__sgSeekNavigationPending=true;
  },true);
  document.addEventListener("pointerup",event=>{
    if(event.target?.id==="progressRange")event.stopImmediatePropagation();
  },true);
  document.addEventListener("pointercancel",()=>{window.__sgSeekPreviewActive=false},true);
  document.addEventListener("touchcancel",()=>{window.__sgSeekPreviewActive=false},true);
  document.addEventListener("touchend",event=>{
    if(event.target?.id==="progressRange")event.stopImmediatePropagation();
  },true);

  function emitEndRequest(){
    document.dispatchEvent(new CustomEvent("sg-reader-volume-end-request"));
  }

  function patchRendition(rendition,options){
    if(!rendition||rendition.__sgStabilityPatched)return rendition;
    rendition.__sgStabilityPatched=true;
    const continuous=options?.manager==="continuous"||String(options?.flow||rendition.settings?.flow||"").startsWith("scrolled");

    try{rendition.on?.("relocated",settleSeekNavigation)}catch{}

    if(typeof rendition.display==="function"){
      const rawDisplay=rendition.display.bind(rendition);
      let active=null,activeKey="",queued=null,queuedWaiters=[];

      const run=(target,seekRequest=false)=>{
        const key=targetKey(target);
        activeKey=key;
        active=Promise.resolve().then(()=>rawDisplay(target)).then(result=>{
          if(seekRequest)settleSeekNavigation();
          return result;
        }).catch(error=>{
          if(seekRequest)settleSeekNavigation();
          throw error;
        }).finally(()=>{
          active=null;activeKey="";
          if(!queued)return;
          const next=queued;queued=null;
          const waiters=queuedWaiters;queuedWaiters=[];
          run(next.target,next.seekRequest).then(value=>waiters.forEach(waiter=>waiter.resolve(value)),error=>waiters.forEach(waiter=>waiter.reject(error)));
        });
        return active;
      };

      rendition.display=target=>{
        const key=targetKey(target);
        const seekRequest=Boolean(window.__sgSeekNavigationPending);
        if(active){
          if(key&&key===activeKey){
            return seekRequest?active.then(value=>{settleSeekNavigation();return value},error=>{settleSeekNavigation();throw error}):active;
          }
          queued={target,key,seekRequest:Boolean(queued?.seekRequest||seekRequest)};
          return new Promise((resolve,reject)=>queuedWaiters.push({resolve,reject}));
        }
        return run(target,seekRequest);
      };
    }

    if(typeof rendition.next==="function"){
      const rawNext=rendition.next.bind(rendition);
      rendition.next=(...args)=>{
        if(!continuous&&canonicalEnd()){
          emitEndRequest();
          return Promise.resolve();
        }
        return rawNext(...args);
      };
    }

    function installManager(){
      const manager=rendition.manager;
      if(!continuous||!manager||manager.__sgStabilityManagerPatched)return;
      manager.__sgStabilityManagerPatched=true;

      /* Only dedupe top-level fill() calls. Recursive fill(full) calls must pass through or
         EPUB.js's own deferred fill promise can never resolve. */
      if(typeof manager.fill==="function"){
        const rawFill=manager.fill.bind(manager);
        let topFill=null;
        manager.fill=(full,...rest)=>{
          if(full)return rawFill(full,...rest);
          if(topFill)return topFill;
          topFill=Promise.resolve(rawFill()).finally(()=>{topFill=null});
          return topFill;
        };
      }

      let nudgePromise=null,lastNudge=0;
      const nudge=direction=>{
        const now=Date.now();
        if(now-lastNudge<90||nudgePromise)return;
        const box=manager.container;
        if(!box||typeof manager.check!=="function")return;
        const top=Number(box.scrollTop)||0,max=Math.max(0,(Number(box.scrollHeight)||0)-(Number(box.clientHeight)||0));
        const nearTop=top<Math.max(12,(Number(box.clientHeight)||0)*0.12);
        const nearBottom=max-top<Math.max(12,(Number(box.clientHeight)||0)*0.12);
        if(direction<0&&!nearTop)return;
        if(direction>0&&!nearBottom)return;
        lastNudge=now;
        let task;
        try{task=manager.q?.enqueue?manager.q.enqueue(()=>manager.check()):manager.check()}
        catch(error){console.warn("Continuous boundary recovery skipped",error);return}
        nudgePromise=Promise.resolve(task).catch(error=>console.warn("Continuous boundary recovery skipped",error)).finally(()=>{nudgePromise=null});
      };

      const wireContents=contents=>{
        const doc=contents?.document;
        if(!doc||doc.documentElement?.dataset.sgBoundaryNudge==="1")return;
        doc.documentElement.dataset.sgBoundaryNudge="1";
        doc.addEventListener("wheel",event=>{
          const dy=Number(event.deltaY)||0;
          if(Math.abs(dy)>1)nudge(Math.sign(dy));
        },{passive:true});
        let touchY=null;
        doc.addEventListener("touchstart",event=>{touchY=Number(event.touches?.[0]?.clientY)||null},{passive:true});
        doc.addEventListener("touchend",event=>{
          const y=Number(event.changedTouches?.[0]?.clientY);
          if(touchY!=null&&Number.isFinite(y)&&Math.abs(y-touchY)>8)nudge(touchY>y?1:-1);
          touchY=null;
        },{passive:true});
      };

      try{rendition.getContents?.().forEach(wireContents)}catch{}
      try{rendition.hooks?.content?.register?.(wireContents)}catch{}
      try{rendition.on?.("rendered",()=>{try{rendition.getContents?.().forEach(wireContents)}catch{}})}catch{}
    }

    try{Promise.resolve(rendition.started).then(installManager).catch(()=>{})}catch{}
    try{rendition.on?.("started",installManager)}catch{}
    setTimeout(installManager,0);
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgStabilityBookPatched||typeof book.renderTo!=="function")return book;
    book.__sgStabilityBookPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options),options);
    return book;
  }

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
