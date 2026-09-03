/* Shadow Garden v2.9 — safe existing-series bulk metadata editing. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,arr,esc,normalizeSeriesStatus}=keeper.util,{state}=keeper,client=keeper.client;
  const taxonomyPromise=import("/assets/js/domain/catalog-taxonomy.js");

  keeper.registerWorkflow("bulkEdit",()=>{
    const list=$("#seriesManagerList"),toolbar=$(".manage-toolbar");
    if(!list||!toolbar)return{};

    const selected=new Set();
    let saving=false;
    let dialog=null;
    let openButton=null;

    function installStyle(){
      if(document.querySelector('link[href="/assets/css/admin-bulk-edit.css"]'))return;
      const link=document.createElement("link");
      link.rel="stylesheet";link.href="/assets/css/admin-bulk-edit.css";document.head.appendChild(link);
    }

    function entries(){
      if(!state.management)return[];
      return[
        ...arr(state.management.main).map(series=>({series,scope:"main"})),
        ...arr(state.management.adult).map(series=>({series,scope:"adult"}))
      ];
    }
    function entryById(id){return entries().find(item=>item.series.id===id)||null}
    function selectedEntries(){return[...selected].map(entryById).filter(Boolean)}
    function normalizeText(value){return String(value??"").trim().toLowerCase().replace(/\s+/g," ")}
    function unique(values){
      const out=[],seen=new Set();
      for(const value of arr(values)){const clean=String(value??"").trim(),key=normalizeText(clean);if(!key||seen.has(key))continue;seen.add(key);out.push(clean)}
      return out;
    }
    function splitList(value){return unique(String(value||"").split(",").map(item=>item.trim()).filter(Boolean))}
    function credits(value){return arr(value).map(item=>({name:String(item?.name||"").trim(),url:String(item?.url||"").trim(),coverage:String(item?.coverage||"").trim()})).filter(item=>item.name)}
    function creditKey(item){return[normalizeText(item.name),normalizeText(item.url),normalizeText(item.coverage)].join("\n")}
    function appendCredit(existing,credit){
      const next=credits(existing),key=creditKey(credit);
      if(!next.some(item=>creditKey(item)===key))next.push(credit);
      return next;
    }

    function installButton(){
      if($("#openBulkSeriesEdit")){openButton=$("#openBulkSeriesEdit");return}
      openButton=document.createElement("button");
      openButton.id="openBulkSeriesEdit";openButton.className="admin-secondary compact-button";openButton.type="button";openButton.disabled=true;openButton.textContent="Batch edit";
      $("#refreshLibrary")?.before(openButton);
      openButton.addEventListener("click",openEditor);
    }

    function installDialog(){
      if($("#bulkSeriesEditor")){dialog=$("#bulkSeriesEditor");return}
      dialog=document.createElement("dialog");
      dialog.id="bulkSeriesEditor";dialog.className="admin-dialog keeper-dialog bulk-series-editor";
      dialog.innerHTML=`<div class="dialog-shell">
        <div class="dialog-head"><div><p class="kicker">BATCH EDIT</p><h2>Shape selected series</h2></div><button id="closeBulkSeriesEdit" class="dialog-close" type="button" aria-label="Close batch editor" data-bulk-editor-control>×</button></div>
        <div class="dialog-scroll">
          <div class="bulk-series-lead"><strong id="bulkSeriesCount">0 series selected</strong><p>Only fields you explicitly change below are applied. Every affected series is previewed before save, and a catalog backup is created first.</p></div>
          <section class="bulk-edit-section">
            <div class="bulk-edit-section-head"><span>TAXONOMY</span><h3>Genres & tags</h3></div>
            <div class="admin-grid">
              <label class="admin-field"><span>Genres action</span><select id="bulkGenresMode" data-bulk-editor-control><option value="keep">Keep existing</option><option value="add">Add genres</option><option value="replace">Replace genres</option></select></label>
              <label class="admin-field wide"><span>Genres</span><input id="bulkGenresInput" data-bulk-editor-control type="text" placeholder="Fantasy, Romance"></label>
              <label class="admin-field"><span>Tags action</span><select id="bulkTagsMode" data-bulk-editor-control><option value="keep">Keep existing</option><option value="add">Add tags</option><option value="replace">Replace tags</option></select></label>
              <label class="admin-field wide"><span>Tags</span><input id="bulkTagsInput" data-bulk-editor-control type="text" placeholder="Academy, Reincarnation"></label>
            </div>
          </section>
          <section class="bulk-edit-section">
            <div class="bulk-edit-section-head"><span>STATUS</span><h3>Publication & translation state</h3></div>
            <div class="admin-grid">
              <label class="admin-field"><span>Series status</span><select id="bulkSeriesStatus" data-bulk-editor-control><option value="__keep__">Keep existing</option><option>Complete</option><option>Ongoing</option><option>Hiatus</option><option>Dropped</option></select></label>
              <label class="admin-field"><span>Translation status</span><select id="bulkTranslationStatus" data-bulk-editor-control><option value="__keep__">Keep existing</option><option value="__clear__">Clear status</option><option>Complete</option><option>Ongoing</option><option>Stalled</option><option>Partial</option></select></label>
            </div>
          </section>
          <section class="bulk-edit-section">
            <div class="bulk-edit-section-head"><span>CREDIT</span><h3>Translation provenance</h3></div>
            <div class="admin-grid">
              <label class="admin-field"><span>Credits action</span><select id="bulkCreditMode" data-bulk-editor-control><option value="keep">Keep existing</option><option value="append">Append one credit</option><option value="replace">Replace with one credit</option><option value="clear">Clear credits</option></select></label>
              <label class="admin-field wide"><span>Translator</span><input id="bulkTranslatorName" data-bulk-editor-control type="text" placeholder="Translator name"></label>
              <label class="admin-field wide"><span>Source URL</span><input id="bulkTranslatorUrl" data-bulk-editor-control type="url" inputmode="url" placeholder="https://translator.example/"></label>
              <label class="admin-field wide"><span>Coverage</span><input id="bulkTranslatorCoverage" data-bulk-editor-control type="text" placeholder="Chapters 1–627 or Volumes 1–4"></label>
            </div>
          </section>
          <div id="bulkSeriesValidation" class="bulk-edit-validation" role="status"></div>
          <section class="bulk-edit-preview-section" aria-labelledby="bulkPreviewHeading"><div class="bulk-edit-preview-head"><div><span>PREVIEW</span><h3 id="bulkPreviewHeading">Metadata changes</h3></div><strong id="bulkChangedCount">0 changes</strong></div><div id="bulkSeriesPreview" class="bulk-edit-preview"></div></section>
          <div id="bulkSeriesProgress" class="bulk-edit-progress hidden" role="status" aria-live="polite"></div>
        </div>
        <div class="dialog-actions"><button id="cancelBulkSeriesEdit" class="admin-secondary" type="button" data-bulk-editor-control>Cancel</button><button id="saveBulkSeriesEdit" class="admin-primary inline-button" type="button" data-bulk-editor-control disabled>Apply batch changes</button></div>
      </div>`;
      document.body.appendChild(dialog);
      dialog.addEventListener("click",event=>{if(event.target===dialog&&!saving)dialog.close()});
      $("#closeBulkSeriesEdit")?.addEventListener("click",()=>{if(!saving)dialog.close()});
      $("#cancelBulkSeriesEdit")?.addEventListener("click",()=>{if(!saving)dialog.close()});
      $("#saveBulkSeriesEdit")?.addEventListener("click",()=>void save());
      for(const input of dialog.querySelectorAll("input,select"))input.addEventListener(input.tagName==="SELECT"?"change":"input",()=>{syncCreditFields();void renderPreview()});
    }

    function decorateCards(){
      for(const card of list.querySelectorAll(".manager-card")){
        const action=card.querySelector("[data-manager-open]"),id=action?.dataset.managerOpen;
        if(!id||card.querySelector("[data-bulk-series-select]"))continue;
        const actions=card.querySelector(".manager-card-actions");if(!actions)continue;
        const label=document.createElement("label");label.className="manager-bulk-select";
        label.innerHTML=`<input type="checkbox" data-bulk-series-select="${esc(id)}" aria-label="Select ${esc(entryById(id)?.series?.title||"series")} for batch edit"><span>Select</span>`;
        const checkbox=label.querySelector("input");checkbox.checked=selected.has(id);actions.prepend(label);
      }
    }

    function pruneSelection(){
      const ids=new Set(entries().map(item=>item.series.id));
      for(const id of selected)if(!ids.has(id))selected.delete(id);
    }
    function syncButton(){
      pruneSelection();decorateCards();
      const count=selected.size;if(!openButton)return;
      openButton.disabled=count<2||saving;openButton.textContent=count?`Batch edit (${count})`:"Batch edit";
    }

    function resetForm(){
      if(!dialog)return;
      $("#bulkGenresMode").value="keep";$("#bulkGenresInput").value="";$("#bulkTagsMode").value="keep";$("#bulkTagsInput").value="";
      $("#bulkSeriesStatus").value="__keep__";$("#bulkTranslationStatus").value="__keep__";$("#bulkCreditMode").value="keep";
      $("#bulkTranslatorName").value="";$("#bulkTranslatorUrl").value="";$("#bulkTranslatorCoverage").value="";
      $("#bulkSeriesProgress").classList.add("hidden");$("#bulkSeriesProgress").textContent="";syncCreditFields();
    }

    function syncCreditFields(){
      const mode=$("#bulkCreditMode")?.value||"keep",enabled=mode==="append"||mode==="replace";
      for(const id of ["bulkTranslatorName","bulkTranslatorUrl","bulkTranslatorCoverage"]){const input=$("#"+id);if(input)input.disabled=!enabled||saving}
      for(const id of ["bulkGenresInput","bulkTagsInput"]){const input=$("#"+id),modeId=id==="bulkGenresInput"?"bulkGenresMode":"bulkTagsMode";if(input)input.disabled=$("#"+modeId)?.value==="keep"||saving}
    }

    function readSpec(){
      return{
        genresMode:$("#bulkGenresMode")?.value||"keep",genres:splitList($("#bulkGenresInput")?.value),
        tagsMode:$("#bulkTagsMode")?.value||"keep",tags:splitList($("#bulkTagsInput")?.value),
        status:$("#bulkSeriesStatus")?.value||"__keep__",translationStatus:$("#bulkTranslationStatus")?.value||"__keep__",
        creditMode:$("#bulkCreditMode")?.value||"keep",
        credit:{name:$("#bulkTranslatorName")?.value.trim()||"",url:$("#bulkTranslatorUrl")?.value.trim()||"",coverage:$("#bulkTranslatorCoverage")?.value.trim()||""}
      };
    }

    function validateSpec(spec,taxonomy){
      const errors=[],warnings=[];
      if((spec.creditMode==="append"||spec.creditMode==="replace")&&!spec.credit.name)errors.push("A translator name is required when appending or replacing translation credits.");
      if(spec.genresMode!=="keep"){
        const unknown=spec.genres.filter(value=>!taxonomy.normalizeGenres([value]).length);
        if(unknown.length)warnings.push(`Ignored non-canonical genres: ${unknown.join(", ")}.`);
        if(spec.genresMode==="add"&&spec.genres.length&&!taxonomy.normalizeGenres(spec.genres).length)errors.push("No recognized canonical genres were entered.");
      }
      return{errors,warnings};
    }

    function applySpec(entry,spec,taxonomy){
      const series=entry.series;
      let genres=arr(series.genres).slice(),tags=arr(series.tags).slice();
      const enteredGenres=taxonomy.normalizeGenres(spec.genres);
      if(spec.genresMode==="add")genres=unique([...genres,...enteredGenres]);
      else if(spec.genresMode==="replace")genres=enteredGenres;
      const enteredTags=taxonomy.normalizeTags(spec.tags,{genres});
      if(spec.tagsMode==="add")tags=unique([...tags,...enteredTags]);
      else if(spec.tagsMode==="replace")tags=enteredTags;
      const status=spec.status==="__keep__"?normalizeSeriesStatus(series.status):normalizeSeriesStatus(spec.status);
      const translationStatus=spec.translationStatus==="__keep__"?String(series.translationStatus||""):spec.translationStatus==="__clear__"?"":spec.translationStatus;
      let translations=credits(series.translations);
      if(spec.creditMode==="append")translations=appendCredit(translations,spec.credit);
      else if(spec.creditMode==="replace")translations=[{...spec.credit}];
      else if(spec.creditMode==="clear")translations=[];
      return{genres,tags,status,translationStatus,translations};
    }

    function changesFor(series,after){
      const before={genres:arr(series.genres),tags:arr(series.tags),status:normalizeSeriesStatus(series.status),translationStatus:String(series.translationStatus||""),translations:credits(series.translations)};
      return Object.keys(before).filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(key=>({key,before:before[key],after:after[key]}));
    }

    function payloadFor(entry,after){
      const series=entry.series;
      return{action:"update-series",id:series.id,title:series.title||"",author:series.author||"",year:series.year||"",status:after.status,genres:after.genres,tags:after.tags,description:series.description||"",audioAlignedUrl:series.audioAlignedUrl||"",adult:entry.scope==="adult",translationStatus:after.translationStatus,translations:after.translations};
    }

    function printable(key,value){
      if(key==="translations")return credits(value).map(item=>item.name+(item.coverage?` (${item.coverage})`:"")).join(" · ")||"None";
      if(Array.isArray(value))return value.join(", ")||"None";
      return String(value||"Not set");
    }
    const labels={genres:"Genres",tags:"Tags",status:"Series status",translationStatus:"Translation status",translations:"Translation credits"};

    async function plans(){
      const taxonomy=await taxonomyPromise,spec=readSpec(),validation=validateSpec(spec,taxonomy);
      return{spec,validation,items:selectedEntries().map(entry=>{const after=applySpec(entry,spec,taxonomy);return{entry,after,changes:changesFor(entry.series,after),payload:payloadFor(entry,after)}})};
    }

    async function renderPreview(){
      if(!dialog?.open)return;
      syncCreditFields();
      const result=await plans(),changed=result.items.filter(item=>item.changes.length),validation=$("#bulkSeriesValidation"),saveButton=$("#saveBulkSeriesEdit");
      $("#bulkSeriesCount").textContent=`${result.items.length} series selected`;
      $("#bulkChangedCount").textContent=`${changed.length} series changing`;
      validation.className=`bulk-edit-validation${result.validation.errors.length?" error":result.validation.warnings.length?" warning":""}`;
      validation.textContent=result.validation.errors[0]||result.validation.warnings.join(" ")||"Only the previewed fields will change. Unlisted metadata is preserved.";
      $("#bulkSeriesPreview").innerHTML=changed.length?changed.map(item=>`<article class="bulk-edit-preview-item"><strong>${esc(item.entry.series.title||"Untitled")}</strong>${item.changes.map(change=>`<span><b>${esc(labels[change.key]||change.key)}</b>${esc(printable(change.key,change.before))} → ${esc(printable(change.key,change.after))}</span>`).join("")}</article>`).join(""):'<div class="bulk-edit-empty">No metadata changes are currently staged.</div>';
      saveButton.disabled=saving||Boolean(result.validation.errors.length)||!changed.length;
    }

    function setBusy(value){
      saving=value;
      for(const control of dialog?.querySelectorAll("[data-bulk-editor-control]")||[])control.disabled=value;
      syncCreditFields();syncButton();
      if(!value&&$("#saveBulkSeriesEdit"))$("#saveBulkSeriesEdit").disabled=true;
    }

    async function save(){
      if(saving)return;
      setBusy(true);
      const progress=$("#bulkSeriesProgress");let completed=0,backupCreated=false,changed=[];
      try{
        const result=await plans();changed=result.items.filter(item=>item.changes.length);
        if(result.validation.errors.length||!changed.length)return;
        progress.classList.remove("hidden");
        progress.textContent=`Creating safety backup before ${changed.length} series update${changed.length===1?"":"s"}…`;
        await client.request("/admin-api/maintenance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"create-backup",reason:"before-bulk-series-metadata"})});
        backupCreated=true;keeper.events.dispatchEvent(new Event("history:changed"));
        for(const item of changed){
          progress.textContent=`Saving ${completed+1} of ${changed.length}: ${item.entry.series.title||"Untitled"}`;
          await client.request("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(item.payload)});completed++;
        }
        state.management=null;selected.clear();keeper.events.dispatchEvent(new Event("library:invalidate"));dialog.close();keeper.ui.toast(`Updated metadata for ${completed} series.`);
      }catch(error){
        state.management=null;keeper.events.dispatchEvent(new Event("library:invalidate"));
        progress.classList.remove("hidden");progress.textContent=`Stopped after ${completed} of ${changed.length} series: ${error.message}`;
        alert(`Batch edit stopped after ${completed} of ${changed.length} series. No further series were changed.${backupCreated?" A safety backup was created before the batch began.":""}\n\n${error.message}`);
      }finally{setBusy(false);if(dialog.open)void renderPreview()}
    }

    function openEditor(){
      pruneSelection();if(selected.size<2)return;
      resetForm();if(!dialog.open)dialog.showModal();void renderPreview();
    }

    installStyle();installButton();installDialog();syncButton();
    new MutationObserver(()=>queueMicrotask(syncButton)).observe(list,{childList:true});
    list.addEventListener("change",event=>{
      const checkbox=event.target.closest("[data-bulk-series-select]");if(!checkbox)return;
      const id=checkbox.dataset.bulkSeriesSelect;if(checkbox.checked)selected.add(id);else selected.delete(id);syncButton();
    });
    keeper.events.addEventListener("library:changed",syncButton);
    keeper.events.addEventListener("session:locked",()=>{selected.clear();dialog?.close();syncButton()});

    return{get selectedIds(){return[...selected]},open:openEditor};
  });
})();
