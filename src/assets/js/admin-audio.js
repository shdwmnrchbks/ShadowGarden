/* Series-level audio-aligned EPUB folder links and cover optimization for Garden Keeper. */
(()=>{
  const descriptionLabel=$("#descriptionInput")?.closest("label");
  if(descriptionLabel&&!$("#audioAlignedInput")){
    const label=document.createElement("label");
    label.className="admin-field wide";
    label.innerHTML='<span>Audio-aligned EPUB folder URL (series, optional)</span><input id="audioAlignedInput" type="url" inputmode="url" placeholder="https://example.com/series-audio-epubs/">';
    descriptionLabel.before(label);
  }

  const manageDescriptionLabel=$("#manageDescription")?.closest("label");
  if(manageDescriptionLabel&&!$("#manageAudioAlignedUrl")){
    const label=document.createElement("label");
    label.className="admin-field wide";
    label.innerHTML='<span>Audio-aligned EPUB folder URL (optional)</span><input id="manageAudioAlignedUrl" type="url" inputmode="url" placeholder="https://example.com/series-audio-epubs/"><small class="field-note">One external folder link for the entire series. The public series page shows a single Audio EPUBs button when this is set.</small>';
    manageDescriptionLabel.before(label);
  }

  $("#epubFile")?.addEventListener("change",()=>{if($("#audioAlignedInput"))$("#audioAlignedInput").value=""});
})();

function seriesAudioUrl(series){
  return series?.audioAlignedUrl||arr(series?.volumes).find(v=>v.audioAlignedUrl)?.audioAlignedUrl||"";
}

/* Management cards only need thumbnail-sized art. Legacy volume audio links are surfaced as series links. */
renderManagerList=function(){
  if(!state.management)return;
  const query=state.manageQuery.trim().toLowerCase();
  const items=managementSeries().filter(({series,scope})=>{
    if(state.manageScope!=="all"&&state.manageScope!==scope)return false;
    if(!query)return true;
    const hay=[series.title,series.author,...arr(series.tags),...arr(series.volumes).map(v=>v.title)].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(query);
  }).sort((a,b)=>String(a.series.title||"").localeCompare(String(b.series.title||"")));
  $("#manageEmpty").classList.toggle("hidden",items.length>0);
  $("#seriesManagerList").innerHTML=items.map(({series,scope})=>{
    const cover=series.coverThumb||series.cover||arr(series.volumes).find(v=>v.coverThumb)?.coverThumb||arr(series.volumes).find(v=>v.cover)?.cover||"";
    return `<article class="manager-card">
      <div class="manager-card-cover">${cover?`<img src="${esc(cover)}" alt="${esc(series.title)} cover" loading="lazy" decoding="async" fetchpriority="low">`:`<span>✦</span>`}</div>
      <div class="manager-card-copy">
        <div class="manager-card-title"><div><strong>${esc(series.title||"Untitled")}</strong><span>${esc(series.author||"Unknown author")}</span></div><span class="manager-scope ${scope}">${scope==="adult"?"18+":"MAIN"}</span></div>
        <div class="manager-card-meta"><span>${arr(series.volumes).length} ${arr(series.volumes).length===1?"volume":"volumes"}</span>${series.year?`<span>${esc(series.year)}</span>`:""}${arr(series.tags)[0]?`<span>${esc(arr(series.tags)[0])}</span>`:""}${seriesAudioUrl(series)?`<span>Audio folder linked</span>`:""}</div>
        <button class="admin-secondary manager-open" type="button" data-manager-open="${esc(series.id)}">Manage series</button>
      </div>
    </article>`;
  }).join("");
};

/* Populate the series-level audio URL whenever the editor opens. Legacy volume links are shown as a migration fallback. */
(()=>{
  const baseOpenSeriesEditor=openSeriesEditor;
  openSeriesEditor=function(id){
    baseOpenSeriesEditor(id);
    const item=findManagedSeries(id);
    if(item&&$("#manageAudioAlignedUrl"))$("#manageAudioAlignedUrl").value=seriesAudioUrl(item.series);
  };
})();

async function saveSeriesWithAudio(){
  if(!state.activeSeriesId)return;
  const button=$("#saveSeries"),old=button.textContent;button.disabled=true;button.textContent="Saving…";
  try{
    const result=await api("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      action:"update-series",
      id:state.activeSeriesId,
      title:$("#manageTitle").value,
      author:$("#manageAuthor").value,
      year:$("#manageYear").value,
      status:$("#manageStatus").value,
      tags:$("#manageTags").value.split(",").map(x=>x.trim()).filter(Boolean),
      description:$("#manageDescription").value,
      audioAlignedUrl:$("#manageAudioAlignedUrl")?.value.trim()||"",
      adult:$("#manageAdult").checked
    })});
    state.activeSeriesId=result.changedId||state.activeSeriesId;
    updateManagement(result);openSeriesEditor(state.activeSeriesId);
    button.textContent="Saved ✓";setTimeout(()=>{if(button.isConnected)button.textContent=old},1200);
  }catch(error){alert(error.message);button.textContent=old}
  finally{button.disabled=false}
}

/* admin.js attached its save handler before this enhancement loaded. Replace the node once so the
 * series-level audio field is included and legacy volume links can be migrated on save. */
(()=>{
  const oldButton=$("#saveSeries");if(!oldButton)return;
  const button=oldButton.cloneNode(true);oldButton.replaceWith(button);
  saveSeries=saveSeriesWithAudio;
  button.addEventListener("click",saveSeriesWithAudio);
})();

async function imageSource(blob){
  if(typeof createImageBitmap==="function"){
    let bitmap;
    try{bitmap=await createImageBitmap(blob,{imageOrientation:"from-image"})}catch{bitmap=await createImageBitmap(blob)}
    return{source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};
  }
  const url=URL.createObjectURL(blob),img=new Image();
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error("Cover image could not be decoded"));img.src=url});
    return{source:img,width:img.naturalWidth,height:img.naturalHeight,close:()=>URL.revokeObjectURL(url)};
  }catch(error){URL.revokeObjectURL(url);throw error}
}

async function renderWebp(image,maxWidth,quality){
  if(!image.width||!image.height)throw new Error("Cover has invalid dimensions");
  const scale=Math.min(1,maxWidth/image.width),width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:true});if(!ctx)throw new Error("Canvas is unavailable");
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(image.source,0,0,width,height);
  const output=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
  canvas.width=1;canvas.height=1;
  if(!output||output.type!=="image/webp")throw new Error("WebP encoding is unavailable");
  return output;
}

async function optimizedCoverSet(blob){
  let image;
  try{
    image=await imageSource(blob);
    /* Render sequentially from one decoded image to keep peak memory low on phones. */
    const detail=await renderWebp(image,1000,.84);
    const thumb=await renderWebp(image,480,.78);
    return{detail,thumb,optimized:true};
  }catch(error){
    console.warn("Cover optimization unavailable; using original cover",error);
    return{detail:blob,thumb:null,optimized:false};
  }finally{image?.close?.()}
}

async function optimizedUploadBook(){
  if(state.uploading||!state.file||!state.meta||!state.unlocked)return;
  const series=$("#seriesInput").value.trim(),title=$("#titleInput").value.trim(),author=$("#authorInput").value.trim(),number=Number($("#volumeInput").value),year=Number($("#yearInput").value)||"",description=$("#descriptionInput").value.trim(),tags=$("#tagsInput").value.split(",").map(x=>x.trim()).filter(Boolean),adult=$("#adultInput").checked,audioAlignedUrl=$("#audioAlignedInput")?.value.trim()||"";
  if(!series||!title||!Number.isFinite(number)||number<=0){alert("Series, book title, and a valid volume number are required.");return}
  state.uploading=true;$("#uploadButton").disabled=true;$("#openSeries").classList.add("hidden");setUploadState("UPLOADING");
  let wakeLock=null;try{wakeLock=await navigator.wakeLock?.request("screen")}catch{}
  try{
    const sid=`${adult?"adult-":""}${slug(series)}`,bookBase=slug(state.file.name.replace(/\.epub$/i,"")),epubKey=`shadow-garden/books/${sid}/${bookBase}.epub`;
    setStatus("Uploading EPUB…","Keep this tab open while the book is sent to the private B2 bucket.","↑");await uploadObject(epubKey,state.file,"application/epub+zip");
    let coverKey="",coverThumbKey="";
    if(state.coverBlob){
      setStatus("Optimizing cover…","Creating lightweight cover images on this phone for faster library pages.","✦");
      const variants=await optimizedCoverSet(state.coverBlob),h=await hash8(state.coverBlob),vol=String(number).replace(".","-");
      const detailIsWebp=variants.detail.type==="image/webp",detailExt=detailIsWebp?".webp":state.coverExt;
      coverKey=`shadow-garden/covers/${sid}-${vol}-${h}-detail${detailExt}`;
      setStatus("Uploading optimized cover…",variants.optimized?"Uploading the detail cover and compact library thumbnail.":"This browser could not encode WebP, so the original cover will be used.","↑");
      await uploadObject(coverKey,variants.detail,variants.detail.type||mimeForExt(detailExt));
      if(variants.thumb){coverThumbKey=`shadow-garden/covers/${sid}-${vol}-${h}-thumb.webp`;await uploadObject(coverThumbKey,variants.thumb,"image/webp")}
    }
    setStatus("Updating catalog…","Adding the volume to the correct Shadow Garden shelf.","✦");
    const result=await api("/admin-api/catalog",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({adult,series,title,author,number,year,description,tags,audioAlignedUrl,date:state.meta.date,language:state.meta.language,publisher:state.meta.publisher,size:state.file.size,epubKey,coverKey,coverThumbKey})});
    state.management=null;setUploadState("COMPLETE","ready");setStatus("Upload complete",`${title} is now stored with web-optimized cover art when supported.`,"✓");$("#uploadButton").textContent="Upload complete";$("#openSeries").href=`/series.html?id=${encodeURIComponent(result.seriesId)}`;$("#openSeries").classList.remove("hidden")
  }catch(error){console.error(error);setUploadState("FAILED","error");setStatus("Upload failed",error.message,"!");$("#uploadButton").disabled=false}
  finally{state.uploading=false;try{await wakeLock?.release()}catch{}}
}

/* admin.js attached the original upload handler before this enhancement loaded. Replace the
 * button node once so only the optimized uploader runs, then keep the global function current. */
(()=>{
  const oldButton=$("#uploadButton");if(!oldButton)return;
  const button=oldButton.cloneNode(true);oldButton.replaceWith(button);
  uploadBook=optimizedUploadBook;
  button.addEventListener("click",optimizedUploadBook);
})();

/* Dismiss the modal only when the actual dialog backdrop is clicked. */
(()=>{
  const dialog=document.querySelector("#seriesEditor");
  if(!dialog)return;
  dialog.addEventListener("click",event=>{
    if(event.target===dialog)dialog.close();
  });
})();
