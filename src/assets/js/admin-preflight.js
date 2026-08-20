/* Shadow Garden lightweight EPUB preflight v0.8.1. Runs entirely in the browser before upload. */
(()=>{
  const MAX_RENDERED_ISSUES=80;
  const KNOWN_FONT_OBFUSCATION=new Set([
    "http://www.idpf.org/2008/embedding",
    "http://ns.adobe.com/pdf/enc#RC"
  ]);
  const readableTypes=new Set(["application/xhtml+xml","text/html","image/svg+xml"]);

  const localElements=(root,name)=>root?[...root.getElementsByTagName("*")].filter(el=>el.localName===name):[];
  const safeDecode=value=>{try{return decodeURIComponent(String(value||""))}catch{return String(value||"")}};
  const dirname=value=>{const parts=String(value||"").split("/");parts.pop();return parts.join("/")};
  const externalRef=value=>/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(String(value||"").trim());
  const stripRef=value=>safeDecode(String(value||"").trim()).split("#")[0].split("?")[0];
  const issueKey=(severity,message,detail)=>`${severity}|${message}|${detail}`;

  function resolveLocal(base,reference){
    const raw=String(reference||"").trim();
    if(!raw||raw.startsWith("#")||externalRef(raw))return{skip:true,path:""};
    const clean=stripRef(raw);
    if(!clean)return{skip:true,path:""};
    const stack=clean.startsWith("/")?[]:String(base||"").split("/").filter(Boolean);
    for(const piece of clean.replace(/^\/+/,"").split("/")){
      if(!piece||piece===".")continue;
      if(piece===".."){if(!stack.length)return{invalid:true,path:""};stack.pop();continue}
      stack.push(piece);
    }
    return{skip:false,invalid:false,path:stack.join("/")};
  }

  function newReport(){
    return{
      status:"pass",
      fatal:[],warnings:[],
      checks:{container:"pending",package:"pending",spine:"pending",navigation:"pending",cover:"pending",security:"pending"},
      stats:{entries:0,manifest:0,spine:0,readable:0,resources:0,brokenRefs:0,mediaOverlays:0},
      _seen:new Set()
    };
  }
  function addIssue(report,severity,message,detail=""){
    const key=issueKey(severity,message,detail);if(report._seen.has(key))return;
    report._seen.add(key);
    const target=severity==="fatal"?report.fatal:report.warnings;
    target.push({message,detail});
  }
  function fail(report,message,detail=""){addIssue(report,"fatal",message,detail)}
  function warn(report,message,detail=""){addIssue(report,"warning",message,detail)}
  function finalize(report){
    report.status=report.fatal.length?"fail":report.warnings.length?"warning":"pass";
    delete report._seen;
    return report;
  }
  function failedReport(message,detail=""){
    const report=newReport();
    fail(report,message,detail);report.checks.container="fail";report.checks.package="fail";
    return finalize(report);
  }
  function preflightError(message,report){const error=new Error(message);error.preflightReport=finalize(report);return error}

  function zipHas(zip,path){return Boolean(path&&zip.file(path))}
  async function zipText(zip,path){const entry=zip.file(path);return entry?entry.async("string"):null}
  function xmlDocument(text){return new DOMParser().parseFromString(String(text||""),"application/xml")}
  function isXmlBroken(doc){return Boolean(doc?.querySelector?.("parsererror"))}
  function hrefInfo(item,opfDir){
    const href=item.getAttribute("href")||"";
    const resolved=resolveLocal(opfDir,href);
    return{
      id:item.getAttribute("id")||"",
      href,
      path:resolved.path,
      invalid:resolved.invalid,
      external:resolved.skip&&externalRef(href),
      mediaType:item.getAttribute("media-type")||"",
      properties:String(item.getAttribute("properties")||"").split(/\s+/).filter(Boolean),
      overlay:item.getAttribute("media-overlay")||"",
      node:item
    };
  }

  function collectDocumentRefs(doc){
    const refs=[];
    const rules=[
      ["a[href]","href","link"],["img[src]","src","image"],["link[href]","href","stylesheet"],
      ["script[src]","src","script"],["source[src]","src","source"],["audio[src]","src","audio"],
      ["video[src]","src","video"],["object[data]","data","object"],["iframe[src]","src","frame"]
    ];
    for(const [selector,attr,kind] of rules){
      for(const el of doc.querySelectorAll?.(selector)||[]){const value=el.getAttribute(attr);if(value)refs.push({value,kind})}
    }
    return refs;
  }

  async function inspectEpubWithPreflight(file){
    if(!window.JSZip)throw Object.assign(new Error("EPUB parser is still loading. Try selecting the file again."),{preflightReport:failedReport("EPUB parser is unavailable")});
    const report=newReport();
    let zip;
    try{zip=await JSZip.loadAsync(file)}catch(error){throw preflightError("This file is not a readable EPUB/ZIP archive.",Object.assign(report,{checks:{...report.checks,container:"fail",package:"fail"}}))}
    report.stats.entries=Object.keys(zip.files||{}).filter(name=>!zip.files[name]?.dir).length;

    const mimetype=await zipText(zip,"mimetype");
    if(mimetype===null)warn(report,"Missing EPUB mimetype file","Most readers tolerate this, but the EPUB package is not fully conventional.");
    else if(mimetype.trim()!=="application/epub+zip")warn(report,"Unexpected EPUB mimetype",`Found: ${mimetype.trim()||"empty"}`);

    const containerPath="META-INF/container.xml";
    const containerText=await zipText(zip,containerPath);
    if(containerText===null){report.checks.container="fail";throw preflightError("This EPUB is missing META-INF/container.xml.",report)}
    const container=xmlDocument(containerText);
    if(isXmlBroken(container)){report.checks.container="fail";throw preflightError("META-INF/container.xml is malformed.",report)}
    const rootfile=localElements(container,"rootfile")[0]?.getAttribute("full-path")||"";
    if(!rootfile){report.checks.container="fail";throw preflightError("The EPUB container does not identify a package document.",report)}
    report.checks.container="pass";

    const opfText=await zipText(zip,rootfile);
    if(opfText===null){report.checks.package="fail";throw preflightError("The package document referenced by container.xml is missing.",report)}
    const opf=xmlDocument(opfText);
    if(isXmlBroken(opf)){report.checks.package="fail";throw preflightError("The EPUB package document is malformed XML.",report)}
    report.checks.package="pass";
    const opfDir=dirname(rootfile);

    const title=firstText(opf,"title")||file.name.replace(/\.epub$/i,"");
    const author=firstText(opf,"creator");
    const date=firstText(opf,"date");
    const language=firstText(opf,"language");
    const publisher=firstText(opf,"publisher");
    const description=cleanHtml(firstText(opf,"description"));
    const tags=[...new Set(texts(opf,"subject"))];
    const series=metaByName(opf,"calibre:series")||metaByProperty(opf,"belongs-to-collection")||inferSeries(title);
    const number=detectVolume(title,file.name,opf);
    if(!firstText(opf,"title"))warn(report,"Missing title metadata","The filename will be used as a fallback title.");
    if(!language)warn(report,"Missing language metadata","Reading still works, but language-aware typography may be less accurate.");

    const manifestNodes=localElements(opf,"item");
    const manifest=manifestNodes.map(node=>hrefInfo(node,opfDir));
    report.stats.manifest=manifest.length;
    report.stats.resources=manifest.length;
    const manifestById=new Map();
    for(const item of manifest){
      if(!item.id){warn(report,"Manifest item without an id",item.href||"Unnamed manifest entry");continue}
      if(manifestById.has(item.id))fail(report,"Duplicate manifest id",item.id);
      else manifestById.set(item.id,item);
      if(item.invalid){warn(report,"Manifest path escapes the EPUB root",item.href);continue}
      if(!item.external&&item.path&&!zipHas(zip,item.path)){warn(report,"Manifest resource is missing",item.href);report.stats.brokenRefs++}
    }

    const spineNode=localElements(opf,"spine")[0];
    const spineRefs=spineNode?localElements(spineNode,"itemref"):[];
    report.stats.spine=spineRefs.length;
    if(!spineRefs.length){report.checks.spine="fail";fail(report,"No readable spine was found","The reader has no ordered content to display.")}

    const spineItems=[];
    for(const ref of spineRefs){
      const idref=ref.getAttribute("idref")||"";
      if(!idref){fail(report,"Spine entry is missing idref");continue}
      const item=manifestById.get(idref);
      if(!item){fail(report,"Spine references an unknown manifest id",idref);continue}
      if(item.invalid){fail(report,"Spine resource has an invalid path",item.href);continue}
      if(item.external){fail(report,"Spine content points to an external resource",item.href);continue}
      if(!item.path||!zipHas(zip,item.path)){fail(report,"Spine document is missing",item.href||idref);report.stats.brokenRefs++;continue}
      if(readableTypes.has(item.mediaType)||/\.(?:xhtml?|html?|svg)$/i.test(item.path))spineItems.push(item);
      else warn(report,"Unusual spine media type",`${item.href} (${item.mediaType||"unknown"})`);
    }
    report.stats.readable=spineItems.length;
    if(!spineItems.length)fail(report,"The spine contains no HTML/XHTML/SVG documents");

    let parseableDocs=0;
    for(const item of spineItems){
      const text=await zipText(zip,item.path);
      if(text===null)continue;
      let doc=xmlDocument(text),xmlOkay=!isXmlBroken(doc);
      if(!xmlOkay){
        warn(report,"Malformed XHTML in spine",item.href);
        doc=new DOMParser().parseFromString(text,"text/html");
      }else parseableDocs++;
      for(const ref of collectDocumentRefs(doc)){
        const resolved=resolveLocal(dirname(item.path),ref.value);
        if(resolved.invalid){warn(report,"Content reference escapes the EPUB root",`${item.href} → ${ref.value}`);report.stats.brokenRefs++;continue}
        if(resolved.skip||!resolved.path)continue;
        if(!zipHas(zip,resolved.path)){warn(report,"Broken internal resource reference",`${item.href} → ${ref.value}`);report.stats.brokenRefs++}
      }
    }
    if(spineItems.length&&parseableDocs===0)fail(report,"None of the spine documents parsed as valid XHTML/XML","The browser reader is unlikely to render this EPUB reliably.");
    report.checks.spine=report.fatal.some(x=>/spine|readable|parsed/i.test(x.message))?"fail":"pass";

    const navItems=manifest.filter(item=>item.properties.includes("nav"));
    const spineTocId=spineNode?.getAttribute("toc")||"";
    const ncxItem=(spineTocId&&manifestById.get(spineTocId))||manifest.find(item=>item.mediaType==="application/x-dtbncx+xml");
    if(!navItems.length&&!ncxItem){report.checks.navigation="warn";warn(report,"No EPUB navigation document was found","The book can still open, but the reader table of contents may be empty.")}
    else report.checks.navigation="pass";

    let coverItem=manifest.find(item=>item.properties.includes("cover-image"));
    if(!coverItem){const coverId=metaByName(opf,"cover");if(coverId)coverItem=manifestById.get(coverId)}
    let coverBlob=null,coverExt=".jpg";
    if(!coverItem){report.checks.cover="warn";warn(report,"No cover image is declared","A fallback card will be used in the library.")}
    else if(coverItem.invalid||coverItem.external||!coverItem.path||!zipHas(zip,coverItem.path)){report.checks.cover="warn";warn(report,"Declared cover image is unavailable",coverItem.href||coverItem.id)}
    else{
      report.checks.cover="pass";
      coverExt=mimeExt(coverItem.mediaType,coverItem.href);
      const data=await zip.file(coverItem.path).async("arraybuffer");
      coverBlob=new Blob([data],{type:coverItem.mediaType||mimeForExt(coverExt)});
    }

    const encryptionText=await zipText(zip,"META-INF/encryption.xml");
    if(encryptionText!==null){
      const encryption=xmlDocument(encryptionText);
      if(isXmlBroken(encryption))warn(report,"Malformed encryption metadata","Protected fonts or resources may not render correctly.");
      else{
        const algorithms=localElements(encryption,"EncryptionMethod").map(node=>node.getAttribute("Algorithm")||"").filter(Boolean);
        const unknown=algorithms.filter(value=>!KNOWN_FONT_OBFUSCATION.has(value));
        const known=algorithms.filter(value=>KNOWN_FONT_OBFUSCATION.has(value));
        if(known.length)warn(report,"Obfuscated embedded fonts detected","Text remains readable even if a custom font cannot be decoded.");
        if(unknown.length)fail(report,"Encrypted or DRM-protected resources detected",unknown.slice(0,3).join(", "));
      }
    }
    report.checks.security=report.fatal.some(x=>/DRM|Encrypted/i.test(x.message))?"fail":"pass";

    const smilItems=manifest.filter(item=>item.mediaType==="application/smil+xml"||/\.smil$/i.test(item.path));
    report.stats.mediaOverlays=smilItems.length;
    for(const item of manifest.filter(item=>item.overlay)){
      if(!manifestById.has(item.overlay))warn(report,"Media-overlay reference is missing",`${item.href} → ${item.overlay}`);
    }
    for(const smil of smilItems){
      if(smil.external||smil.invalid||!smil.path||!zipHas(zip,smil.path))continue;
      const text=await zipText(zip,smil.path),doc=xmlDocument(text);
      if(isXmlBroken(doc)){warn(report,"Malformed SMIL media overlay",smil.href);continue}
      for(const node of [...localElements(doc,"text"),...localElements(doc,"audio")]){
        const src=node.getAttribute("src")||"";if(!src)continue;
        const resolved=resolveLocal(dirname(smil.path),src);
        if(resolved.invalid||(!resolved.skip&&resolved.path&&!zipHas(zip,resolved.path))){warn(report,"Broken media-overlay reference",`${smil.href} → ${src}`);report.stats.brokenRefs++}
      }
    }

    finalize(report);
    return{title,author,date,year:parseInt(date.slice(0,4))||"",language,publisher,description,tags,series,number,coverBlob,coverExt,validation:report};
  }

  function statusText(report){
    if(report.status==="fail")return{label:"FAILED",kind:"error",title:"Upload blocked",summary:`${report.fatal.length} blocking issue${report.fatal.length===1?"":"s"} found. Fix the EPUB before adding it to the Garden.`};
    if(report.status==="warning")return{label:"WARNING",kind:"warning",title:"Readable with warnings",summary:`${report.warnings.length} warning${report.warnings.length===1?"":"s"} found. You can still upload this EPUB.`};
    return{label:"PASSED",kind:"ready",title:"Ready for the Garden",summary:"The EPUB passed the reader-focused structural checks."};
  }
  function checkLabel(value){return value==="pass"?"✓":value==="fail"?"×":value==="warn"?"△":"·"}
  function renderPreflight(report){
    const card=$("#preflightCard");if(!card||!report)return;
    const copy=statusText(report),issues=[...report.fatal.map(x=>({...x,severity:"fatal"})),...report.warnings.map(x=>({...x,severity:"warning"}))];
    card.classList.remove("hidden");card.dataset.status=report.status;
    $("#preflightState").textContent=copy.label;$("#preflightState").className=`state-pill ${copy.kind}`;
    $("#preflightTitle").textContent=copy.title;$("#preflightSummary").textContent=copy.summary;
    const checks=[
      ["container","Container"],["package","Package"],["spine","Spine"],["navigation","Navigation"],["cover","Cover"],["security","Security"]
    ];
    $("#preflightChecks").innerHTML=checks.map(([key,label])=>`<span class="preflight-check ${report.checks[key]||"pending"}"><b>${checkLabel(report.checks[key])}</b>${label}</span>`).join("");
    $("#preflightStats").innerHTML=`<span><strong>${report.stats.spine}</strong> spine</span><span><strong>${report.stats.manifest}</strong> resources</span><span><strong>${report.stats.brokenRefs}</strong> broken refs</span>${report.stats.mediaOverlays?`<span><strong>${report.stats.mediaOverlays}</strong> SMIL</span>`:""}`;
    const details=$("#preflightDetails"),summary=$("#preflightDetailsSummary"),list=$("#preflightIssues");
    summary.textContent=issues.length?`Validation details · ${issues.length}`:"Validation details · clean";
    const shown=issues.slice(0,MAX_RENDERED_ISSUES);
    list.innerHTML=shown.length?shown.map(issue=>`<li class="${issue.severity}"><span>${issue.severity==="fatal"?"×":"△"}</span><div><strong>${esc(issue.message)}</strong>${issue.detail?`<small>${esc(issue.detail)}</small>`:""}</div></li>`).join(""):`<li class="clean"><span>✓</span><div><strong>No blocking issues or warnings found.</strong></div></li>`;
    if(issues.length>shown.length)list.insertAdjacentHTML("beforeend",`<li class="warning"><span>…</span><div><strong>${issues.length-shown.length} more findings hidden</strong><small>The report is capped to keep this page responsive.</small></div></li>`);
    details.open=report.status!=="pass";
  }
  function renderChecking(){
    const card=$("#preflightCard");if(!card)return;
    card.classList.remove("hidden");card.dataset.status="checking";
    $("#preflightState").textContent="CHECKING";$("#preflightState").className="state-pill";
    $("#preflightTitle").textContent="Inspecting EPUB structure…";$("#preflightSummary").textContent="Checking the package, spine, navigation, resources, and encryption locally on this device.";
    $("#preflightChecks").innerHTML="";$("#preflightStats").innerHTML="";$("#preflightIssues").innerHTML="";$("#preflightDetails").open=false;
  }

  async function preflightFileChanged(event){
    const file=event.target.files?.[0];if(!file)return;
    state.file=file;state.meta=null;state.coverBlob=null;state.validation=null;
    if($("#audioAlignedInput"))$("#audioAlignedInput").value="";
    $("#uploadButton").disabled=true;$("#uploadButton").textContent="Validating…";$("#openSeries").classList.add("hidden");setUploadState("WAITING");
    setStatus("Waiting for validation","No EPUB data will be uploaded until the local preflight finishes.");
    $("#filePickerTitle").textContent=file.name;$("#filePickerMeta").textContent=`${(file.size/1024/1024).toFixed(1)} MB · Running local preflight…`;setFileState("CHECKING");
    $("#metadataCard").classList.add("hidden");$("#uploadCard").classList.add("hidden");renderChecking();
    if(file.size>50*1024*1024){
      const report=failedReport("File exceeds the 50 MB mobile upload limit",`${(file.size/1024/1024).toFixed(1)} MB selected.`);state.validation=report;renderPreflight(report);setFileState("TOO LARGE","error");$("#filePickerMeta").textContent="This uploader is limited to 50 MB per file.";return;
    }
    try{
      const meta=await inspectEpubWithPreflight(file);state.meta=meta;state.validation=meta.validation;state.coverBlob=meta.coverBlob;state.coverExt=meta.coverExt;
      $("#seriesInput").value=meta.series;$("#volumeInput").value=meta.number;$("#yearInput").value=meta.year;$("#titleInput").value=meta.title;$("#authorInput").value=meta.author;$("#tagsInput").value=meta.tags.join(", ");$("#descriptionInput").value=meta.description;
      $("#previewTitle").textContent=meta.title;$("#previewSeries").textContent=`${meta.series} · Volume ${meta.number}`;
      if(state.coverObjectUrl)URL.revokeObjectURL(state.coverObjectUrl);state.coverObjectUrl="";
      if(meta.coverBlob){state.coverObjectUrl=URL.createObjectURL(meta.coverBlob);$("#coverPreview").src=state.coverObjectUrl;$("#coverPreview").classList.remove("hidden");$("#coverFallback").classList.add("hidden")}else{$("#coverPreview").classList.add("hidden");$("#coverFallback").classList.remove("hidden")}
      renderPreflight(meta.validation);$("#metadataCard").classList.remove("hidden");if(state.unlocked)$("#uploadCard").classList.remove("hidden");
      if(meta.validation.status==="fail"){
        setFileState("FAILED","error");setUploadState("BLOCKED","error");setStatus("Upload blocked","This EPUB has structural problems that are likely to break the reader.","×");$("#uploadButton").disabled=true;$("#uploadButton").textContent="Upload blocked";
      }else if(meta.validation.status==="warning"){
        setFileState("WARNING","warning");setUploadState("READY","warning");setStatus("Warnings found","Review the preflight report, then upload anyway if the issues are acceptable.","△");$("#uploadButton").disabled=false;$("#uploadButton").textContent="Upload Anyway";
      }else{
        setFileState("READY","ready");setUploadState("READY","ready");setStatus("Ready to upload","Preflight passed. The bucket remains private and readers receive files through Cloudflare.","✓");$("#uploadButton").disabled=false;$("#uploadButton").textContent="Upload";
      }
      $("#filePickerMeta").textContent=`${(file.size/1024/1024).toFixed(1)} MB · Preflight ${meta.validation.status==="pass"?"passed":meta.validation.status==="warning"?"completed with warnings":"failed"}`;
    }catch(error){
      console.error(error);const report=error.preflightReport||failedReport("EPUB inspection failed",error.message);state.validation=report;renderPreflight(report);setFileState("INVALID","error");setUploadState("BLOCKED","error");setStatus("Upload blocked",error.message,"×");$("#uploadButton").disabled=true;$("#uploadButton").textContent="Upload blocked";$("#filePickerMeta").textContent=error.message;
    }
  }

  /* Replace admin.js/admin-audio listeners so validation and metadata extraction share one ZIP pass. */
  const oldFile=$("#epubFile");
  if(oldFile){const fileInput=oldFile.cloneNode(true);oldFile.replaceWith(fileInput);fileInput.addEventListener("change",preflightFileChanged)}

  const oldUpload=$("#uploadButton");
  if(oldUpload){
    const uploadButton=oldUpload.cloneNode(true);oldUpload.replaceWith(uploadButton);
    uploadButton.addEventListener("click",()=>{
      if(state.validation?.status==="fail"||!state.meta){alert("This EPUB did not pass the required structural preflight checks.");return}
      uploadBook();
    });
  }
})();
