/* Shadow Garden v2.9 — safe bulk cover + banner replacement workflow. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,arr,esc,slug,hash8,optimizedCoverSet}=keeper.util,{state}=keeper,client=keeper.client;
  const MAX_IMAGE_BYTES=25*1024*1024;

  keeper.registerWorkflow("bulkArtwork",()=>{
    const list=$("#seriesManagerList"),toolbar=$(".manage-toolbar");if(!list||!toolbar)return{};
    let dialog=null,openButton=null,saving=false,activeRows=[];
    const previewUrls=new Map();

    function installStyle(){
      if(document.querySelector('link[href="/assets/css/admin-bulk-artwork.css"]'))return;
      const link=document.createElement("link");link.rel="stylesheet";link.href="/assets/css/admin-bulk-artwork.css";document.head.appendChild(link);
    }
    function managementEntries(){
      if(!state.management)return[];
      return[
        ...arr(state.management.main).map(series=>({series,scope:"main"})),
        ...arr(state.management.adult).map(series=>({series,scope:"adult"}))
      ];
    }
    function selectionIds(){return arr(keeper.workflows.get("bulkEdit")?.instance?.selectedIds)}
    function selectedEntries(){
      const byId=new Map(managementEntries().map(entry=>[entry.series.id,entry]));
      return selectionIds().map(id=>byId.get(id)).filter(Boolean);
    }
    function currentCover(series){return series?.coverThumb||series?.cover||arr(series?.volumes).find(volume=>volume?.coverThumb)?.coverThumb||arr(series?.volumes).find(volume=>volume?.cover)?.cover||""}
    function bannerLabel(choice){const number=String(choice?.number??"").trim();return`${number?`Volume ${number}`:"Volume"} — ${String(choice?.title||"Untitled")}`}
    function clearPreviewUrl(id){const url=previewUrls.get(id);if(url){URL.revokeObjectURL(url);previewUrls.delete(id)}}
    function clearPreviewUrls(){for(const id of [...previewUrls.keys()])clearPreviewUrl(id)}

    function installButton(){
      if($("#openBulkArtwork")){openButton=$("#openBulkArtwork");return}
      openButton=document.createElement("button");openButton.id="openBulkArtwork";openButton.className="admin-secondary compact-button";openButton.type="button";openButton.disabled=true;openButton.textContent="Batch artwork";
      const metadataButton=$("#openBulkSeriesEdit");if(metadataButton)metadataButton.after(openButton);else $("#refreshLibrary")?.before(openButton);
      openButton.addEventListener("click",()=>void openEditor());
    }

    function installDialog(){
      if($("#bulkArtworkEditor")){dialog=$("#bulkArtworkEditor");return}
      dialog=document.createElement("dialog");dialog.id="bulkArtworkEditor";dialog.className="admin-dialog keeper-dialog bulk-artwork-editor";
      dialog.innerHTML=`<div class="dialog-shell">
        <div class="dialog-head"><div><p class="kicker">BATCH ARTWORK</p><h2>Replace covers & banners</h2></div><button id="closeBulkArtwork" class="dialog-close" type="button" aria-label="Close batch artwork editor" data-artwork-control>×</button></div>
        <div class="dialog-scroll">
          <div class="bulk-artwork-lead"><strong id="bulkArtworkCount">0 series selected</strong><p>Choose an optional replacement cover and/or banner setting for each series. New image derivatives upload first; live catalog references change together only after server validation and a safety snapshot.</p></div>
          <div id="bulkArtworkValidation" class="bulk-artwork-validation" role="status">Loading artwork choices…</div>
          <div id="bulkArtworkRows" class="bulk-artwork-rows"></div>
          <section class="bulk-artwork-preview-section" aria-labelledby="bulkArtworkPreviewHeading"><div class="bulk-artwork-preview-head"><div><span>PREVIEW</span><h3 id="bulkArtworkPreviewHeading">Staged artwork changes</h3></div><strong id="bulkArtworkChangedCount">0 series changing</strong></div><div id="bulkArtworkPreview" class="bulk-artwork-preview"><div class="bulk-artwork-empty">No artwork changes are currently staged.</div></div></section>
          <div id="bulkArtworkProgress" class="bulk-artwork-progress hidden" role="status" aria-live="polite"></div>
        </div>
        <div class="dialog-actions"><button id="cancelBulkArtwork" class="admin-secondary" type="button" data-artwork-control>Cancel</button><button id="saveBulkArtwork" class="admin-primary inline-button" type="button" data-artwork-control disabled>Apply artwork changes</button></div>
      </div>`;
      document.body.appendChild(dialog);
      dialog.addEventListener("click",event=>{if(event.target===dialog&&!saving)closeEditor()});
      $("#closeBulkArtwork")?.addEventListener("click",()=>{if(!saving)closeEditor()});
      $("#cancelBulkArtwork")?.addEventListener("click",()=>{if(!saving)closeEditor()});
      $("#saveBulkArtwork")?.addEventListener("click",()=>void save());
      $("#bulkArtworkRows")?.addEventListener("change",event=>{
        const row=event.target.closest("[data-artwork-series]");if(!row)return;
        if(event.target.matches("[data-artwork-file]"))syncFilePreview(row);
        renderPreview();
      });
    }

    function syncButton(){
      const count=selectionIds().length;if(!openButton)return;
      openButton.disabled=saving||count<1;openButton.textContent=count?`Batch artwork (${count})`:"Batch artwork";
    }

    async function bannerData(entry){
      try{return{ok:true,...await client.request(`/admin-api/series-banner?id=${encodeURIComponent(entry.series.id)}`)}}
      catch(error){return{ok:false,id:entry.series.id,current:"",choices:[],error:error.message}}
    }

    function rowHtml(item){
      const {entry,banner}=item,series=entry.series,cover=currentCover(series),choices=arr(banner.choices),currentChoice=choices.find(choice=>choice.bookId===banner.current),currentBanner=banner.current&&currentChoice?bannerLabel(currentChoice):"Random — any volume cover";
      const targetOptions=[`<option value="series">Series cover</option>`,...arr(series.volumes).map((volume,index)=>volume?.file?`<option value="volume:${index}">${esc(`Volume ${volume.number??index+1} — ${volume.title||`Volume ${index+1}`}`)}</option>`:"").filter(Boolean)].join("");
      const bannerOptions=banner.ok?[`<option value="__keep__">Keep current — ${esc(currentBanner)}</option>`,`<option value="__random__">Random — any volume cover</option>`,...choices.map(choice=>`<option value="book:${esc(choice.bookId)}">${esc(bannerLabel(choice))}</option>`)].join(""):`<option value="__keep__">Keep current banner</option>`;
      return `<article class="bulk-artwork-row" data-artwork-series="${esc(series.id)}">
        <div class="bulk-artwork-row-head"><div class="bulk-artwork-cover">${cover?`<img data-artwork-preview-image src="${esc(cover)}" alt="${esc(series.title||"Series")} cover preview">`:'<span data-artwork-preview-fallback>✦</span>'}</div><div class="bulk-artwork-row-copy"><strong>${esc(series.title||"Untitled")}</strong><span>${entry.scope==="adult"?"18+ Library":"Main Library"} · ${arr(series.volumes).length} ${arr(series.volumes).length===1?"volume":"volumes"}</span></div></div>
        <div class="admin-grid bulk-artwork-fields">
          <label class="admin-field"><span>Cover target</span><select data-artwork-target data-artwork-control>${targetOptions}</select></label>
          <label class="admin-field wide"><span>Replacement image</span><input data-artwork-file data-artwork-control type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif"><small class="field-note">Optional · JPG, PNG, WebP, AVIF, or GIF · up to 25 MB. Shadow Garden writes optimized detail + thumbnail derivatives.</small></label>
          <label class="admin-field wide"><span>Series banner</span><select data-artwork-banner data-artwork-control ${banner.ok?"":"disabled"}>${bannerOptions}</select><small class="field-note">${banner.ok?"Keep the current banner, restore random rotation, or pin one current volume cover.":`Banner choices unavailable: ${esc(banner.error||"Unknown error")}`}</small></label>
        </div>
      </article>`;
    }

    function syncFilePreview(row){
      const id=row.dataset.artworkSeries,file=row.querySelector("[data-artwork-file]")?.files?.[0]||null,image=row.querySelector("[data-artwork-preview-image]"),fallback=row.querySelector("[data-artwork-preview-fallback]");
      clearPreviewUrl(id);if(!file)return;
      const url=URL.createObjectURL(file);previewUrls.set(id,url);
      if(image){image.src=url;image.classList.remove("hidden")}else{
        const next=document.createElement("img");next.dataset.artworkPreviewImage="";next.src=url;next.alt="Replacement cover preview";row.querySelector(".bulk-artwork-cover")?.replaceChildren(next);
      }
      fallback?.classList.add("hidden");
    }

    function rowPlan(row){
      const id=row.dataset.artworkSeries,item=activeRows.find(candidate=>candidate.entry.series.id===id);if(!item)return null;
      const file=row.querySelector("[data-artwork-file]")?.files?.[0]||null,targetValue=row.querySelector("[data-artwork-target]")?.value||"series",bannerValue=row.querySelector("[data-artwork-banner]")?.value||"__keep__";
      let coverTarget="series",volume=null;
      if(targetValue.startsWith("volume:")){const index=Number(targetValue.slice(7));volume=arr(item.entry.series.volumes)[index]||null;coverTarget="volume"}
      const errors=[];
      if(file){
        const type=String(file.type||"").toLowerCase(),name=String(file.name||"");
        if(!type.startsWith("image/")&&!/\.(?:jpe?g|png|webp|avif|gif)$/i.test(name))errors.push(`${item.entry.series.title}: choose a supported image file.`);
        if(file.size>MAX_IMAGE_BYTES)errors.push(`${item.entry.series.title}: replacement image exceeds 25 MB.`);
        if(coverTarget==="volume"&&!volume?.file)errors.push(`${item.entry.series.title}: the selected volume is no longer available.`);
      }
      const bannerChanged=bannerValue!=="__keep__",coverChanged=Boolean(file);
      return{...item,row,file,coverTarget,volume,bannerValue,bannerChanged,coverChanged,changed:coverChanged||bannerChanged,errors};
    }

    function plans(){return[...$("#bulkArtworkRows").querySelectorAll("[data-artwork-series]")].map(rowPlan).filter(Boolean)}
    function bannerPreview(plan){
      if(!plan.bannerChanged)return"";
      if(plan.bannerValue==="__random__")return"Random — any volume cover";
      const id=plan.bannerValue.startsWith("book:")?plan.bannerValue.slice(5):"",choice=arr(plan.banner.choices).find(item=>item.bookId===id);
      return choice?bannerLabel(choice):"Selected volume cover";
    }

    function renderPreview(){
      if(!dialog?.open)return;
      const items=plans(),changed=items.filter(item=>item.changed),errors=items.flatMap(item=>item.errors),validation=$("#bulkArtworkValidation"),save=$("#saveBulkArtwork");
      $("#bulkArtworkChangedCount").textContent=`${changed.length} ${changed.length===1?"series":"series"} changing`;
      validation.className=`bulk-artwork-validation${errors.length?" error":""}`;validation.textContent=errors[0]||"Only staged cover/banner references will change. Every selected series is revalidated by the server before one safety snapshot and catalog commit.";
      $("#bulkArtworkPreview").innerHTML=changed.length?changed.map(item=>{
        const lines=[];
        if(item.coverChanged)lines.push(`<span><b>Cover</b>${esc(item.coverTarget==="volume"?`Volume ${item.volume?.number??"?"} — ${item.volume?.title||"Volume"}`:"Series cover")} → ${esc(item.file.name)}</span>`);
        if(item.bannerChanged)lines.push(`<span><b>Banner</b>${esc(item.banner.current?"Pinned volume":"Random")} → ${esc(bannerPreview(item))}</span>`);
        return `<article class="bulk-artwork-preview-item"><strong>${esc(item.entry.series.title||"Untitled")}</strong>${lines.join("")}</article>`;
      }).join(""):'<div class="bulk-artwork-empty">No artwork changes are currently staged.</div>';
      save.disabled=saving||Boolean(errors.length)||!changed.length;
    }

    function setBusy(value){
      saving=value;
      for(const control of dialog?.querySelectorAll("[data-artwork-control]")||[])control.disabled=value;
      if(!value){for(const item of activeRows){const select=dialog?.querySelector(`[data-artwork-series="${CSS.escape(item.entry.series.id)}"] [data-artwork-banner]`);if(select&&!item.banner.ok)select.disabled=true}}
      const save=$("#saveBulkArtwork");if(save)save.textContent=value?"Applying…":"Apply artwork changes";
      syncButton();
    }

    async function uploadReplacement(plan,index,total){
      const progress=$("#bulkArtworkProgress");progress.textContent=`Preparing cover ${index+1} of ${total}: ${plan.entry.series.title||"Untitled"}`;
      const variants=await optimizedCoverSet(plan.file);
      if(!variants?.thumb||variants.detail?.type!=="image/webp"||variants.thumb?.type!=="image/webp")throw new Error(`Could not create optimized WebP cover derivatives for ${plan.entry.series.title||"this series"}.`);
      const hash=await hash8(plan.file),targetPart=plan.coverTarget==="volume"?`volume-${String(plan.volume?.number??"x").replace(/[^0-9a-z.-]+/gi,"-")}`:"series",root=`shadow-garden/covers/${slug(plan.entry.series.id)}-${targetPart}-${hash}-bulk-artwork`,coverKey=`${root}-detail.webp`,coverThumbKey=`${root}-thumb.webp`;
      progress.textContent=`Uploading cover ${index+1} of ${total}: ${plan.entry.series.title||"Untitled"}`;
      await client.uploadObject(coverKey,variants.detail,"image/webp");await client.uploadObject(coverThumbKey,variants.thumb,"image/webp");
      return{coverKey,coverThumbKey};
    }

    async function save(){
      if(saving)return;setBusy(true);
      const progress=$("#bulkArtworkProgress");progress.classList.remove("hidden");
      try{
        const current=plans(),errors=current.flatMap(item=>item.errors),changed=current.filter(item=>item.changed);if(errors.length)throw new Error(errors[0]);if(!changed.length)return;
        const coverPlans=changed.filter(item=>item.coverChanged),uploaded=new Map();
        for(let index=0;index<coverPlans.length;index++)uploaded.set(coverPlans[index].entry.series.id,await uploadReplacement(coverPlans[index],index,coverPlans.length));
        const updates=changed.map(item=>{
          const update={seriesId:item.entry.series.id,scope:item.entry.scope},cover=uploaded.get(item.entry.series.id);
          if(cover){update.coverTarget=item.coverTarget;update.coverKey=cover.coverKey;update.coverThumbKey=cover.coverThumbKey;if(item.coverTarget==="volume")update.volumeFile=item.volume.file}
          if(item.bannerChanged)update.bannerBookId=item.bannerValue==="__random__"?"":item.bannerValue.replace(/^book:/,"");
          return update;
        });
        progress.textContent=`Validating and committing artwork for ${changed.length} series…`;
        const result=await client.request("/admin-api/artwork",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({updates})});
        state.management=null;keeper.events.dispatchEvent(new Event("history:changed"));keeper.events.dispatchEvent(new Event("library:invalidate"));closeEditor();keeper.ui.toast(`Updated artwork for ${result.updatedArtwork?.series||changed.length} series.`);
      }catch(error){
        progress.textContent=`Artwork update stopped: ${error.message}`;alert(`Batch artwork update stopped. Live catalog references were not changed unless the final catalog commit completed.\n\n${error.message}`);
      }finally{setBusy(false);if(dialog.open)renderPreview()}
    }

    async function openEditor(){
      if(saving)return;const entries=selectedEntries();if(!entries.length)return;
      activeRows=[];clearPreviewUrls();$("#bulkArtworkRows").innerHTML='<div class="bulk-artwork-empty">Loading current banner choices…</div>';$("#bulkArtworkCount").textContent=`${entries.length} ${entries.length===1?"series":"series"} selected`;$("#bulkArtworkValidation").textContent="Loading artwork choices…";$("#bulkArtworkProgress").classList.add("hidden");$("#bulkArtworkProgress").textContent="";if(!dialog.open)dialog.showModal();
      const banners=await Promise.all(entries.map(bannerData));if(!dialog.open)return;
      activeRows=entries.map((entry,index)=>({entry,banner:banners[index]}));$("#bulkArtworkRows").innerHTML=activeRows.map(rowHtml).join("");renderPreview();
    }
    function closeEditor(){if(saving||!dialog)return;clearPreviewUrls();activeRows=[];if(dialog.open)dialog.close()}

    installStyle();installButton();installDialog();syncButton();
    list.addEventListener("change",event=>{if(event.target.closest("[data-bulk-series-select]"))queueMicrotask(syncButton)});
    new MutationObserver(()=>queueMicrotask(syncButton)).observe(list,{childList:true,subtree:true});
    keeper.events.addEventListener("library:changed",syncButton);
    keeper.events.addEventListener("session:locked",()=>{clearPreviewUrls();activeRows=[];if(dialog?.open&&!saving)dialog.close();syncButton()});
    return{open:openEditor};
  });
})();
