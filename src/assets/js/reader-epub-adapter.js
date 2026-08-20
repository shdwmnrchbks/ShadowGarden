/* Shadow Garden EPUB.js compatibility adapter.
 * Keeps third-party layout/navigation quirks outside the reader state engine.
 */
(()=>{
  const originalEpub=window.ePub;
  if(typeof originalEpub!=="function")return;

  let currentBook=null,currentRendition=null,currentTarget=null,viewportTimer=0;

  function viewerElement(target=currentTarget){
    if(target instanceof Element)return target;
    if(typeof target==="string")return document.getElementById(target)||document.querySelector(target);
    return document.getElementById("viewer");
  }

  function measuredViewer(target=currentTarget){
    const viewer=viewerElement(target);
    if(!viewer)return null;
    const rect=viewer.getBoundingClientRect();
    const width=Math.max(1,Math.floor(rect.width||viewer.clientWidth||0));
    const height=Math.max(1,Math.floor(rect.height||viewer.clientHeight||0));
    return width&&height?{width,height}:null;
  }

  function mobilePagination(){
    if(!document.body?.classList.contains("reader-flow-paginated"))return false;
    const visual=Number(window.visualViewport?.width),inner=Number(window.innerWidth),client=Number(document.documentElement?.clientWidth);
    const widths=[visual,inner,client].filter(value=>Number.isFinite(value)&&value>0);
    const width=widths.length?Math.min(...widths):0;
    const coarse=window.matchMedia?.("(pointer: coarse)")?.matches===true;
    const mobile=navigator.userAgentData?.mobile===true||/Android|iPhone|iPod|Mobile/i.test(navigator.userAgent||"");
    return mobile||(width>0&&width<900)||(coarse&&width>0&&width<=1024);
  }

  function normalizeMobilePage(contents){
    if(!mobilePagination())return;
    const doc=contents?.document;
    if(!doc?.head)return;
    let style=doc.getElementById("sg-mobile-page-layout");
    if(!style){
      style=doc.createElement("style");
      style.id="sg-mobile-page-layout";
      doc.head.appendChild(style);
    }
    /* EPUB.js calculates its columns from the iframe width. A 100%-wide, border-box
       body ensures the reader theme's horizontal padding is included in that column
       instead of extending beyond it and becoming the first slice of the next page. */
    style.textContent="html{width:100%!important;max-width:100%!important}body{width:100%!important;max-width:100%!important;box-sizing:border-box!important;margin-left:0!important;margin-right:0!important}";
  }

  function patchRendition(rendition,target){
    if(!rendition||rendition.__sgAdapterPatched)return rendition;
    rendition.__sgAdapterPatched=true;
    currentRendition=rendition;
    currentTarget=target;

    const rawResize=typeof rendition.resize==="function"?rendition.resize.bind(rendition):null;
    if(rawResize){
      rendition.resize=(width,height)=>{
        if(document.body?.classList.contains("reader-flow-paginated")){
          const size=measuredViewer(target);
          if(size)return rawResize(size.width,size.height);
        }
        return rawResize(width,height);
      };
    }

    try{
      rendition.on("rendered",(_,view)=>{
        if(rendition!==currentRendition)return;
        const contents=view?.contents;
        if(contents)setTimeout(()=>normalizeMobilePage(contents),0);
        else setTimeout(()=>{
          try{rendition.getContents?.().forEach(normalizeMobilePage)}catch{}
        },0);
      });
    }catch{}
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgAdapterPatched)return book;
    book.__sgAdapterPatched=true;
    currentBook=book;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>{
      const next={...options};
      if(next.flow==="paginated"){
        const size=measuredViewer(target);
        if(size){next.width=size.width;next.height=size.height}
      }
      return patchRendition(rawRenderTo(target,next),target);
    };
    return book;
  }

  function wrappedEpub(...args){return patchBook(originalEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,originalEpub)}catch{}
  try{wrappedEpub.prototype=originalEpub.prototype}catch{}
  window.ePub=wrappedEpub;

  function decodeFragment(value){try{return decodeURIComponent(value)}catch{return value}}

  async function cfiFromTocHref(book,href){
    const text=String(href||"");
    if(!text)return"";
    let section=null;
    try{section=book?.spine?.get?.(text)}catch{}
    if(!section){
      const path=text.split("#")[0];
      try{section=book?.spine?.get?.(path)}catch{}
    }
    if(!section)return text;

    if(!section.document)await section.load(book.load.bind(book));
    const hash=text.indexOf("#"),fragment=hash>=0?decodeFragment(text.slice(hash+1)):"";
    let element=null;
    if(fragment){
      element=section.document?.getElementById?.(fragment)||null;
      if(!element){
        try{element=section.document?.querySelector?.(`[name="${CSS.escape(fragment)}"]`)||null}catch{}
      }
    }
    element=element||section.document?.body||section.document?.documentElement;
    if(!element||typeof section.cfiFromElement!=="function")return text;
    try{return section.cfiFromElement(element)||text}catch{return text}
  }

  function closeTocDrawer(){
    document.querySelectorAll(".reader-drawer").forEach(drawer=>drawer.classList.remove("open"));
    document.getElementById("drawerBackdrop")?.classList.add("hidden");
  }

  /* In the continuous manager, display(href) can reuse a retained section offset.
     Resolve the TOC href to a concrete CFI so chapter/anchor navigation is exact. */
  document.addEventListener("click",event=>{
    const button=event.target?.closest?.("#tocPanel .toc-entry-link[data-href]");
    if(!button||!document.body?.classList.contains("reader-flow-scrolled"))return;
    const book=currentBook,rendition=currentRendition;
    if(!book||!rendition)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const href=button.dataset.href||"";
    (async()=>{
      try{
        const target=await cfiFromTocHref(book,href);
        await rendition.display(target);
        /* A second exact placement after layout settles corrects continuous views that
           were already preloaded with an older height/scroll offset. */
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if(rendition===currentRendition&&document.body.classList.contains("reader-flow-scrolled"))await rendition.display(target);
        closeTocDrawer();
      }catch(error){
        console.error("Continuous TOC navigation failed",error);
        try{await rendition.display(href);closeTocDrawer()}catch(fallbackError){console.error("TOC fallback navigation failed",fallbackError)}
      }
    })();
  },true);

  /* Mobile browser chrome can change the visual viewport without producing a useful
     layout width for EPUB.js. Forward that change to the reader's normal resize path. */
  window.visualViewport?.addEventListener("resize",()=>{
    clearTimeout(viewportTimer);
    viewportTimer=setTimeout(()=>window.dispatchEvent(new Event("resize")),80);
  });
})();
