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
  function scroller(){return $("#viewer .epub-container")}
  function continuousClone(){return $("#viewer .volume-end-page-continuous")}

  function stripIds(root){
    root.removeAttribute("id");
    root.removeAttribute("aria-labelledby");
    root.removeAttribute("aria-describedby");
    root.querySelectorAll("[id]").forEach(node=>node.removeAttribute("id"));
  }

  function removeContinuousEnd(){continuousClone()?.remove()}

  function hidePagedEnd(){
    pagedActive=false;
    const end=page();
    end?.classList.add("hidden");
    end?.classList.remove("active");
  }

  function showPagedEnd(){
    if(!document.body.classList.contains("reader-flow-paginated"))return;
    const end=page();if(!end)return;
    pagedActive=true;
    end.classList.remove("hidden");
    end.classList.add("active");
    requestAnimationFrame(()=>end.querySelector("a:not(.hidden)")?.focus?.({preventScroll:true}));
  }

  function ensureContinuousEnd(){
    if(!document.body.classList.contains("reader-flow-scrolled")||!canonicalEnd()){
      removeContinuousEnd();
      return;
    }
    const master=page(),container=scroller();
    if(!master||!container)return;
    const previous=continuousClone();
    const end=master.cloneNode(true);
    stripIds(end);
    end.classList.remove("hidden","active");
    end.classList.add("continuous-end","volume-end-page-continuous");
    if(previous)previous.replaceWith(end);
    else container.appendChild(end);
  }

  function syncFlow(){
    const end=page();if(!end)return;
    if(document.body.classList.contains("reader-flow-scrolled")){
      pagedActive=false;
      end.classList.add("hidden");
      end.classList.remove("active");
      ensureContinuousEnd();
    }else{
      removeContinuousEnd();
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
    const text=$("#progressText"),master=page();
    if(text)new MutationObserver(()=>ensureContinuousEnd()).observe(text,{childList:true,characterData:true,subtree:true});
    if(master)new MutationObserver(()=>{if(document.body.classList.contains("reader-flow-scrolled")&&canonicalEnd())ensureContinuousEnd()}).observe(master,{childList:true,characterData:true,subtree:true,attributes:true});
    new MutationObserver(syncFlow).observe(document.body,{attributes:true,attributeFilter:["class"]});
    const viewer=$("#viewer");
    if(viewer)new MutationObserver(()=>{if(document.body.classList.contains("reader-flow-scrolled")&&canonicalEnd())ensureContinuousEnd()}).observe(viewer,{childList:true,subtree:true});
    syncFlow();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
