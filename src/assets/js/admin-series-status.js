/* Shadow Garden v1.10.4 — canonical Series Status controls. */
(()=>{
  const STATUSES=["Complete","Ongoing","Hiatus","Dropped"];
  const aliases=new Map([
    ["complete","Complete"],["completed","Complete"],["finished","Complete"],
    ["ongoing","Ongoing"],["publishing","Ongoing"],["active","Ongoing"],["current","Ongoing"],
    ["hiatus","Hiatus"],["on hiatus","Hiatus"],["paused","Hiatus"],
    ["dropped","Dropped"],["cancelled","Dropped"],["canceled","Dropped"],["discontinued","Dropped"]
  ]);
  const normalize=value=>aliases.get(String(value||"").trim().toLowerCase())||"Ongoing";
  const slug=value=>String(value||"untitled").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"untitled";
  const arr=value=>Array.isArray(value)?value:[];

  function installStatusSelect(){
    const current=document.getElementById("manageStatus");
    if(!current)return null;
    if(current.tagName==="SELECT")return current;
    const select=document.createElement("select");
    select.id="manageStatus";
    select.name=current.name||"series-status";
    select.setAttribute("aria-label","Series status");
    select.innerHTML=STATUSES.map(status=>`<option value="${status}">${status}</option>`).join("");
    select.value=normalize(current.value);
    current.replaceWith(select);
    return select;
  }

  function canonicalizeEditor(){
    const select=installStatusSelect();
    if(!select)return;
    const canonical=normalize(select.value);
    if(select.value!==canonical)select.value=canonical;
  }

  installStatusSelect();
  const dialog=document.getElementById("seriesEditor");
  if(dialog){
    new MutationObserver(()=>{if(dialog.open)canonicalizeEditor()}).observe(dialog,{attributes:true,attributeFilter:["open"]});
  }

  /* Existing legacy/free-text values are normalized before the Series Editor's normal
     click handler reads them. The private catalog itself is updated only when Save is used. */
  document.addEventListener("click",event=>{
    const button=event.target?.closest?.("[data-manager-open]");
    if(!button)return;
    try{
      const id=button.dataset.managerOpen;
      const library=state?.management;
      for(const series of [...arr(library?.main),...arr(library?.adult)])if(series?.id===id)series.status=normalize(series.status);
    }catch{}
  },true);

  /* New series are born Ongoing. Do not overwrite the status of an existing series when
     another volume is uploaded into it. */
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    let url="";
    try{url=new URL(typeof input==="string"?input:input?.url||"",location.href).pathname}catch{}
    const method=String(init?.method||(typeof input!=="string"?input?.method:"")||"GET").toUpperCase();
    if(url==="/admin-api/catalog"&&method==="POST"&&typeof init?.body==="string"){
      try{
        const payload=JSON.parse(init.body);
        const library=state?.batch?.library;
        const shelf=payload.adult?arr(library?.adult):arr(library?.main);
        const sid=`${payload.adult?"adult-":""}${slug(payload.series)}`;
        const existing=Boolean(payload.targetSeriesId)||shelf.some(series=>series?.id===sid||slug(series?.title)===slug(payload.series));
        if(!existing)payload.status="Ongoing";
        else if(payload.status)payload.status=normalize(payload.status);
        init={...init,body:JSON.stringify(payload)};
      }catch(error){console.warn("Series status default skipped",error)}
    }
    return nativeFetch(input,init);
  };

  window.ShadowGardenSeriesStatus={values:[...STATUSES],normalize};
})();
