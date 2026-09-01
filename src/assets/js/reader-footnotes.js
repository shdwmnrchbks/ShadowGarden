/* Shadow Garden v2.8 — EPUB footnote/endnote compatibility layer.
 * Explicit noterefs open in Reader chrome instead of moving the live rendition.
 */
(()=>{
  const previousEpub=window.ePub;
  if(typeof previousEpub!=="function")return;

  const EPUB_NS="http://www.idpf.org/2007/ops";
  const NOTE_REF_CLASSES=new Set(["noteref","note-ref","footnote-ref","endnote-ref"]);
  const LINK_EVENTS=new Set(["link","linkclicked"]);
  let activeBook=null,activeRendition=null,noteOrigin=null,noteSerial=0;

  const cleanText=value=>String(value||"").replace(/\s+/g," ").trim();
  const decode=value=>{try{return decodeURIComponent(value)}catch{return value}};
  const typeTokens=value=>cleanText(value).toLowerCase().split(/\s+/).filter(Boolean);

  function noteDialogElements(){return{
    dialog:document.getElementById("readerNoteDialog"),
    heading:document.getElementById("readerNoteHeading"),
    body:document.getElementById("readerNoteBody"),
    close:document.getElementById("readerNoteClose")
  }}

  function closeNoteDialog({restoreFocus=true}={}){
    const {dialog}=noteDialogElements();
    if(dialog){
      if(dialog.open&&typeof dialog.close==="function")dialog.close();
      else dialog.removeAttribute("open");
    }
    const origin=noteOrigin;noteOrigin=null;
    if(restoreFocus&&origin?.isConnected)requestAnimationFrame(()=>{try{origin.focus({preventScroll:true})}catch{try{origin.focus()}catch{}}});
  }

  function setupNoteDialog(){
    const {dialog,close}=noteDialogElements();
    if(!dialog||dialog.__sgNoteReady)return Boolean(dialog);
    dialog.__sgNoteReady=true;
    close?.addEventListener("click",()=>closeNoteDialog());
    dialog.addEventListener("click",event=>{if(event.target===dialog)closeNoteDialog()});
    dialog.addEventListener("close",()=>{
      const origin=noteOrigin;noteOrigin=null;
      if(origin?.isConnected)requestAnimationFrame(()=>{try{origin.focus({preventScroll:true})}catch{try{origin.focus()}catch{}}});
    });
    return true;
  }

  function showNoteDialog(note,origin){
    if(!setupNoteDialog())return false;
    const {dialog,heading,body,close}=noteDialogElements();
    noteOrigin=origin||null;
    if(heading)heading.textContent=note?.label||"Note";
    if(body){
      body.replaceChildren();
      const paragraphs=Array.isArray(note?.paragraphs)&&note.paragraphs.length?note.paragraphs:["This note could not be displayed."];
      paragraphs.forEach(text=>{const p=document.createElement("p");p.textContent=text;body.appendChild(p)});
    }
    if(typeof dialog.showModal==="function"){
      if(!dialog.open)dialog.showModal();
    }else dialog.setAttribute("open","");
    requestAnimationFrame(()=>close?.focus?.({preventScroll:true}));
    return true;
  }

  function refTokens(anchor){
    const tokens=[];
    const epubType=anchor?.getAttribute?.("epub:type")||anchor?.getAttributeNS?.(EPUB_NS,"type")||"";
    tokens.push(...typeTokens(epubType));
    tokens.push(...typeTokens(anchor?.getAttribute?.("role")));
    tokens.push(...typeTokens(anchor?.getAttribute?.("rel")));
    tokens.push(...typeTokens(anchor?.getAttribute?.("type")));
    try{for(const value of anchor?.classList||[])tokens.push(String(value).toLowerCase())}catch{}
    return new Set(tokens);
  }

  function isNoteReference(anchor){
    if(!anchor?.getAttribute)return false;
    const tokens=refTokens(anchor);
    if(tokens.has("noteref")||tokens.has("doc-noteref")||tokens.has("footnote")||tokens.has("endnote"))return true;
    for(const token of NOTE_REF_CLASSES)if(tokens.has(token))return true;
    return false;
  }

  function internalHref(anchor){
    const raw=String(anchor?.getAttribute?.("href")||"").trim();
    if(!raw||/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(raw))return"";
    return raw;
  }

  function currentSectionFor(contents,renderedSection,book=activeBook){
    if(renderedSection?.href)return renderedSection;
    const index=Number(contents?.sectionIndex);
    const items=book?.spine?.spineItems||[];
    if(Number.isInteger(index)&&index>=0&&items[index])return items[index];
    const canonical=contents?.document?.querySelector?.("link[rel='canonical']")?.getAttribute?.("href")||"";
    if(canonical){
      const found=items.find(item=>sameHref(item?.href,canonical));
      if(found)return found;
    }
    return null;
  }

  function sameHref(a,b){
    const clean=value=>decode(String(value||"").split("#")[0]).replace(/^\.\//,"").replace(/^\//,"");
    const left=clean(a),right=clean(b);
    return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
  }

  function resolveInternalTarget(section,href){
    const text=String(href||"").trim();
    if(!section||!text)return null;
    const hash=text.indexOf("#");
    const rawPath=hash>=0?text.slice(0,hash):text;
    const fragment=hash>=0?decode(text.slice(hash+1)):"";
    let path=section.href||"";
    if(rawPath){
      try{
        const base=new URL(path,"https://shadow-garden.invalid/");
        path=decode(new URL(rawPath,base).pathname.replace(/^\//,""));
      }catch{path=decode(rawPath.replace(/^\.\//,""))}
    }
    return{path,fragment,displayHref:`${path}${fragment?`#${fragment}`:""}`};
  }

  function findSection(book,path,current){
    if(!book||!path)return current||null;
    if(current&&sameHref(current.href,path))return current;
    try{const section=book.spine?.get?.(path);if(section)return section}catch{}
    return(book.spine?.spineItems||[]).find(item=>sameHref(item?.href,path))||null;
  }

  function findFragment(doc,fragment){
    if(!doc||!fragment)return null;
    const id=decode(fragment);
    const byId=doc.getElementById?.(id);if(byId)return byId;
    try{return doc.querySelector?.(`[name="${CSS.escape(id)}"]`)||null}catch{return null}
  }

  function noteLabel(target){
    const tokens=new Set([
      ...typeTokens(target?.getAttribute?.("epub:type")||target?.getAttributeNS?.(EPUB_NS,"type")||""),
      ...typeTokens(target?.getAttribute?.("role"))
    ]);
    if(tokens.has("endnote")||tokens.has("doc-endnote"))return"Endnote";
    if(tokens.has("footnote")||tokens.has("doc-footnote"))return"Footnote";
    return"Note";
  }

  function noteParagraphs(target){
    if(!target)return[];
    const clone=target.cloneNode(true);
    try{
      clone.querySelectorAll?.("a[href]").forEach(link=>{
        const tokens=refTokens(link);
        if(tokens.has("backlink")||tokens.has("doc-backlink"))link.remove();
      });
    }catch{}
    const blocks=[...(clone.querySelectorAll?.("p,li,blockquote,dd")||[])].map(node=>cleanText(node.textContent)).filter(Boolean);
    if(blocks.length)return blocks;
    const text=cleanText(clone.textContent);return text?[text]:[];
  }

  async function loadNote(contents,anchor,renderedSection){
    const book=activeBook,current=currentSectionFor(contents,renderedSection,book),href=internalHref(anchor);
    if(!book||!current||!href)return null;
    const targetInfo=resolveInternalTarget(current,href);
    if(!targetInfo?.fragment)return null;
    const section=findSection(book,targetInfo.path,current);
    if(!section)return null;
    const alreadyLoaded=Boolean(section.document);
    try{
      if(!section.document)await section.load(book.load.bind(book));
      const target=findFragment(section.document,targetInfo.fragment);
      if(!target)return null;
      const paragraphs=noteParagraphs(target);
      if(!paragraphs.length)return null;
      return{label:noteLabel(target),paragraphs,targetHref:targetInfo.displayHref};
    }finally{
      if(!alreadyLoaded&&section!==current){try{section.unload?.()}catch{}}
    }
  }

  async function fallbackToTarget(contents,anchor,renderedSection){
    const current=currentSectionFor(contents,renderedSection),href=internalHref(anchor),target=resolveInternalTarget(current,href);
    if(!activeRendition||!target?.displayHref)return;
    try{await activeRendition.display(target.displayHref)}catch(error){console.warn("Footnote fallback navigation failed",error)}
  }

  function activateNoteReference(contents,anchor,renderedSection){
    const serial=++noteSerial;
    (async()=>{
      try{
        const note=await loadNote(contents,anchor,renderedSection);
        if(serial!==noteSerial)return;
        if(note&&showNoteDialog(note,anchor))return;
      }catch(error){console.warn("Footnote popup unavailable",error)}
      if(serial===noteSerial)await fallbackToTarget(contents,anchor,renderedSection);
    })();
  }

  function canonicalBase(doc){
    const canonical=doc?.querySelector?.("link[rel='canonical']")?.getAttribute?.("href")||"";
    if(canonical){
      try{return new URL(canonical,window.location.href).href}catch{}
    }
    const base=String(doc?.baseURI||"");
    return base&&base!=="about:srcdoc"?base:window.location.href;
  }

  function normalizedLink(value,doc){
    const text=String(value||"").trim();
    if(!text)return"";
    try{return decode(new URL(text,canonicalBase(doc)).href)}catch{return decode(text.replace(/^\.\//,""))}
  }

  function noteAnchorForHref(contents,href){
    const doc=contents?.document||contents?.contentDocument||contents;
    if(!doc?.querySelectorAll)return null;
    const emitted=normalizedLink(href,doc);
    if(!emitted)return null;
    let matches=[];
    try{
      matches=[...doc.querySelectorAll("a[href]")].filter(anchor=>{
        const raw=internalHref(anchor);
        return raw&&normalizedLink(raw,doc)===emitted;
      });
    }catch{return null}
    if(!matches.length)return null;
    const active=doc.activeElement;
    if(active&&matches.includes(active)&&isNoteReference(active))return active;
    const marked=matches.filter(isNoteReference);
    if(marked.length===matches.length)return marked[0]||null;
    // If a publication intentionally uses the same href as both a normal internal link and a
    // noteref, preserve ordinary navigation unless the active element identifies the noteref.
    return null;
  }

  function installNoteGuard(contents,renderedSection){
    const doc=contents?.document||contents?.contentDocument||contents;
    if(!doc?.documentElement||typeof contents?.emit!=="function")return;
    doc.documentElement.dataset.sgFootnotes="1";
    contents.__sgNoteSection=renderedSection||contents.__sgNoteSection||null;
    if(contents.__sgNoteEmitWrapped)return;
    contents.__sgNoteEmitWrapped=true;
    const rawEmit=contents.emit.bind(contents);
    contents.emit=(type,...args)=>{
      const eventName=String(type||"").toLowerCase();
      if(LINK_EVENTS.has(eventName)){
        const anchor=noteAnchorForHref(contents,args[0]);
        if(anchor){
          activateNoteReference(contents,anchor,contents.__sgNoteSection);
          return contents;
        }
      }
      return rawEmit(type,...args);
    };
  }

  function patchRendition(rendition){
    if(!rendition||rendition.__sgFootnotesPatched)return rendition;
    if(activeRendition&&activeRendition!==rendition)closeNoteDialog({restoreFocus:false});
    activeRendition=rendition;rendition.__sgFootnotesPatched=true;
    try{rendition.hooks?.content?.register?.((contents,view)=>installNoteGuard(contents,view?.section))}catch(error){console.warn("EPUB note hook unavailable",error)}
    try{rendition.on?.("rendered",(section,view)=>{
      if(rendition!==activeRendition)return;
      const contents=view?.contents;
      if(contents)installNoteGuard(contents,section);
      else setTimeout(()=>{try{rendition.getContents?.().forEach(contentsItem=>installNoteGuard(contentsItem))}catch{}},0);
    })}catch{}
    return rendition;
  }

  function patchBook(book){
    if(!book)return book;
    activeBook=book;
    if(book.__sgFootnotesPatched)return book;
    book.__sgFootnotesPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options));
    return book;
  }

  function wrappedEpub(...args){return patchBook(previousEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,previousEpub)}catch{}
  try{wrappedEpub.prototype=previousEpub.prototype}catch{}
  window.ePub=wrappedEpub;

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setupNoteDialog,{once:true});
  else setupNoteDialog();
})();
