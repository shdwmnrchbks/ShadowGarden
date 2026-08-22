/* Shadow Garden v1.1.1 — EPUB.js continuous upward-scroll stabilization.
 *
 * EPUB.js's continuous scrolled-doc manager prepends the previous spine view while
 * scrolling upward. Browser scroll anchoring can then compensate for that inserted
 * content and pull the viewport back down into the current/next section. Disable
 * anchoring only for continuous renditions and their chapter documents.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const noAnchor=element=>{
    if(!element?.style)return;
    try{element.style.setProperty("overflow-anchor","none","important")}catch{}
  };

  function disableContentAnchoring(contents){
    const doc=contents?.document;
    if(!doc)return;
    noAnchor(doc.documentElement);
    noAnchor(doc.body);
    try{doc.querySelectorAll(".epub-container,.epub-view").forEach(noAnchor)}catch{}
  }

  function viewerElement(target){
    if(target&&typeof target==="object"&&target.nodeType===1)return target;
    if(typeof target==="string"){
      try{return document.getElementById(target)||document.querySelector(target)}catch{}
    }
    return document.getElementById("viewer");
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

  function patchContinuousRendition(rendition,target,options){
    if(!rendition||rendition.__sgContinuousAnchorPatched)return rendition;
    const continuous=options?.manager==="continuous"||options?.flow==="scrolled-doc";
    if(!continuous)return rendition;
    rendition.__sgContinuousAnchorPatched=true;

    /* Register before reader.js displays the first target so every section receives
       the rule as EPUB.js creates/preloads it, including sections prepended above. */
    try{rendition.hooks?.content?.register?.(disableContentAnchoring)}catch{}

    disableManagerAnchoring(rendition,target);
    try{
      rendition.on("rendered",(_,view)=>{
        disableManagerAnchoring(rendition,target);
        if(view?.contents)disableContentAnchoring(view.contents);
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
