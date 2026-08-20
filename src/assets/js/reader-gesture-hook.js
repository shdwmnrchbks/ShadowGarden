/* Shadow Garden v0.13.2 — EPUB.js gesture lifecycle + touch bridge.
 * Gesture documents are announced through EPUB.js content hooks, while EPUB.js's own
 * forwarded touch events provide the primary swipe/tap stream across spine boundaries.
 */
(()=>{
  const originalEpub=window.ePub;
  if(typeof originalEpub!=="function")return;

  const queue=window.__sgReaderGestureDocuments=Array.isArray(window.__sgReaderGestureDocuments)?window.__sgReaderGestureDocuments:[];
  window.__sgReaderRenditionTouchBridge=true;

  function interactiveTarget(target){
    return typeof target?.closest==="function"&&Boolean(target.closest("a,button,input,select,textarea,label,[contenteditable=true],[role=button],[role=slider]"));
  }

  function announce(contents){
    const doc=contents?.document||contents?.contentDocument||null;
    if(!doc?.documentElement)return;
    if(!queue.includes(doc)){
      queue.push(doc);
      if(queue.length>12)queue.splice(0,queue.length-12);
    }
    try{document.dispatchEvent(new CustomEvent("sg-reader-content",{detail:{document:doc}}))}catch{}
  }

  function touchPoint(event,type){
    const list=type==="end"?event?.changedTouches:event?.touches;
    return list?.[0]||event?.changedTouches?.[0]||event?.touches?.[0]||null;
  }

  function forwardTouch(type,event){
    const point=touchPoint(event,type);
    const doc=event?.target?.ownerDocument||null;
    if(!point||!doc?.documentElement)return;
    let selection=false;
    try{selection=Boolean(doc.getSelection?.()?.toString().trim())}catch{}
    try{
      document.dispatchEvent(new CustomEvent("sg-reader-touch",{detail:{
        type,
        x:Number(point.clientX)||0,
        y:Number(point.clientY)||0,
        width:Number(doc.documentElement.clientWidth)||Number(doc.defaultView?.innerWidth)||0,
        interactive:interactiveTarget(event.target),
        selection,
        originalEvent:event
      }}));
    }catch{}
  }

  function patchRendition(rendition){
    if(!rendition||rendition.__sgGestureHookPatched)return rendition;
    rendition.__sgGestureHookPatched=true;
    try{rendition.hooks?.content?.register?.(contents=>announce(contents))}catch(error){console.warn("Reader gesture content hook unavailable",error)}
    /* EPUB.js already forwards these DOM touch events from every Contents instance to
       the Rendition. Listening here avoids relying on PointerEvent completion inside a
       chapter iframe, which can be cancelled on the final paginated column. */
    try{rendition.on?.("touchstart",event=>forwardTouch("start",event))}catch{}
    try{rendition.on?.("touchmove",event=>forwardTouch("move",event))}catch{}
    try{rendition.on?.("touchend",event=>forwardTouch("end",event))}catch{}
    /* Rendered is a defensive fallback for EPUB.js builds/views that bypass a content hook. */
    try{rendition.on?.("rendered",(_,view)=>announce(view?.contents))}catch{}
    try{rendition.getContents?.().forEach(announce)}catch{}
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgGestureBookPatched)return book;
    book.__sgGestureBookPatched=true;
    if(typeof book.renderTo!=="function")return book;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(...args)=>patchRendition(rawRenderTo(...args));
    return book;
  }

  function wrappedEpub(...args){return patchBook(originalEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,originalEpub)}catch{}
  try{wrappedEpub.prototype=originalEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
