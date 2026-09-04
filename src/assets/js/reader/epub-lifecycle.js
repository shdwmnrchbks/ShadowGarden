/* Shadow Garden R4.1 — EPUB.js 0.3.93 lifecycle compatibility patch. */

const renditionPatchMarker=Symbol.for("shadow-garden.epubjs.rendition-lifecycle.v1");
const managerPatchMarker=Symbol.for("shadow-garden.epubjs.manager-lifecycle.v1");

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

export function installEpubLifecyclePatch(epub=globalThis.ePub){
  const prototype=epub?.Rendition?.prototype;
  if(!prototype||prototype[renditionPatchMarker])return Boolean(prototype?.[renditionPatchMarker]);
  const requireManager=prototype.requireManager;
  if(typeof requireManager!=="function")return false;

  prototype.requireManager=function(manager){
    return patchManagerClass(requireManager.call(this,manager));
  };
  Object.defineProperty(prototype,renditionPatchMarker,{value:true,configurable:false,enumerable:false,writable:false});
  return true;
}
