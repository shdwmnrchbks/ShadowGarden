const $=s=>document.querySelector(s);
const state={file:null,meta:null,coverBlob:null,coverExt:".jpg",coverObjectUrl:"",unlocked:false,uploading:false};
const slug=s=>String(s||"untitled").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"untitled";
const cleanHtml=s=>{const doc=new DOMParser().parseFromString(String(s||""),"text/html");return(doc.body?.textContent||"").replace(/\s+/g," ").trim()};
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

async function unlock(){
  if(!token()){setAuthState("TOKEN NEEDED","error");return}
  $("#unlockButton").disabled=true;setAuthState("CHECKING");
  try{await api("/admin-api/status",{method:"POST"});sessionStorage.setItem("sg-admin-token",token());state.unlocked=true;setAuthState("UNLOCKED","ready");$("#unlockButton").textContent="Garden Keeper unlocked";if(state.file)$("#uploadCard").classList.remove("hidden")}
  catch(error){state.unlocked=false;setAuthState("DENIED","error");alert(error.message)}
  finally{$("#unlockButton").disabled=false}
}

async function fileChanged(event){
  const file=event.target.files?.[0];if(!file)return;
  state.file=file;state.meta=null;state.coverBlob=null;
  $("#uploadButton").disabled=false;$("#uploadButton").textContent="Upload EPUB to Shadow Garden";$("#openSeries").classList.add("hidden");setUploadState("READY");setStatus("Ready to upload","The bucket remains private. Readers receive files through Cloudflare.");
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

async function uploadObject(key,blob,type){
  return api(`/admin-api/upload?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"content-type":type||"application/octet-stream"},body:blob});
}

async function uploadBook(){
  if(state.uploading||!state.file||!state.meta||!state.unlocked)return;
  const series=$("#seriesInput").value.trim(),title=$("#titleInput").value.trim(),author=$("#authorInput").value.trim(),number=Number($("#volumeInput").value),year=Number($("#yearInput").value)||"",description=$("#descriptionInput").value.trim(),tags=$("#tagsInput").value.split(",").map(x=>x.trim()).filter(Boolean),adult=$("#adultInput").checked;
  if(!series||!title||!Number.isFinite(number)||number<=0){alert("Series, book title, and a valid volume number are required.");return}
  state.uploading=true;$("#uploadButton").disabled=true;$("#openSeries").classList.add("hidden");setUploadState("UPLOADING");
  let wakeLock=null;try{wakeLock=await navigator.wakeLock?.request("screen")}catch{}
  try{
    const sid=`${adult?"adult-":""}${slug(series)}`,bookBase=slug(state.file.name.replace(/\.epub$/i,"")),epubKey=`shadow-garden/books/${sid}/${bookBase}.epub`;
    setStatus("Uploading EPUB…","Keep this tab open while the book is sent to the private B2 bucket.","↑");
    await uploadObject(epubKey,state.file,"application/epub+zip");
    let coverKey="";
    if(state.coverBlob){const h=await hash8(state.coverBlob),vol=String(number).replace(".","-");coverKey=`shadow-garden/covers/${sid}-${vol}-${h}${state.coverExt}`;setStatus("Uploading cover…","The extracted cover is stored separately for fast library browsing.","↑");await uploadObject(coverKey,state.coverBlob,state.coverBlob.type||mimeForExt(state.coverExt))}
    setStatus("Updating catalog…","Adding the volume to the correct Shadow Garden shelf.","✦");
    const result=await api("/admin-api/catalog",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({adult,series,title,author,number,year,description,tags,date:state.meta.date,language:state.meta.language,publisher:state.meta.publisher,size:state.file.size,epubKey,coverKey})});
    setUploadState("COMPLETE","ready");setStatus("Upload complete",`${title} is now stored in the private B2 bucket.`,"✓");$("#uploadButton").textContent="Upload complete";$("#openSeries").href=`/series.html?id=${encodeURIComponent(result.seriesId)}`;$("#openSeries").classList.remove("hidden")
  }catch(error){console.error(error);setUploadState("FAILED","error");setStatus("Upload failed",error.message,"!");$("#uploadButton").disabled=false}
  finally{state.uploading=false;try{await wakeLock?.release()}catch{}}
}

$("#unlockButton")?.addEventListener("click",unlock);
$("#epubFile")?.addEventListener("change",fileChanged);
[$("#seriesInput"),$("#titleInput"),$("#volumeInput")].forEach(el=>el?.addEventListener("input",syncPreview));
$("#uploadButton")?.addEventListener("click",uploadBook);
const saved=sessionStorage.getItem("sg-admin-token");if(saved){$("#adminToken").value=saved;unlock()}
