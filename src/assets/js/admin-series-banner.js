/* Shadow Garden v1.9.4 — stable volume-cover banner selection in Manage Series. */
(()=>{
  const dialog=document.getElementById("seriesEditor");
  const description=document.getElementById("manageDescription");
  const tokenInput=document.getElementById("adminToken");
  if(!dialog||!description||!tokenInput)return;

  const nativeFetch=window.fetch.bind(window);
  let activeId="";
  let loadingSerial=0;
  let choices=[];

  const authHeaders=extra=>{
    const headers=new Headers(extra||{});
    const token=tokenInput.value.trim();
    if(token)headers.set("authorization",`Bearer ${token}`);
    return headers;
  };

  function ensureUi(){
    let field=document.getElementById("manageBannerField");
    if(field)return field;
    field=document.createElement("label");
    field.id="manageBannerField";
    field.className="admin-field wide manage-banner-field";
    field.innerHTML=`
      <span>Series banner</span>
      <select id="manageBanner" aria-describedby="manageBannerState"><option value="">Loading volume covers…</option></select>
      <div class="manage-banner-preview">
        <img id="manageBannerPreview" class="hidden" alt="Selected banner cover preview">
        <div class="manage-banner-preview-copy"><strong id="manageBannerPreviewTitle">Default banner</strong><small id="manageBannerState" class="manage-banner-state">Defaults to the first volume cover. Changes save immediately.</small></div>
      </div>`;
    description.closest("label")?.before(field);
    field.querySelector("#manageBanner")?.addEventListener("change",()=>void saveSelection());
    return field;
  }

  const field=ensureUi();
  const select=field?.querySelector("#manageBanner");
  const preview=field?.querySelector("#manageBannerPreview");
  const previewTitle=field?.querySelector("#manageBannerPreviewTitle");
  const stateText=field?.querySelector("#manageBannerState");
  if(!select||!preview||!previewTitle||!stateText)return;

  function setState(message,kind=""){
    stateText.textContent=message;
    if(kind)stateText.dataset.kind=kind;else delete stateText.dataset.kind;
  }

  function optionLabel(choice){
    const number=String(choice?.number??"").trim();
    const prefix=number?`Volume ${number}`:"Volume";
    return `${prefix} — ${String(choice?.title||"Untitled")}`;
  }

  function selectedChoice(){
    const value=select.value;
    if(value)return choices.find(choice=>choice.bookId===value)||null;
    return choices[0]||null;
  }

  function syncPreview(){
    const choice=selectedChoice();
    const custom=Boolean(select.value);
    previewTitle.textContent=choice?(custom?optionLabel(choice):`Default — ${optionLabel(choice)}`):"No volume cover available";
    if(choice?.cover){
      preview.src=choice.cover;
      preview.classList.remove("hidden");
    }else{
      preview.removeAttribute("src");
      preview.classList.add("hidden");
    }
  }

  async function request(path,options={}){
    const response=await nativeFetch(path,{...options,headers:authHeaders(options.headers),cache:"no-store"});
    let data={};
    try{data=await response.json()}catch{}
    if(!response.ok)throw new Error(data.detail||data.error||`Request failed (${response.status})`);
    return data;
  }

  async function loadChoices(id=activeId){
    if(!id||!dialog.open)return;
    const serial=++loadingSerial;
    select.disabled=true;
    select.innerHTML='<option value="">Loading volume covers…</option>';
    setState("Loading banner choices…","saving");
    try{
      const data=await request(`/admin-api/series-banner?id=${encodeURIComponent(id)}`);
      if(serial!==loadingSerial)return;
      activeId=data.id||id;
      choices=Array.isArray(data.choices)?data.choices:[];
      select.replaceChildren();
      const defaultOption=document.createElement("option");
      defaultOption.value="";
      defaultOption.textContent=choices[0]?`Default — ${optionLabel(choices[0])}`:"Default — first volume cover";
      select.appendChild(defaultOption);
      for(const choice of choices){
        const option=document.createElement("option");
        option.value=choice.bookId;
        option.textContent=optionLabel(choice);
        select.appendChild(option);
      }
      select.value=choices.some(choice=>choice.bookId===data.current)?data.current:"";
      select.dataset.savedValue=select.value;
      select.disabled=choices.length===0;
      syncPreview();
      setState(choices.length?"Defaults to Volume 1. Select another volume to save it as the banner.":"This series has no volume cover available.");
    }catch(error){
      if(serial!==loadingSerial)return;
      select.disabled=true;
      select.innerHTML='<option value="">Banner choices unavailable</option>';
      setState(error.message,"error");
    }
  }

  async function saveSelection(){
    if(!activeId)return;
    const next=select.value;
    const previous=select.dataset.savedValue||"";
    syncPreview();
    select.disabled=true;
    setState("Saving banner selection…","saving");
    try{
      const data=await request("/admin-api/series-banner",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({id:activeId,bannerBookId:next})
      });
      activeId=data.id||activeId;
      select.dataset.savedValue=next;
      setState(next?"Banner saved. This volume cover will be used on the Series page.":"Default restored. The first volume cover will be used.","saved");
    }catch(error){
      select.value=previous;
      syncPreview();
      setState(error.message,"error");
    }finally{
      select.disabled=choices.length===0;
    }
  }

  document.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-manager-open]");
    if(!button)return;
    activeId=button.dataset.managerOpen||"";
    window.setTimeout(()=>void loadChoices(activeId),0);
  },true);

  new MutationObserver(()=>{
    if(dialog.open&&activeId)void loadChoices(activeId);
  }).observe(dialog,{attributes:true,attributeFilter:["open"]});

  /* Observe series-id changes when the standard editor moves a series between shelves.
     The underlying response is returned untouched; this only keeps the banner controller's
     local target in sync with Garden Keeper's canonical changedId. */
  window.fetch=async(input,init)=>{
    const response=await nativeFetch(input,init);
    try{
      const url=new URL(input instanceof Request?input.url:String(input||""),location.href);
      const method=String(init?.method||(input instanceof Request?input.method:"GET")||"GET").toUpperCase();
      if(url.origin===location.origin&&url.pathname==="/admin-api/library"&&method==="POST"&&typeof init?.body==="string"){
        const body=JSON.parse(init.body);
        if(body?.action==="update-series"&&response.ok){
          const data=await response.clone().json();
          if(data?.changedId){activeId=data.changedId;window.setTimeout(()=>void loadChoices(activeId),0)}
        }
      }
    }catch{}
    return response;
  };
})();
