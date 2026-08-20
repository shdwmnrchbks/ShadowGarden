/* Shadow Garden v0.13.1 — EPUB.js gesture lifecycle bridge.
 * Register gesture documents through EPUB.js's content hook so chapter/spine boundaries
 * do not depend on iframe MutationObserver/load timing.
 */
(()=>{
  const originalEpub=window.ePub;
  if(typeof originalEpub!=="function")return;

  const queue=window.__sgReaderGestureDocuments=Array.isArray(window.__sgReaderGestureDocuments)?window.__sgReaderGestureDocuments:[];

  function announce(contents){
    const doc=contents?.document||contents?.contentDocument||null;
    if(!doc?.documentElement)return;
    if(!queue.includes(doc)){
      queue.push(doc);
      if(queue.length>12)queue.splice(0,queue.length-12);
    }
    try{document.dispatchEvent(new CustomEvent("sg-reader-content",{detail:{document:doc}}))}catch{}
  }

  function patchRendition(rendition){
    if(!rendition||rendition.__sgGestureHookPatched)return rendition;
    rendition.__sgGestureHookPatched=true;
    try{rendition.hooks?.content?.register?.(contents=>announce(contents))}catch(error){console.warn("Reader gesture content hook unavailable",error)}
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
