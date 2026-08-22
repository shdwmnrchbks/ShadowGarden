/* Shadow Garden v1.2.1 — non-modal end-of-volume page. */
(()=>{
  const $=selector=>document.querySelector(selector);
  let pagedActive=false;

  function canonicalEnd(){
    const total=Number(window.__sgCanonicalPageMap?.totalPages)||0;
    const text=String($("#progressText")?.textContent||"").trim();
    const match=text.match(/^(\d+)\s*\/\s*(\d+)$/);
    return Boolean(total>0&&match&&Number(match[1])>=Number(match[2])&&Number(match[2])===total);
  }

  function page(){return $("#volumeEndPage")}
  function viewerShell(){return $("#viewerShell")}
  function scroller(){return $("#viewer .epub-container")}

  function moveHome(){
    const end=page(),shell=viewerShell();
    if(end&&shell&&end.parentElement!==shell)shell.appendChild(end);
  }

  function hidePagedEnd(){
    pagedActive=false;
    moveHome();
    const end=page();
    end?.classList.add("hidden");
    end?.classList.remove("active");
  }

  function showPagedEnd(){
    if(!document.body.classList.contains("reader-flow-paginated"))return;
    const end=page();if(!end)return;
    moveHome();
    pagedActive=true;
    end.classList.remove("hidden");
    end.classList.add("active");
    requestAnimationFrame(()=>end.querySelector("a:not(.hidden)")?.focus?.({preventScroll:true}));
  }

  function ensureContinuousEnd(){
    if(!document.body.classList.contains("reader-flow-scrolled"))return;
    const end=page(),container=scroller();
    if(!end||!container||!canonicalEnd())return;
    if(end.parentElement!==container)container.appendChild(end);
    end.classList.remove("hidden","active");
    end.classList.add("continuous-end");
  }

  function syncFlow(){
    const end=page();if(!end)return;
    if(document.body.classList.contains("reader-flow-scrolled")){
      pagedActive=false;
      end.classList.remove("active");
      ensureContinuousEnd();
    }else{
      end.classList.remove("continuous-end");
      moveHome();
      end.classList.toggle("hidden",!pagedActive);
      end.classList.toggle("active",pagedActive);
    }
  }

  document.addEventListener("sg-reader-volume-end-request",event=>{
    event.preventDefault?.();
    showPagedEnd();
  });

  document.addEventListener("click",event=>{
    const next=event.target?.closest?.("#nextPage,#nextBottom");
    const prev=event.target?.closest?.("#prevPage,#prevBottom");
    if(next&&document.body.classList.contains("reader-flow-paginated")&&canonicalEnd()){
      event.preventDefault();event.stopImmediatePropagation();showPagedEnd();return;
    }
    if(prev&&pagedActive){
      event.preventDefault();event.stopImmediatePropagation();hidePagedEnd();
    }
  },true);

  document.addEventListener("keydown",event=>{
    if(!document.body.classList.contains("reader-flow-paginated")||["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
    if((event.key==="ArrowRight"||event.key==="PageDown")&&canonicalEnd()){
      event.preventDefault();event.stopImmediatePropagation();showPagedEnd();
    }else if(pagedActive&&(event.key==="ArrowLeft"||event.key==="PageUp"||event.key==="Escape")){
      event.preventDefault();event.stopImmediatePropagation();hidePagedEnd();
    }
  },true);

  function init(){
    const text=$("#progressText");
    if(text)new MutationObserver(()=>{ensureContinuousEnd()}).observe(text,{childList:true,characterData:true,subtree:true});
    new MutationObserver(syncFlow).observe(document.body,{attributes:true,attributeFilter:["class"]});
    const viewer=$("#viewer");
    if(viewer)new MutationObserver(()=>{if(document.body.classList.contains("reader-flow-scrolled")&&canonicalEnd())ensureContinuousEnd()}).observe(viewer,{childList:true,subtree:true});
    syncFlow();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
