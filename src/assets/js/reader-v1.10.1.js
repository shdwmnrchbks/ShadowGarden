/* Shadow Garden v1.10.1 — flow-dependent Reader settings visibility. */
(()=>{
  const setting=document.getElementById("textWidthSetting");
  const flow=document.getElementById("flowSelect");
  if(!setting||!flow)return;

  function sync(){
    const paginated=document.body.classList.contains("reader-flow-paginated")||flow.value==="paginated";
    const scrolled=document.body.classList.contains("reader-flow-scrolled")||flow.value==="scrolled-doc";
    setting.hidden=paginated&&!scrolled;
  }

  flow.addEventListener("change",()=>requestAnimationFrame(sync));
  document.getElementById("resetReader")?.addEventListener("click",()=>setTimeout(sync,0));
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:["class"]});
  sync();
})();
