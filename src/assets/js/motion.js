(()=>{
  const query="(prefers-reduced-motion: reduce)";
  const preference=window.matchMedia?.(query);
  const root=document.documentElement;

  const reduced=()=>Boolean(preference?.matches);
  const syncPreference=()=>{
    root.dataset.sgMotion=reduced()?"reduced":"full";
    window.dispatchEvent(new CustomEvent("sg:motionchange",{detail:{reduced:reduced()}}));
  };

  const fallbackTransition=update=>{
    let result;
    try{result=update?.()}catch(error){return {finished:Promise.reject(error),ready:Promise.reject(error),updateCallbackDone:Promise.reject(error),skipTransition(){}}}
    const done=Promise.resolve(result);
    return {finished:done,ready:Promise.resolve(),updateCallbackDone:done,skipTransition(){}};
  };

  const transition=(update,{types=[]}={})=>{
    if(reduced()||typeof document.startViewTransition!=="function")return fallbackTransition(update);
    try{
      if(types.length){
        try{return document.startViewTransition({update,types})}catch{}
      }
      return document.startViewTransition(update);
    }catch{
      return fallbackTransition(update);
    }
  };

  const decorateControls=(scope=document)=>{
    const selector="button,[role='button'],a.reader-icon,a.reader-return,.volume-action,.header-back,.recent-view-all,.footer-button";
    scope.querySelectorAll?.(selector).forEach(element=>element.classList.add("sg-motion-control"));
  };

  const boot=()=>{
    syncPreference();
    decorateControls();
    document.documentElement.classList.add("sg-motion-ready");
    if("MutationObserver" in window){
      const observer=new MutationObserver(records=>{
        records.forEach(record=>record.addedNodes.forEach(node=>{
          if(node.nodeType!==1)return;
          if(node.matches?.("button,[role='button'],a.reader-icon,a.reader-return,.volume-action,.header-back,.recent-view-all,.footer-button"))node.classList.add("sg-motion-control");
          decorateControls(node);
        }));
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
    }
  };

  preference?.addEventListener?.("change",syncPreference);
  window.ShadowGardenMotion=Object.freeze({
    get reduced(){return reduced()},
    transition,
    decorateControls
  });

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
