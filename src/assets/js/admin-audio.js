/* Optional external audio-aligned EPUB link support for Garden Keeper. */
(()=>{
  const descriptionLabel=$("#descriptionInput")?.closest("label");
  if(descriptionLabel&&!$("#audioAlignedInput")){
    const label=document.createElement("label");
    label.className="admin-field wide";
    label.innerHTML='<span>Audio-aligned EPUB URL (optional)</span><input id="audioAlignedInput" type="url" inputmode="url" placeholder="https://example.com/book-audio.epub">';
    descriptionLabel.before(label);
  }
  $("#epubFile")?.addEventListener("change",()=>{if($("#audioAlignedInput"))$("#audioAlignedInput").value=""});
})();

renderManagedVolumes=function(series){
  $("#manageVolumeLabel").textContent=`${arr(series.volumes).length} ${arr(series.volumes).length===1?"volume":"volumes"}`;
  $("#manageVolumes").innerHTML=arr(series.volumes).map((v,index)=>`<article class="manage-volume" data-volume-index="${index}">
    <div class="manage-volume-summary">
      <div class="volume-number">${esc(v.number??index+1)}</div>
      <div class="volume-summary-copy"><strong>${esc(v.title||`Volume ${index+1}`)}</strong><span>${[v.date||"",fmtSize(v.size),v.audioAlignedUrl?"Audio EPUB linked":""].filter(Boolean).join(" · ")||"No extra metadata"}</span></div>
      <button class="volume-toggle" type="button" data-volume-toggle aria-label="Edit volume">Edit</button>
    </div>
    <div class="manage-volume-editor hidden">
      <div class="admin-grid">
        <label class="admin-field wide"><span>Volume title</span><input data-v-title type="text" value="${esc(v.title||"")}"></label>
        <label class="admin-field"><span>Volume number</span><input data-v-number type="number" min="0.01" step="0.01" value="${esc(v.number??index+1)}"></label>
        <label class="admin-field"><span>Date</span><input data-v-date type="text" value="${esc(v.date||"")}" placeholder="YYYY-MM-DD"></label>
        <label class="admin-field wide"><span>Publisher</span><input data-v-publisher type="text" value="${esc(v.publisher||"")}"></label>
        <label class="admin-field wide"><span>Audio-aligned EPUB URL (optional)</span><input data-v-audio type="url" inputmode="url" placeholder="https://example.com/book-audio.epub" value="${esc(v.audioAlignedUrl||"")}"></label>
        <label class="admin-field wide"><span>Description</span><textarea data-v-description rows="4">${esc(v.description||"")}</textarea></label>
      </div>
      <div class="volume-actions"><button class="danger-button small-danger" type="button" data-volume-delete>Remove volume</button><button class="admin-primary inline-button" type="button" data-volume-save>Save volume</button></div>
    </div>
  </article>`).join("");
};

saveVolume=async function(card){
  const index=Number(card.dataset.volumeIndex),item=findManagedSeries(state.activeSeriesId);if(!item)return;
  const button=card.querySelector("[data-volume-save]"),old=button.textContent;button.disabled=true;button.textContent="Saving…";
  try{
    const result=await api("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      action:"update-volume",id:state.activeSeriesId,volumeIndex:index,
      title:card.querySelector("[data-v-title]").value,
      number:card.querySelector("[data-v-number]").value,
      date:card.querySelector("[data-v-date]").value,
      publisher:card.querySelector("[data-v-publisher]").value,
      audioAlignedUrl:card.querySelector("[data-v-audio]")?.value||"",
      description:card.querySelector("[data-v-description]").value
    })});
    updateManagement(result);openSeriesEditor(state.activeSeriesId);
  }catch(error){alert(error.message);button.textContent=old}finally{button.disabled=false}
};

uploadBook=async function(){
  if(state.uploading||!state.file||!state.meta||!state.unlocked)return;
  const series=$("#seriesInput").value.trim(),title=$("#titleInput").value.trim(),author=$("#authorInput").value.trim(),number=Number($("#volumeInput").value),year=Number($("#yearInput").value)||"",description=$("#descriptionInput").value.trim(),tags=$("#tagsInput").value.split(",").map(x=>x.trim()).filter(Boolean),adult=$("#adultInput").checked,audioAlignedUrl=$("#audioAlignedInput")?.value.trim()||"";
  if(!series||!title||!Number.isFinite(number)||number<=0){alert("Series, book title, and a valid volume number are required.");return}
  state.uploading=true;$("#uploadButton").disabled=true;$("#openSeries").classList.add("hidden");setUploadState("UPLOADING");
  let wakeLock=null;try{wakeLock=await navigator.wakeLock?.request("screen")}catch{}
  try{
    const sid=`${adult?"adult-":""}${slug(series)}`,bookBase=slug(state.file.name.replace(/\.epub$/i,"")),epubKey=`shadow-garden/books/${sid}/${bookBase}.epub`;
    setStatus("Uploading EPUB…","Keep this tab open while the book is sent to the private B2 bucket.","↑");await uploadObject(epubKey,state.file,"application/epub+zip");
    let coverKey="";
    if(state.coverBlob){const h=await hash8(state.coverBlob),vol=String(number).replace(".","-");coverKey=`shadow-garden/covers/${sid}-${vol}-${h}${state.coverExt}`;setStatus("Uploading cover…","The extracted cover is stored separately for fast library browsing.","↑");await uploadObject(coverKey,state.coverBlob,state.coverBlob.type||mimeForExt(state.coverExt))}
    setStatus("Updating catalog…","Adding the volume to the correct Shadow Garden shelf.","✦");
    const result=await api("/admin-api/catalog",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({adult,series,title,author,number,year,description,tags,audioAlignedUrl,date:state.meta.date,language:state.meta.language,publisher:state.meta.publisher,size:state.file.size,epubKey,coverKey})});
    state.management=null;setUploadState("COMPLETE","ready");setStatus("Upload complete",`${title} is now stored in the private B2 bucket.`,"✓");$("#uploadButton").textContent="Upload complete";$("#openSeries").href=`/series.html?id=${encodeURIComponent(result.seriesId)}`;$("#openSeries").classList.remove("hidden")
  }catch(error){console.error(error);setUploadState("FAILED","error");setStatus("Upload failed",error.message,"!");$("#uploadButton").disabled=false}
  finally{state.uploading=false;try{await wakeLock?.release()}catch{}}
};

/* Dismiss the modal only when the actual dialog backdrop is clicked. */
(()=>{
  const dialog=document.querySelector("#seriesEditor");
  if(!dialog)return;
  dialog.addEventListener("click",event=>{
    if(event.target===dialog)dialog.close();
  });
})();
