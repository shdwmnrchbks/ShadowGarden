/* Shadow Garden v1.5.2 — mobile-only Library Filter collapse control. */
(()=>{
  const panel=document.querySelector(".filters");
  const toggle=document.getElementById("filterToggle");
  if(!panel||!toggle)return;

  const scope=document.body.dataset.libraryScope||"main";
  const storageKey=`sg-mobile-filters-collapsed:${scope}`;
  const mobileQuery=window.matchMedia("(max-width: 720px)");

  function readCollapsed(){
    try{
      const saved=localStorage.getItem(storageKey);
      return saved===null?true:saved!=="0";
    }catch{return true}
  }

  function writeCollapsed(collapsed){
    try{localStorage.setItem(storageKey,collapsed?"1":"0")}catch{}
  }

  function syncToggle(collapsed){
    toggle.hidden=false;
    toggle.setAttribute("aria-expanded",collapsed?"false":"true");
    toggle.setAttribute("aria-label",collapsed?"Expand library filters":"Collapse library filters");
    toggle.title=collapsed?"Expand filters":"Collapse filters";
    toggle.textContent=collapsed?"⌄":"⌃";
  }

  function apply(){
    if(!mobileQuery.matches){
      panel.classList.remove("filters-collapsed");
      toggle.hidden=true;
      toggle.setAttribute("aria-expanded","true");
      return;
    }
    const collapsed=readCollapsed();
    panel.classList.toggle("filters-collapsed",collapsed);
    syncToggle(collapsed);
  }

  toggle.addEventListener("click",()=>{
    if(!mobileQuery.matches)return;
    const collapsed=!panel.classList.contains("filters-collapsed");
    panel.classList.toggle("filters-collapsed",collapsed);
    writeCollapsed(collapsed);
    syncToggle(collapsed);
  });

  if(typeof mobileQuery.addEventListener==="function")mobileQuery.addEventListener("change",apply);
  else mobileQuery.addListener?.(apply);

  apply();
})();
