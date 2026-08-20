/* Shadow Garden reader flow + bookmark interaction v0.7.3. */
(()=>{
  const flowSelect=document.querySelector("#flowSelect");
  const originalBookmarkButton=document.querySelector("#bookmarkButton");
  let managerMode="default";
  let rebuilding=false;
  let rebuildQueued=false;

  function syncFlowClass(){
    document.body.classList.toggle("reader-flow-scrolled",settings?.flow==="scrolled-doc");
    document.body.classList.toggle("reader-flow-paginated",settings?.flow!=="scrolled-doc");
  }

  /* applySettings rewrites body.className, so restore the flow marker every time. */
  const baseApplySettings=applySettings;
  applySettings=function(redisplay=false){
    baseApplySettings(redisplay);
    syncFlowClass();
  };
  syncFlowClass();

  function bookmarkIndex(){
    if(!currentCfi)return -1;
    return bookmarks().findIndex(item=>item?.cfi===currentCfi);
  }

  function updateBookmarkState(){
    const button=document.querySelector("#bookmarkButton");
    if(!button)return;
    const saved=bookmarkIndex()>=0;
    button.textContent=saved?"◆":"◇";
    button.classList.toggle("bookmarked",saved);
    button.setAttribute("aria-pressed",saved?"true":"false");
    button.title=saved?"Remove bookmark":"Bookmark this location";
    button.setAttribute("aria-label",saved?"Remove bookmark at this location":"Bookmark this location");
  }

  /* Replace the old one-way bookmark button to remove its existing click handler. */
  if(originalBookmarkButton){
    const button=originalBookmarkButton.cloneNode(true);
    originalBookmarkButton.replaceWith(button);
    button.setAttribute("aria-pressed","false");
    button.addEventListener("click",()=>{
      if(!currentCfi)return;
      const list=bookmarks();
      const index=list.findIndex(item=>item?.cfi===currentCfi);
      if(index>=0){
        list.splice(index,1);
        writeJSON(bookmarksKey,list);
        renderBookmarks();
        updateBookmarkState();
        toast("Bookmark removed");
        return;
      }
      list.push({cfi:currentCfi,label:currentChapter||document.querySelector("#bookTitle")?.textContent||"Saved location",at:Date.now()});
      writeJSON(bookmarksKey,list);
      renderBookmarks();
      updateBookmarkState();
      toast("Bookmark saved");
    });
  }

  document.querySelector("#bookmarksPanel")?.addEventListener("click",()=>setTimeout(updateBookmarkState,0));

  function chapterForLocation(loc){
    const href=loc?.start?.href||"";
    const toc=book?.navigation?.toc||[];
    const match=toc.find(item=>{
      const itemHref=String(item?.href||"").split("#")[0];
      return href.endsWith(itemHref)||itemHref.endsWith(href);
    });
    return match?.label?.trim()||(loc?.start?.displayed?.page?`Page ${loc.start.displayed.page}`:"");
  }

  function wireRendition(next){
    if(!next)return;
    try{next.hooks.content.register(contents=>setTimeout(()=>fixContentContrast(contents),0))}catch{}
    next.on("relocated",loc=>{
      currentChapter=chapterForLocation(loc);
      const chapter=document.querySelector("#chapterTitle");
      if(chapter)chapter.textContent=currentChapter;
      saveProgress(loc);
      refreshContentContrast();
      updateBookmarkState();
    });
    next.on("rendered",()=>{
      refreshContentContrast();
      updateBookmarkState();
    });
    next.on("keyup",event=>{
      if(settings.flow!=="paginated")return;
      if(event.key==="ArrowRight")next.next();
      if(event.key==="ArrowLeft")next.prev();
    });
  }

  async function rebuildRendition(force=false){
    if(rebuilding){rebuildQueued=true;return}
    if(!book||!rendition)return;
    const desired=settings.flow==="scrolled-doc"?"continuous":"default";
    if(!force&&desired===managerMode){syncFlowClass();return}

    rebuilding=true;
    const target=currentCfi||readJSON(progressKey,null)?.cfi||undefined;
    const old=rendition;
    try{old.destroy?.()}catch(error){console.warn("Old rendition cleanup skipped",error)}
    const viewer=document.querySelector("#viewer");
    if(viewer)viewer.innerHTML="";

    try{
      rendition=book.renderTo("viewer",{
        width:"100%",
        height:"100%",
        manager:desired,
        flow:settings.flow,
        spread:settings.flow==="paginated"?"auto":"none",
        minSpreadWidth:900
      });
      managerMode=desired;
      wireRendition(rendition);
      try{rendition.themes.default(themeCSS())}catch{}
      configureSpread();
      syncFlowClass();
      if(target)await rendition.display(target);else await rendition.display();
      refreshContentContrast();
      updateBookmarkState();
    }catch(error){
      console.error("Reader flow rebuild failed",error);
      toast("Could not switch reading flow");
    }finally{
      rebuilding=false;
      if(rebuildQueued){rebuildQueued=false;setTimeout(()=>rebuildRendition(),0)}
    }
  }

  flowSelect?.addEventListener("change",()=>setTimeout(()=>rebuildRendition(),0));

  /* Prevent the old page-turn keyboard handler from firing in vertical scroll mode. */
  document.addEventListener("keydown",event=>{
    if(settings?.flow!=="scrolled-doc")return;
    if(event.key==="ArrowLeft"||event.key==="ArrowRight")event.stopImmediatePropagation();
  },true);

  /* Wait until the initial reader display has completed before correcting its manager. */
  const readyTimer=setInterval(()=>{
    if(!book||!rendition)return;
    const loading=document.querySelector("#readerLoading");
    if(loading&&!loading.classList.contains("hidden"))return;
    clearInterval(readyTimer);
    updateBookmarkState();
    if(settings.flow==="scrolled-doc")rebuildRendition(true);
    else managerMode="default";
    try{rendition.on("relocated",updateBookmarkState)}catch{}
  },80);
})();
