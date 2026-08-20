/* Shadow Garden reader flow, bookmarks, and nested TOC v0.7.4. */
(()=>{
  const flowSelect=document.querySelector("#flowSelect");
  const originalBookmarkButton=document.querySelector("#bookmarkButton");
  const tocPanel=document.querySelector("#tocPanel");
  let managerMode="default";
  let rebuilding=false;
  let rebuildQueued=false;
  let tocInstalled=false;

  function syncFlowClass(){
    const scrolled=settings?.flow==="scrolled-doc";
    document.body.classList.toggle("reader-flow-scrolled",scrolled);
    document.body.classList.toggle("reader-flow-paginated",!scrolled);
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

  function tocChildren(item){
    if(Array.isArray(item?.subitems))return item.subitems;
    if(Array.isArray(item?.children))return item.children;
    return[];
  }

  function flattenToc(items,out=[]){
    for(const item of Array.isArray(items)?items:[]){
      out.push(item);
      flattenToc(tocChildren(item),out);
    }
    return out;
  }

  function cleanHref(value){return String(value||"").split("#")[0]}

  function chapterForLocation(loc){
    const href=cleanHref(loc?.start?.href);
    const toc=flattenToc(book?.navigation?.toc||[]);
    const match=toc.find(item=>{
      const itemHref=cleanHref(item?.href);
      return itemHref&&(href.endsWith(itemHref)||itemHref.endsWith(href));
    });
    return match?.label?.trim()||(loc?.start?.displayed?.page?`Page ${loc.start.displayed.page}`:"");
  }

  function tocMarkup(items,depth=0,path="toc"){
    return (Array.isArray(items)?items:[]).map((item,index)=>{
      const children=tocChildren(item);
      const id=`${path}-${index}`;
      const label=esc(String(item?.label||"Untitled section").trim());
      const href=String(item?.href||"");
      const link=href
        ?`<button class="toc-link toc-entry-link" type="button" data-href="${esc(href)}">${label}</button>`
        :`<span class="toc-link toc-entry-label">${label}</span>`;
      if(!children.length){
        return `<div class="toc-node toc-leaf" style="--toc-depth:${depth}"><div class="toc-row"><span class="toc-expander-spacer" aria-hidden="true"></span>${link}</div></div>`;
      }
      return `<div class="toc-node toc-branch" style="--toc-depth:${depth}">
        <div class="toc-row"><button class="toc-expander" type="button" data-toc-toggle="${id}" aria-expanded="true" aria-controls="${id}">▾</button>${link}</div>
        <div class="toc-children" id="${id}">${tocMarkup(children,depth+1,id)}</div>
      </div>`;
    }).join("");
  }

  async function installNestedToc(){
    if(tocInstalled||!book||!tocPanel)return;
    try{
      const navigation=await book.loaded.navigation;
      const items=navigation?.toc||book?.navigation?.toc||[];
      if(!items.length)return;
      tocPanel.innerHTML=`<div class="toc-tree" role="tree">${tocMarkup(items)}</div>`;
      tocInstalled=true;
    }catch(error){console.warn("Nested TOC rendering skipped",error)}
  }

  tocPanel?.addEventListener("click",event=>{
    const toggle=event.target.closest("[data-toc-toggle]");
    if(!toggle)return;
    event.preventDefault();
    event.stopPropagation();
    const target=document.getElementById(toggle.dataset.tocToggle);
    if(!target)return;
    const expanded=toggle.getAttribute("aria-expanded")!=="false";
    toggle.setAttribute("aria-expanded",expanded?"false":"true");
    toggle.textContent=expanded?"▸":"▾";
    target.classList.toggle("collapsed",expanded);
  });

  function injectScrollChromeFix(contents){
    const doc=contents?.document;if(!doc?.head)return;
    let style=doc.getElementById("sg-scrollbar-hide");
    if(!style){
      style=doc.createElement("style");
      style.id="sg-scrollbar-hide";
      style.textContent="html,body{scrollbar-width:none!important;-ms-overflow-style:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}";
      doc.head.appendChild(style);
    }
  }

  function wireRendition(next){
    if(!next)return;
    try{next.hooks.content.register(contents=>{
      setTimeout(()=>fixContentContrast(contents),0);
      if(settings.flow==="scrolled-doc")injectScrollChromeFix(contents);
    })}catch{}
    next.on("relocated",loc=>{
      currentChapter=chapterForLocation(loc);
      const chapter=document.querySelector("#chapterTitle");
      if(chapter)chapter.textContent=currentChapter;
      saveProgress(loc);
      refreshContentContrast();
      updateBookmarkState();
    });
    next.on("rendered",(_,view)=>{
      if(settings.flow==="scrolled-doc"){
        try{const contents=view?.contents;if(contents)injectScrollChromeFix(contents)}catch{}
      }
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

  /* Wait until the initial reader display has completed before correcting its manager and TOC. */
  const readyTimer=setInterval(()=>{
    if(!book||!rendition)return;
    const loading=document.querySelector("#readerLoading");
    if(loading&&!loading.classList.contains("hidden"))return;
    clearInterval(readyTimer);
    installNestedToc();
    updateBookmarkState();
    if(settings.flow==="scrolled-doc")rebuildRendition(true);
    else managerMode="default";
    try{rendition.on("relocated",updateBookmarkState)}catch{}
  },80);
})();
