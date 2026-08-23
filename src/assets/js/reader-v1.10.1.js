/* Shadow Garden v1.10.2 — flow-dependent Reader settings visibility. */
(()=>{
  const setting=document.getElementById("textWidthSetting");
  const flow=document.getElementById("flowSelect");
  if(!setting||!flow)return;

  function sync(){
    setting.hidden=flow.value!=="scrolled-doc";
  }

  flow.addEventListener("change",()=>requestAnimationFrame(sync));
  document.getElementById("resetReader")?.addEventListener("click",()=>setTimeout(sync,0));
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:["class"]});
  sync();
})();
