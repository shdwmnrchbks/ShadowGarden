/* Shadow Garden R4.1 — EPUB.js 0.3.93 lifecycle compatibility patch.
   Carries upstream listener cleanup (futurepress/epub.js#326238c) and closes the
   long-lived Book.spine hook that otherwise roots every destroyed Rendition. */

const PATCHED_VERSION="0.3.93";
const renditionPatchMarker=Symbol.for("shadow-garden.epubjs.rendition-lifecycle.v2");
const managerPatchMarker=Symbol.for("shadow-garden.epubjs.manager-lifecycle.v2");
const bookPatchMarker=Symbol.for("shadow-garden.epubjs.book-rendition-lifecycle.v2");
const instancePatchMarker=Symbol.for("shadow-garden.epubjs.rendition-instance-lifecycle.v2");

function patchManagerClass(Manager){
  const prototype=Manager?.prototype;
  if(!prototype||prototype[managerPatchMarker])return Manager;

  const originalDestroy=prototype.destroy;

  prototype.addEventListeners=function(){
    const scroller=this.settings?.fullsize===true?window:this.container;
    if(this._onUnload)window.removeEventListener("unload",this._onUnload);
    this._onUnload=this.destroy.bind(this);
    window.addEventListener("unload",this._onUnload);
    if(this._onScroll&&scroller)scroller.removeEventListener("scroll",this._onScroll);
    this._onScroll=this.onScroll.bind(this);
    scroller?.addEventListener("scroll",this._onScroll);
  };

  prototype.removeEventListeners=function(){
    const scroller=this.settings?.fullsize===true?window:this.container;
    if(this._onScroll&&scroller)scroller.removeEventListener("scroll",this._onScroll);
    this._onScroll=undefined;
    if(this._onUnload)window.removeEventListener("unload",this._onUnload);
    this._onUnload=undefined;
  };

  prototype.destroy=function(...args){
    const orientationListener=this.stage?.orientationChangeFunc;
    if(orientationListener)window.removeEventListener("orientationchange",orientationListener);
    return originalDestroy?.apply(this,args);
  };

  Object.defineProperty(prototype,managerPatchMarker,{value:true,configurable:false,enumerable:false,writable:false});
  return Manager;
}

function patchRenditionInstance(rendition,bookContentHooks,registeredHooks){
  if(!rendition||rendition[instancePatchMarker]||!registeredHooks.length)return rendition;
  const originalDestroy=rendition.destroy;
  rendition.destroy=function(...args){
    for(const hook of registeredHooks.splice(0)){
      try{bookContentHooks?.deregister?.(hook)}catch{}
    }
    return originalDestroy?.apply(this,args);
  };
  Object.defineProperty(rendition,instancePatchMarker,{value:true,configurable:false,enumerable:false,writable:false});
  return rendition;
}

function patchBookRenderTo(Book){
  const prototype=Book?.prototype;
  if(!prototype||prototype[bookPatchMarker]||typeof prototype.renderTo!=="function")return Boolean(prototype?.[bookPatchMarker]);
  const renderTo=prototype.renderTo;
  prototype.renderTo=function(...args){
    const bookContentHooks=this.spine?.hooks?.content;
    const before=new Set(bookContentHooks?.list?.()||[]);
    const rendition=renderTo.apply(this,args);
    const added=(bookContentHooks?.list?.()||[]).filter(hook=>!before.has(hook));
    return patchRenditionInstance(rendition,bookContentHooks,added);
  };
  Object.defineProperty(prototype,bookPatchMarker,{value:true,configurable:false,enumerable:false,writable:false});
  return true;
}

export function installEpubLifecyclePatch(epub=globalThis.ePub){
  if(String(epub?.VERSION||"")!==PATCHED_VERSION)return false;
  const prototype=epub?.Rendition?.prototype;
  if(!prototype)return false;

  if(!prototype[renditionPatchMarker]){
    const requireManager=prototype.requireManager;
    if(typeof requireManager!=="function")return false;
    prototype.requireManager=function(manager){
      return patchManagerClass(requireManager.call(this,manager));
    };
    Object.defineProperty(prototype,renditionPatchMarker,{value:true,configurable:false,enumerable:false,writable:false});
  }

  if(!patchBookRenderTo(epub?.Book))return false;
  return true;
}
