/* Shadow Garden v0.14.1 — collapsible library filter panel. */
(()=>{
  const scope=document.body.dataset.libraryScope||"main";
  const storageKey=`sg-filters-collapsed:${scope}`;
  const panel=document.querySelector(".filters");
  const toggle=document.getElementById("filterToggle");
  if(!panel||!toggle)return;

  let collapsed=false;
  try{collapsed=localStorage.getItem(storageKey)==="1"}catch{}

  function apply(){
    panel.classList.toggle("filters-collapsed",collapsed);
    toggle.setAttribute("aria-expanded",collapsed?"false":"true");
    toggle.setAttribute("aria-label",collapsed?"Expand filters":"Collapse filters");
    toggle.title=collapsed?"Expand filters":"Collapse filters";
    toggle.textContent=collapsed?"⌄":"⌃";
  }

  toggle.addEventListener("click",()=>{
    collapsed=!collapsed;
    try{localStorage.setItem(storageKey,collapsed?"1":"0")}catch{}
    apply();
  });

  apply();
})();
