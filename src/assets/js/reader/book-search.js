/* Shadow Garden v2.8 Slice 4 — bounded in-book EPUB text search. */
const MIN_QUERY_LENGTH=3;
const MAX_RESULTS=100;
const EXCERPT_RADIUS=78;
const SHOW_TEXT=4;

export function normalizeBookSearchQuery(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

export function buildBookSearchPattern(value){
  const query=normalizeBookSearchQuery(value);
  if(query.length<MIN_QUERY_LENGTH)return null;
  const escaped=query.split(" ").map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
  return new RegExp(escaped.join("\\s+"),"gi");
}

function searchableTextNodes(document){
  const root=document?.body||document?.documentElement;
  if(!root||typeof document.createTreeWalker!=="function")return[];
  const walker=document.createTreeWalker(root,SHOW_TEXT);
  const nodes=[];
  let node;
  while((node=walker.nextNode())){
    const parent=node.parentElement;
    if(!node.nodeValue||!node.nodeValue.trim())continue;
    if(parent?.closest?.("script,style,noscript,svg"))continue;
    nodes.push(node);
  }
  return nodes;
}

function sectionTextMap(document){
  const chunks=[];
  let text="";
  for(const node of searchableTextNodes(document)){
    if(text)text+=" ";
    const start=text.length,value=node.nodeValue||"";
    text+=value;
    chunks.push({node,start,end:start+value.length});
  }
  return{text,chunks};
}

function rangePosition(chunks,index,{end=false}={}){
  for(let i=0;i<chunks.length;i++){
    const chunk=chunks[i];
    if(index>=chunk.start&&index<chunk.end)return{node:chunk.node,offset:index-chunk.start};
    if(end&&index===chunk.end)return{node:chunk.node,offset:chunk.end-chunk.start};
    if(index<chunk.start){
      const target=end?chunks[Math.max(0,i-1)]:chunk;
      return{node:target.node,offset:end?target.end-target.start:0};
    }
  }
  const last=chunks[chunks.length-1];
  return last?{node:last.node,offset:last.end-last.start}:null;
}

function excerptFor(text,start,end){
  const from=Math.max(0,start-EXCERPT_RADIUS),to=Math.min(text.length,end+EXCERPT_RADIUS);
  const excerpt=text.slice(from,to).replace(/\s+/g," ").trim();
  return`${from>0?"…":""}${excerpt}${to<text.length?"…":""}`;
}

export function findSectionMatches(section,query,limit=MAX_RESULTS){
  const pattern=buildBookSearchPattern(query);
  const document=section?.document;
  if(!pattern||!document||limit<=0)return[];
  const{text,chunks}=sectionTextMap(document);
  if(!text||!chunks.length)return[];
  const matches=[];
  let match;
  while(matches.length<limit&&(match=pattern.exec(text))){
    const start=rangePosition(chunks,match.index),lastIndex=match.index+Math.max(1,match[0].length)-1,end=rangePosition(chunks,lastIndex);
    if(start&&end){
      try{
        const range=document.createRange();
        range.setStart(start.node,start.offset);
        range.setEnd(end.node,end.offset+1);
        matches.push({cfi:section.cfiFromRange(range),excerpt:excerptFor(text,match.index,match.index+match[0].length)});
      }catch(error){console.warn("Book search match skipped",error)}
    }
    if(match[0].length===0)pattern.lastIndex+=1;
  }
  return matches;
}

function resultLabel(count,capped){
  if(!count)return"No matches in this book.";
  if(capped)return`${count}+ matches · Refine your search for more precise results.`;
  return`${count} ${count===1?"match":"matches"} in this book.`;
}

export function createBookSearchController({drawer,form,input,status,results,getBook,getChapter,navigate,closeDrawers,toast}={}){
  let runId=0;
  let busy=false;

  function setStatus(message){if(status)status.textContent=message}
  function clearResults(){results?.replaceChildren()}
  function cancel(){if(busy)runId+=1;busy=false}
  function focus(){queueMicrotask(()=>input?.focus())}

  function renderResult(hit,index){
    const button=document.createElement("button");
    button.type="button";
    button.className="book-search-result";
    button.dataset.cfi=hit.cfi;
    const chapter=document.createElement("span");
    chapter.className="book-search-result-chapter";
    chapter.textContent=hit.chapter||`Result ${index+1}`;
    const excerpt=document.createElement("span");
    excerpt.className="book-search-result-excerpt";
    excerpt.textContent=hit.excerpt||"Matching text";
    button.append(chapter,excerpt);
    button.addEventListener("click",async()=>{
      try{await navigate?.(hit.cfi);closeDrawers?.()}catch(error){console.error("Book search navigation failed",error);toast?.("Could not open search result")}
    });
    return button;
  }

  async function search(rawQuery){
    const query=normalizeBookSearchQuery(rawQuery);
    if(query.length<MIN_QUERY_LENGTH){cancel();clearResults();setStatus(`Enter at least ${MIN_QUERY_LENGTH} characters.`);return[]}
    const book=getBook?.();
    const sections=Array.isArray(book?.spine?.spineItems)?book.spine.spineItems:[];
    if(!book||!sections.length){clearResults();setStatus("Book search is unavailable for this EPUB.");return[]}

    const id=++runId,hits=[];
    busy=true;clearResults();setStatus(`Searching ${sections.length} book sections…`);
    for(let index=0;index<sections.length&&hits.length<MAX_RESULTS;index++){
      if(id!==runId)return[];
      const section=sections[index];
      const wasLoaded=Boolean(section?.contents);
      try{
        await section.load(book.load.bind(book));
        if(id!==runId)return[];
        const remaining=MAX_RESULTS-hits.length;
        const matches=findSectionMatches(section,query,remaining);
        const location={start:{href:section.href||"",index:Number(section.index)}};
        const chapter=String(getChapter?.(location)||"").trim()||String(section.href||`Section ${index+1}`);
        for(const match of matches)hits.push({...match,chapter,href:section.href||"",sectionIndex:Number(section.index)});
      }catch(error){console.warn(`Book search skipped section ${section?.href||index}`,error)}finally{
        if(!wasLoaded){try{section?.unload?.()}catch{}}
      }
      if(id===runId)setStatus(`Searching ${Math.min(index+1,sections.length)} of ${sections.length}… ${hits.length} ${hits.length===1?"match":"matches"}`);
      await Promise.resolve();
    }
    if(id!==runId)return[];
    busy=false;
    const capped=hits.length>=MAX_RESULTS;
    const fragment=document.createDocumentFragment();
    hits.forEach((hit,index)=>fragment.appendChild(renderResult(hit,index)));
    results?.replaceChildren(fragment);
    setStatus(resultLabel(hits.length,capped));
    return hits;
  }

  form?.addEventListener("submit",event=>{event.preventDefault();void search(input?.value||"")});
  input?.addEventListener("keydown",event=>{
    if(event.key!=="Escape")return;
    event.preventDefault();
    if(input.value||results?.childElementCount){cancel();input.value="";clearResults();setStatus("Search this book for a word or phrase.");return}
    closeDrawers?.();
  });

  return{search,cancel,focus,isBusy:()=>busy};
}
