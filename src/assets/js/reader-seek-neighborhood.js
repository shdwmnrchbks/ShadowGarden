/* Shadow Garden v1.3.1 — Continuous seek neighborhood recovery.
 *
 * EPUB.js DefaultViewManager.display() clears the Continuous view list when seeking to a
 * section that is not already mounted. A seek into the middle of a long XHTML can therefore
 * leave the reader with one isolated spine view: the user can scroll inside that XHTML, but
 * there is no previous/next view to cross into until another manager check successfully runs.
 *
 * This layer treats a committed seek as a transaction. After the target is displayed it mounts
 * a small previous/current/next neighborhood immediately, restores the exact seek target inside
 * the now-retained current view, resets silent-scroll suppression, and resynchronizes the
 * manager's scroll bookkeeping. It also absorbs reader.js's deliberate second identical
 * Continuous display for the same seek so that recovery cannot be cleared again afterward.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const NEIGHBORS_EACH_SIDE=2;
  const SEEK_WINDOW_MS=8000;
  const DUPLICATE_WINDOW_MS=1800;
  let seekSerial=0;
  let seekExpires=0;

  const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const targetKey=target=>typeof target==="string"?target:target?.toString?.()||"";
  const cleanHref=value=>{
    let href=String(value||"").split("#")[0].split("?")[0];
    try{href=decodeURIComponent(href)}catch{}
    return href.replace(/^\.\//,"").replace(/^\//,"");
  };
  const hrefMatches=(a,b)=>{
    const left=cleanHref(a),right=cleanHref(b);
    return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
  };

  document.addEventListener("change",event=>{
    if(event.target?.id!=="progressRange")return;
    seekSerial+=1;
    seekExpires=performance.now()+SEEK_WINDOW_MS;
  },true);

  function isContinuous(options,rendition){
    return options?.manager==="continuous"||String(options?.flow||rendition?.settings?.flow||"").startsWith("scrolled");
  }

  function syncScroll(manager){
    if(!manager)return{top:0,left:0};
    const dir=manager.settings?.direction==="rtl"&&manager.settings?.rtlScrollType==="default"?-1:1;
    const top=manager.settings?.fullsize?(Number(window.scrollY)||0)*dir:Number(manager.container?.scrollTop)||0;
    const left=manager.settings?.fullsize?(Number(window.scrollX)||0)*dir:Number(manager.container?.scrollLeft)||0;
    manager.scrollTop=top;
    manager.scrollLeft=left;
    manager.prevScrollTop=top;
    manager.prevScrollLeft=left;
    manager.scrollDeltaVert=0;
    manager.scrollDeltaHorz=0;
    return{top,left};
  }

  function loadedViews(manager){
    try{return manager?.views?.all?.()||[]}catch{return[]}
  }

  function viewForSection(manager,section){
    if(!section)return null;
    const views=loadedViews(manager);
    return views.find(view=>view?.section===section||hrefMatches(view?.section?.href,section.href))||null;
  }

  function targetSection(rendition,target){
    if(target){
      try{
        const section=rendition?.book?.spine?.get?.(target);
        if(section?.href)return section;
      }catch{}
    }
    const views=loadedViews(rendition?.manager);
    const displayed=views.filter(view=>view?.displayed&&view?.section);
    if(displayed.length===1)return displayed[0].section;

    const box=rendition?.manager?.container;
    const scrollTop=Number(box?.scrollTop)||0;
    const viewport=Number(box?.clientHeight)||0;
    const anchor=scrollTop+viewport*.3;
    let best=null,bestDistance=Infinity;
    for(const view of displayed){
      try{
        const offset=view.offset?.();
        const top=Number(offset?.top)||0;
        const height=Math.max(1,Number(view.height?.())||Number(view.bounds?.()?.height)||0);
        const bottom=top+height;
        const distance=anchor<top?top-anchor:anchor>bottom?anchor-bottom:0;
        if(distance<bestDistance){best=view;bestDistance=distance}
      }catch{}
    }
    return best?.section||displayed[0]?.section||views.find(view=>view?.section)?.section||null;
  }

  async function displayInsertedView(view,manager){
    if(!view)return null;
    try{
      const result=await view.display(manager.request);
      const shown=result||view;
      shown.stopExpanding=false;
      shown.show?.();
      return shown;
    }catch(error){
      console.warn("Continuous seek neighbor could not be displayed",error);
      return null;
    }
  }

  async function prependNeighbors(manager,anchor,count){
    let section=anchor;
    let added=0;
    for(let index=0;index<count;index+=1){
      try{section=section?.prev?.()}catch{section=null}
      if(!section)break;
      if(viewForSection(manager,section))continue;
      let view=null;
      try{view=manager.prepend?.(section)}catch(error){console.warn("Continuous seek previous neighbor skipped",error)}
      if(!view)break;
      const shown=await displayInsertedView(view,manager);
      if(shown)added+=1;
    }
    return added;
  }

  async function appendNeighbors(manager,anchor,count){
    let section=anchor;
    let added=0;
    for(let index=0;index<count;index+=1){
      try{section=section?.next?.()}catch{section=null}
      if(!section)break;
      if(viewForSection(manager,section))continue;
      let view=null;
      try{view=manager.append?.(section)}catch(error){console.warn("Continuous seek next neighbor skipped",error)}
      if(!view)break;
      const shown=await displayInsertedView(view,manager);
      if(shown)added+=1;
    }
    return added;
  }

  async function restoreExactTarget(manager,section,target){
    if(!manager||!section)return;
    try{
      /* The target section is already mounted, so manager.display() takes EPUB.js's
         non-destructive visible-view path instead of clearing the newly built neighborhood. */
      await manager.display?.(section,target);
    }catch(error){
      console.warn("Continuous seek target re-center skipped",error);
    }
    await paint();
    manager.ignore=false;
    syncScroll(manager);
  }

  async function restoreNeighborhood(rendition,target){
    const manager=rendition?.manager;
    if(!manager?.views||!manager?.container)return;
    if(manager.__sgSeekNeighborhoodPromise)return manager.__sgSeekNeighborhoodPromise;

    const run=async()=>{
      clearTimeout(manager.__sgBackgroundFillTimer);
      clearTimeout(manager.__sgBoundedScrollTimer);
      manager.ignore=false;
      syncScroll(manager);

      /* Let any check started by the initial display settle before we modify the view list. */
      try{if(manager.__sgBoundedCheckPromise)await manager.__sgBoundedCheckPromise}catch{}
      await paint();

      const anchor=targetSection(rendition,target);
      if(!anchor)return;

      const before=loadedViews(manager).length;
      const previous=await prependNeighbors(manager,anchor,NEIGHBORS_EACH_SIDE);
      const next=await appendNeighbors(manager,anchor,NEIGHBORS_EACH_SIDE);
      await paint();

      /* Prepending uses EPUB.js's height-delta counter, but re-centering on the exact CFI after
         all neighbor dimensions settle removes any remaining drift without clearing views. */
      await restoreExactTarget(manager,anchor,target);

      try{await manager.update?.(Number(manager.settings?.offset)||0)}catch(error){
        console.warn("Continuous seek neighborhood visibility refresh skipped",error);
      }
      manager.ignore=false;
      const position=syncScroll(manager);

      /* Re-prime the normal bounded checker from a healthy multi-view state. */
      try{Promise.resolve(manager.check?.()).catch(error=>console.warn("Continuous post-seek check skipped",error))}catch{}

      document.dispatchEvent(new CustomEvent("sg-continuous-seek-neighborhood-restored",{detail:{
        target:targetKey(target),
        before,
        after:loadedViews(manager).length,
        previous,
        next,
        scrollTop:position.top
      }}));
    };

    manager.__sgSeekNeighborhoodPromise=run().finally(()=>{manager.__sgSeekNeighborhoodPromise=null});
    return manager.__sgSeekNeighborhoodPromise;
  }

  function patchRendition(rendition,options){
    if(!rendition||rendition.__sgSeekNeighborhoodPatched||!isContinuous(options,rendition))return rendition;
    rendition.__sgSeekNeighborhoodPatched=true;
    let recoveredSerial=0,recoveredTarget="",duplicateUntil=0;

    if(typeof rendition.display==="function"){
      const rawDisplay=rendition.display.bind(rendition);
      rendition.display=(...args)=>{
        const serial=seekSerial;
        const key=targetKey(args[0]);

        /* reader.js intentionally repeats the same target after two paints in Continuous.
           Consume exactly one post-recovery duplicate even if neighbor loading itself took
           longer than the original seek-event window. */
        if(serial===recoveredSerial&&key&&key===recoveredTarget&&performance.now()<duplicateUntil){
          duplicateUntil=0;
          return Promise.resolve(rendition);
        }

        const committed=serial>0&&performance.now()<seekExpires;
        return Promise.resolve(rawDisplay(...args)).then(async result=>{
          if(committed){
            await restoreNeighborhood(rendition,args[0]);
            recoveredSerial=serial;
            recoveredTarget=key;
            duplicateUntil=performance.now()+DUPLICATE_WINDOW_MS;
            seekExpires=0;
          }
          return result;
        });
      };
    }
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgSeekNeighborhoodBookPatched||typeof book.renderTo!=="function")return book;
    book.__sgSeekNeighborhoodBookPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options),options);
    return book;
  }

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
