const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const state={
  file:null,meta:null,coverBlob:null,coverExt:".jpg",coverObjectUrl:"",unlocked:false,uploading:false,
  management:null,manageScope:"all",manageQuery:"",activeSeriesId:null
};
const slug=s=>String(s||"untitled").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"untitled";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cleanHtml=s=>{const doc=new DOMParser().parseFromString(String(s||""),"text/html");return(doc.body?.textContent||"").replace(/\s+/g," ").trim()};
const arr=v=>Array.isArray(v)?v:[];
const elementsByLocal=(root,name)=>[...root.getElementsByTagName("*")].filter(el=>el.localName===name);
const firstText=(root,name)=>elementsByLocal(root,name)[0]?.textContent?.trim()||"";
const texts=(root,name)=>elementsByLocal(root,name).map(el=>el.textContent?.trim()||"").filter(Boolean);
const metaNodes=root=>elementsByLocal(root,"meta");
const metaByName=(root,name)=>metaNodes(root).find(el=>el.getAttribute("name")===name)?.getAttribute("content")||"";
const metaByProperty=(root,name)=>metaNodes(root).find(el=>el.getAttribute("property")===name)?.textContent?.trim()||"";

function resolveZipPath(base,relative){
  const stack=String(base||"").split("/").filter(Boolean);
  const parts=String(relative||"").split("#")[0].split("/");
  for(const part of parts){if(!part||part===".")continue;if(part==="..")stack.pop();else stack.push(part)}
  return stack.join("/");
}
function dirName(p){const a=String(p||"").split("/");a.pop();return a.join("/")}
function inferSeries(title){return String(title||"Untitled").replace(/\s*(?:[-–—:]\s*)?(?:volume|vol|book)\s*\.?\s*\d+(?:\.\d+)?(?:\b.*)?$/i,"").trim()||title}
function detectVolume(title,file,opf){
  const calibre=parseFloat(metaByName(opf,"calibre:series_index"));if(Number.isFinite(calibre)&&calibre>0)return calibre;
  const gp=parseFloat(metaByProperty(opf,"group-position"));if(Number.isFinite(gp)&&gp>0)return gp;
  const m=`${title} ${file}`.match(/\b(?:volume|vol|book)\s*\.?\s*(\d+(?:\.\d+)?)/i);return m?parseFloat(m[1]):1;
}
function mimeExt(type,href){
  const ext=(String(href||"").match(/\.(jpe?g|png|webp|avif|gif)$/i)||[])[0];
  if(ext)return ext.toLowerCase().replace(".jpeg",".jpg");
  return({"image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/avif":".avif","image/gif":".gif"})[type]||".jpg";
}
function mimeForExt(ext){return({".jpg":"image/jpeg",".png":"image/png",".webp":"image/webp",".avif":"image/avif",".gif":"image/gif"})[ext]||"image/jpeg"}
function fmtSize(n){if(!n)return"";let x=Number(n),i=0,u=["B","KB","MB","GB"];while(x>=1024&&i<3){x/=1024;i++}return`${x.toFixed(i>1?1:0)} ${u[i]}`}

async function inspectEpub(file){
  if(!window.JSZip)throw new Error("EPUB parser is still loading. Try selecting the file again.");
  const zip=await JSZip.loadAsync(file);
  const containerFile=zip.file("META-INF/container.xml");if(!containerFile)throw new Error("This file is missing META-INF/container.xml.");
  const containerXml=await containerFile.async("string"),container=new DOMParser().parseFromString(containerXml,"application/xml");
  const rootfile=elementsByLocal(container,"rootfile")[0]?.getAttribute("full-path");
  if(!rootfile)throw new Error("Could not find the EPUB package document.");
  const opfFile=zip.file(rootfile);if(!opfFile)throw new Error("The EPUB package document is missing.");
  const opfXml=await opfFile.async("string"),opf=new DOMParser().parseFromString(opfXml,"application/xml");
  if(opf.querySelector("parsererror"))throw new Error("The EPUB package metadata could not be parsed.");

  const title=firstText(opf,"title")||file.name.replace(/\.epub$/i,"");
  const author=firstText(opf,"creator");
  const date=firstText(opf,"date");
  const language=firstText(opf,"language");
  const publisher=firstText(opf,"publisher");
  const description=cleanHtml(firstText(opf,"description"));
  const tags=[...new Set(texts(opf,"subject"))];
  const series=metaByName(opf,"calibre:series")||metaByProperty(opf,"belongs-to-collection")||inferSeries(title);
  const number=detectVolume(title,file.name,opf);

  const items=elementsByLocal(opf,"item");
  let coverItem=items.find(el=>String(el.getAttribute("properties")||"").split(/\s+/).includes("cover-image"));
  if(!coverItem){const coverId=metaByName(opf,"cover");if(coverId)coverItem=items.find(el=>el.getAttribute("id")===coverId)}
  let coverBlob=null,coverExt=".jpg";
  if(coverItem){
    const href=coverItem.getAttribute("href")||"",coverPath=resolveZipPath(dirName(rootfile),decodeURIComponent(href));
    const zf=zip.file(coverPath);
    if(zf){coverExt=mimeExt(coverItem.getAttribute("media-type"),href);const data=await zf.async("arraybuffer");coverBlob=new Blob([data],{type:coverItem.getAttribute("media-type")||mimeForExt(coverExt)})}
  }
  return{title,author,date,year:parseInt(date.slice(0,4))||"",language,publisher,description,tags,series,number,coverBlob,coverExt};
}

function token(){return $("#adminToken").value.trim()}
function setAuthState(label,kind=""){$("#authState").textContent=label;$("#authState").className=`state-pill ${kind}`.trim()}
function setFileState(label,kind=""){$("#fileState").textContent=label;$("#fileState").className=`state-pill ${kind}`.trim()}
function setUploadState(label,kind=""){$("#uploadState").textContent=label;$("#uploadState").className=`state-pill ${kind}`.trim()}
function setStatus(title,detail,mark="✦"){$("#statusTitle").textContent=title;$("#statusDetail").textContent=detail;$("#statusMark").textContent=mark}
async function api(path,options={}){
  const headers=new Headers(options.headers||{});headers.set("authorization",`Bearer ${token()}`);
  const response=await fetch(path,{...options,headers,cache:"no-store"});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.detail||data.error||`Request failed (${response.status})`);
  return data;
}
async function hash8(blob){const buf=await blob.arrayBuffer(),hash=await crypto.subtle.digest("SHA-1",buf);return[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,8)}

function showDashboardHome(){
  $("#dashboardChoices").classList.remove("hidden");
  $("#manageView").classList.add("hidden");
  $("#addView").classList.add("hidden");
}
function openAdminView(name){
  $("#dashboardChoices").classList.add("hidden");
  $("#manageView").classList.toggle("hidden",name!=="manage");
  $("#addView").classList.toggle("hidden",name!=="add");
  if(name==="manage")loadLibrary();
  window.scrollTo({top:0,behavior:"smooth"});
}
async function unlock(){
  if(!token()){setAuthState("TOKEN NEEDED","error");return}
  $("#unlockButton").disabled=true;setAuthState("CHECKING");
  try{
    await api("/admin-api/status",{method:"POST"});
    state.unlocked=true;setAuthState("UNLOCKED","ready");
    $("#lockedView").classList.add("hidden");$("#dashboardView").classList.remove("hidden");showDashboardHome();
  }catch(error){state.unlocked=false;setAuthState("DENIED","error");alert(error.message)}
  finally{$("#unlockButton").disabled=false}
}
function lockAdmin(){
  state.unlocked=false;state.management=null;state.activeSeriesId=null;
  $("#adminToken").value="";setAuthState("LOCKED");$("#dashboardView").classList.add("hidden");$("#lockedView").classList.remove("hidden");
  try{$("#seriesEditor").close()}catch{}
}

function managementSeries(){
  if(!state.management)return[];
  return [
    ...arr(state.management.main).map(series=>({series,scope:"main"})),
    ...arr(state.management.adult).map(series=>({series,scope:"adult"}))
  ];
}
function findManagedSeries(id){return managementSeries().find(item=>item.series.id===id)||null}
function updateManagement(data){
  state.management={main:arr(data.main),adult:arr(data.adult),counts:data.counts||{}};
  $("#manageSeriesCount").textContent=state.management.main.length+state.management.adult.length;
  $("#manageVolumeCount").textContent=managementSeries().reduce((n,x)=>n+arr(x.series.volumes).length,0);
  $("#manageAdultCount").textContent=state.management.adult.length;
  renderManagerList();
}
async function loadLibrary(force=false){
  if(state.management&&!force){renderManagerList();return}
  $("#manageLoading").textContent="Loading the Garden…";$("#manageLoading").classList.remove("hidden");$("#manageEmpty").classList.add("hidden");$("#seriesManagerList").innerHTML="";
  try{updateManagement(await api("/admin-api/library",{method:"GET"}))}
  catch(error){console.error(error);$("#manageLoading").textContent=`Could not load the library: ${error.message}`;return}
  $("#manageLoading").classList.add("hidden");
}
function renderManagerList(){
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
    const cover=series.cover||arr(series.volumes).find(v=>v.cover)?.cover||"";
    return `<article class="manager-card">
      <div class="manager-card-cover">${cover?`<img src="${esc(cover)}" alt="${esc(series.title)} cover" loading="lazy">`:`<span>✦</span>`}</div>
      <div class="manager-card-copy">
        <div class="manager-card-title"><div><strong>${esc(series.title||"Untitled")}</strong><span>${esc(series.author||"Unknown author")}</span></div><span class="manager-scope ${scope}">${scope==="adult"?"18+":"MAIN"}</span></div>
        <div class="manager-card-meta"><span>${arr(series.volumes).length} ${arr(series.volumes).length===1?"volume":"volumes"}</span>${series.year?`<span>${esc(series.year)}</span>`:""}${arr(series.tags)[0]?`<span>${esc(arr(series.tags)[0])}</span>`:""}</div>
        <button class="admin-secondary manager-open" type="button" data-manager-open="${esc(series.id)}">Manage series</button>
      </div>
    </article>`;
  }).join("");
}
function renderManagedVolumes(series){
  $("#manageVolumeLabel").textContent=`${arr(series.volumes).length} ${arr(series.volumes).length===1?"volume":"volumes"}`;
  $("#manageVolumes").innerHTML=arr(series.volumes).map((v,index)=>`<article class="manage-volume" data-volume-index="${index}">
    <div class="manage-volume-summary">
      <div class="volume-number">${esc(v.number??index+1)}</div>
      <div class="volume-summary-copy"><strong>${esc(v.title||`Volume ${index+1}`)}</strong><span>${[v.date||"",fmtSize(v.size)].filter(Boolean).join(" · ")||"No extra metadata"}</span></div>
      <button class="volume-toggle" type="button" data-volume-toggle aria-label="Edit volume">Edit</button>
    </div>
    <div class="manage-volume-editor hidden">
      <div class="admin-grid">
        <label class="admin-field wide"><span>Volume title</span><input data-v-title type="text" value="${esc(v.title||"")}"></label>
        <label class="admin-field"><span>Volume number</span><input data-v-number type="number" min="0.01" step="0.01" value="${esc(v.number??index+1)}"></label>
        <label class="admin-field"><span>Date</span><input data-v-date type="text" value="${esc(v.date||"")}" placeholder="YYYY-MM-DD"></label>
        <label class="admin-field wide"><span>Publisher</span><input data-v-publisher type="text" value="${esc(v.publisher||"")}"></label>
        <label class="admin-field wide"><span>Description</span><textarea data-v-description rows="4">${esc(v.description||"")}</textarea></label>
      </div>
      <div class="volume-actions"><button class="danger-button small-danger" type="button" data-volume-delete>Remove volume</button><button class="admin-primary inline-button" type="button" data-volume-save>Save volume</button></div>
    </div>
  </article>`).join("");
}
function openSeriesEditor(id){
  const item=findManagedSeries(id);if(!item)return;
  state.activeSeriesId=id;const {series,scope}=item;
  $("#seriesEditorHeading").textContent=series.title||"Edit series";$("#manageTitle").value=series.title||"";$("#manageAuthor").value=series.author||"";$("#manageYear").value=series.year||"";$("#manageStatus").value=series.status||"";$("#manageTags").value=arr(series.tags).join(", ");$("#manageDescription").value=series.description||"";$("#manageAdult").checked=scope==="adult";
  const cover=series.cover||arr(series.volumes).find(v=>v.cover)?.cover||"";
  $("#managerCover").classList.toggle("hidden",!cover);$("#managerCoverFallback").classList.toggle("hidden",Boolean(cover));if(cover)$("#managerCover").src=cover;
  renderManagedVolumes(series);
  const dialog=$("#seriesEditor");if(!dialog.open)dialog.showModal();
}
async function saveSeries(){
  if(!state.activeSeriesId)return;
  const button=$("#saveSeries"),old=button.textContent;button.disabled=true;button.textContent="Saving…";
  try{
    const result=await api("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"update-series",id:state.activeSeriesId,title:$("#manageTitle").value,author:$("#manageAuthor").value,year:$("#manageYear").value,status:$("#manageStatus").value,tags:$("#manageTags").value.split(",").map(x=>x.trim()).filter(Boolean),description:$("#manageDescription").value,adult:$("#manageAdult").checked})});
    state.activeSeriesId=result.changedId||state.activeSeriesId;updateManagement(result);openSeriesEditor(state.activeSeriesId);button.textContent="Saved ✓";setTimeout(()=>{button.textContent=old},1200);
  }catch(error){alert(error.message);button.textContent=old}
  finally{button.disabled=false}
}
async function deleteSeries(){
  const item=findManagedSeries(state.activeSeriesId);if(!item)return;
  if(!confirm(`Delete “${item.series.title}” and every EPUB/cover stored for this series? This cannot be undone.`))return;
  const button=$("#deleteSeries");button.disabled=true;button.textContent="Deleting…";
  try{const result=await api("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete-series",id:state.activeSeriesId})});updateManagement(result);state.activeSeriesId=null;$("#seriesEditor").close()}
  catch(error){alert(error.message)}finally{button.disabled=false;button.textContent="Delete series"}
}
async function saveVolume(card){
  const index=Number(card.dataset.volumeIndex),item=findManagedSeries(state.activeSeriesId);if(!item)return;
  const button=card.querySelector("[data-volume-save]"),old=button.textContent;button.disabled=true;button.textContent="Saving…";
  try{const result=await api("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"update-volume",id:state.activeSeriesId,volumeIndex:index,title:card.querySelector("[data-v-title]").value,number:card.querySelector("[data-v-number]").value,date:card.querySelector("[data-v-date]").value,publisher:card.querySelector("[data-v-publisher]").value,description:card.querySelector("[data-v-description]").value})});updateManagement(result);openSeriesEditor(state.activeSeriesId)}
  catch(error){alert(error.message);button.textContent=old}finally{button.disabled=false}
}
async function deleteVolume(card){
  const index=Number(card.dataset.volumeIndex),item=findManagedSeries(state.activeSeriesId);if(!item)return;const volume=arr(item.series.volumes)[index];if(!volume)return;
  if(!confirm(`Remove “${volume.title}” from Shadow Garden and delete its EPUB from B2? This cannot be undone.`))return;
  const button=card.querySelector("[data-volume-delete]");button.disabled=true;button.textContent="Removing…";
  try{const result=await api("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete-volume",id:state.activeSeriesId,volumeIndex:index})});updateManagement(result);const still=findManagedSeries(state.activeSeriesId);if(still)openSeriesEditor(state.activeSeriesId);else{$("#seriesEditor").close();state.activeSeriesId=null}}
  catch(error){alert(error.message);button.disabled=false;button.textContent="Remove volume"}
}

async function fileChanged(event){
  const file=event.target.files?.[0];if(!file)return;
  state.file=file;state.meta=null;state.coverBlob=null;
  $("#uploadButton").disabled=false;$("#uploadButton").textContent="Upload";$("#openSeries").classList.add("hidden");setUploadState("READY");setStatus("Ready to upload","The bucket remains private. Readers receive files through Cloudflare.");
  $("#filePickerTitle").textContent=file.name;$("#filePickerMeta").textContent=`${(file.size/1024/1024).toFixed(1)} MB · Inspecting metadata…`;setFileState("READING");
  $("#metadataCard").classList.add("hidden");$("#uploadCard").classList.add("hidden");
  if(file.size>50*1024*1024){setFileState("TOO LARGE","error");$("#filePickerMeta").textContent="This uploader is limited to 50 MB per file.";return}
  try{
    const meta=await inspectEpub(file);state.meta=meta;state.coverBlob=meta.coverBlob;state.coverExt=meta.coverExt;
    $("#seriesInput").value=meta.series;$("#volumeInput").value=meta.number;$("#yearInput").value=meta.year;$("#titleInput").value=meta.title;$("#authorInput").value=meta.author;$("#tagsInput").value=meta.tags.join(", ");$("#descriptionInput").value=meta.description;
    $("#previewTitle").textContent=meta.title;$("#previewSeries").textContent=`${meta.series} · Volume ${meta.number}`;
    if(state.coverObjectUrl)URL.revokeObjectURL(state.coverObjectUrl);state.coverObjectUrl="";
    if(meta.coverBlob){state.coverObjectUrl=URL.createObjectURL(meta.coverBlob);$("#coverPreview").src=state.coverObjectUrl;$("#coverPreview").classList.remove("hidden");$("#coverFallback").classList.add("hidden")}else{$("#coverPreview").classList.add("hidden");$("#coverFallback").classList.remove("hidden")}
    $("#filePickerMeta").textContent=`${(file.size/1024/1024).toFixed(1)} MB · Metadata extracted on this phone`;setFileState("READY","ready");$("#metadataCard").classList.remove("hidden");if(state.unlocked)$("#uploadCard").classList.remove("hidden")
  }catch(error){console.error(error);setFileState("INVALID","error");$("#filePickerMeta").textContent=error.message}
}
function syncPreview(){const series=$("#seriesInput").value.trim(),title=$("#titleInput").value.trim(),volume=$("#volumeInput").value;$("#previewTitle").textContent=title||"Untitled";$("#previewSeries").textContent=`${series||"Unknown series"}${volume?` · Volume ${volume}`:""}`}
async function uploadObject(key,blob,type){return api(`/admin-api/upload?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"content-type":type||"application/octet-stream"},body:blob})}
async function uploadBook(){
  if(state.uploading||!state.file||!state.meta||!state.unlocked)return;
  const series=$("#seriesInput").value.trim(),title=$("#titleInput").value.trim(),author=$("#authorInput").value.trim(),number=Number($("#volumeInput").value),year=Number($("#yearInput").value)||"",description=$("#descriptionInput").value.trim(),tags=$("#tagsInput").value.split(",").map(x=>x.trim()).filter(Boolean),adult=$("#adultInput").checked;
  if(!series||!title||!Number.isFinite(number)||number<=0){alert("Series, book title, and a valid volume number are required.");return}
  state.uploading=true;$("#uploadButton").disabled=true;$("#openSeries").classList.add("hidden");setUploadState("UPLOADING");
  let wakeLock=null;try{wakeLock=await navigator.wakeLock?.request("screen")}catch{}
  try{
    const sid=`${adult?"adult-":""}${slug(series)}`,bookBase=slug(state.file.name.replace(/\.epub$/i,"")),epubKey=`shadow-garden/books/${sid}/${bookBase}.epub`;
    setStatus("Uploading EPUB…","Keep this tab open while the book is sent to the private B2 bucket.","↑");await uploadObject(epubKey,state.file,"application/epub+zip");
    let coverKey="";
    if(state.coverBlob){const h=await hash8(state.coverBlob),vol=String(number).replace(".","-");coverKey=`shadow-garden/covers/${sid}-${vol}-${h}${state.coverExt}`;setStatus("Uploading cover…","The extracted cover is stored separately for fast library browsing.","↑");await uploadObject(coverKey,state.coverBlob,state.coverBlob.type||mimeForExt(state.coverExt))}
    setStatus("Updating catalog…","Adding the volume to the correct Shadow Garden shelf.","✦");
    const result=await api("/admin-api/catalog",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({adult,series,title,author,number,year,description,tags,date:state.meta.date,language:state.meta.language,publisher:state.meta.publisher,size:state.file.size,epubKey,coverKey})});
    state.management=null;setUploadState("COMPLETE","ready");setStatus("Upload complete",`${title} is now stored in the private B2 bucket.`,"✓");$("#uploadButton").textContent="Upload complete";$("#openSeries").href=`/series.html?id=${encodeURIComponent(result.seriesId)}`;$("#openSeries").classList.remove("hidden")
  }catch(error){console.error(error);setUploadState("FAILED","error");setStatus("Upload failed",error.message,"!");$("#uploadButton").disabled=false}
  finally{state.uploading=false;try{await wakeLock?.release()}catch{}}
}

$("#unlockButton")?.addEventListener("click",unlock);
$("#adminToken")?.addEventListener("keydown",e=>{if(e.key==="Enter")unlock()});
$("#lockButton")?.addEventListener("click",lockAdmin);
$("#dashboardChoices")?.addEventListener("click",e=>{const button=e.target.closest("[data-admin-view]");if(button)openAdminView(button.dataset.adminView)});
$$('[data-back-dashboard]').forEach(button=>button.addEventListener("click",showDashboardHome));
$("#manageSearch")?.addEventListener("input",e=>{state.manageQuery=e.target.value;renderManagerList()});
$(".manage-tabs")?.addEventListener("click",e=>{const button=e.target.closest("[data-manage-scope]");if(!button)return;state.manageScope=button.dataset.manageScope;$$('[data-manage-scope]').forEach(b=>b.classList.toggle("active",b===button));renderManagerList()});
$("#refreshLibrary")?.addEventListener("click",()=>{state.management=null;loadLibrary(true)});
$("#seriesManagerList")?.addEventListener("click",e=>{const button=e.target.closest("[data-manager-open]");if(button)openSeriesEditor(button.dataset.managerOpen)});
$("#manageVolumes")?.addEventListener("click",e=>{const card=e.target.closest(".manage-volume");if(!card)return;if(e.target.closest("[data-volume-toggle]"))card.querySelector(".manage-volume-editor").classList.toggle("hidden");if(e.target.closest("[data-volume-save]"))saveVolume(card);if(e.target.closest("[data-volume-delete]"))deleteVolume(card)});
$("#saveSeries")?.addEventListener("click",saveSeries);$("#deleteSeries")?.addEventListener("click",deleteSeries);
$("#epubFile")?.addEventListener("change",fileChanged);
[$("#seriesInput"),$("#titleInput"),$("#volumeInput")].forEach(el=>el?.addEventListener("input",syncPreview));
$("#uploadButton")?.addEventListener("click",uploadBook);
