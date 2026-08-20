const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search),bookUrl=params.get("book"),seriesId=params.get("series"),isAdultReader=String(params.get("series")||"").startsWith("adult-");
const progressKey=`sg-progress:${bookUrl}`,settingsKey="sg-reader-settings",bookmarksKey=`sg-bookmarks:${bookUrl}`;
let book,rendition,currentCfi="",currentChapter="",locationsReady=false,locationsFailed=false,pendingSeek=null,seekTimer,toastTimer;
const defaults={theme:"garden",font:"book",fontSize:100,lineHeight:1.6,width:760,flow:"paginated"};
let settings={...defaults,...readJSON(settingsKey,{})};
function readJSON(k,fallback){try{return JSON.parse(localStorage.getItem(k)||"null")??fallback}catch{return fallback}}
function writeJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp01=n=>Math.min(1,Math.max(0,Number(n)||0));
function toast(msg){$("#toast").textContent=msg;$("#toast").classList.remove("hidden");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.add("hidden"),1800)}
function openDrawer(id){document.querySelectorAll(".reader-drawer").forEach(d=>d.classList.toggle("open",d.id===id));$("#drawerBackdrop").classList.remove("hidden")}
function closeDrawers(){document.querySelectorAll(".reader-drawer").forEach(d=>d.classList.remove("open"));$("#drawerBackdrop").classList.add("hidden")}
function bookmarks(){return readJSON(bookmarksKey,[])}
function renderBookmarks(){
  const list=bookmarks();
  $("#bookmarksPanel").innerHTML=list.length?list.map((b,i)=>`<div class="bookmark-row"><div><div class="bookmark-label">${esc(b.label||"Saved location")}</div><div class="bookmark-meta">${new Date(b.at).toLocaleString()}</div></div><button type="button" data-open="${i}">↗</button><button type="button" data-delete="${i}">×</button></div>`).join(""):`<p class="bookmark-empty">No bookmarks yet.</p>`;
}
function setProgressUI(percentage){
  const p=clamp01(percentage);
  $("#progressRange").value=Math.round(p*1000);
  $("#progressText").textContent=`${Math.round(p*100)}%`;
}
function approximateProgress(location){
  const displayed=location?.start?.displayed;
  const href=(location?.start?.href||"").split("#")[0];
  const items=book?.spine?.spineItems||[];
  if(!items.length)return Number(location?.start?.percentage)||0;
  const index=items.findIndex(item=>{
    const itemHref=String(item?.href||"").split("#")[0];
    return itemHref===href||itemHref.endsWith(href)||href.endsWith(itemHref);
  });
  if(index<0)return Number(location?.start?.percentage)||0;
  const page=Number(displayed?.page)||1,total=Math.max(1,Number(displayed?.total)||1);
  const chapterFraction=clamp01((page-1)/total);
  return clamp01((index+chapterFraction)/items.length);
}
function progressFromLocation(location){
  if(locationsReady&&currentCfi){
    try{
      const exact=book.locations.percentageFromCfi(currentCfi);
      if(Number.isFinite(exact))return clamp01(exact);
    }catch{}
  }
  const reported=Number(location?.start?.percentage);
  if(Number.isFinite(reported)&&reported>0)return clamp01(reported);
  return approximateProgress(location);
}
function saveProgress(location){
  if(!location?.start?.cfi)return;
  currentCfi=location.start.cfi;
  const percentage=progressFromLocation(location);
  const payload={file:bookUrl,cfi:currentCfi,percentage,chapter:currentChapter,title:$("#bookTitle").textContent,updatedAt:Date.now()};
  writeJSON(progressKey,payload);
  setProgressUI(percentage);
}
function rgb(value){
  const m=String(value||"").match(/rgba?\(([^)]+)\)/i);if(!m)return null;
  const parts=m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);if(parts.length<3||parts.slice(0,3).some(n=>!Number.isFinite(n)))return null;
  return{r:parts[0],g:parts[1],b:parts[2],a:Number.isFinite(parts[3])?parts[3]:1};
}
function luminance(c){
  const f=v=>{v=Math.max(0,Math.min(255,v))/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
  return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);
}
function restoreContrast(doc){
  doc.querySelectorAll('[data-sg-contrast="1"]').forEach(el=>{
    const original=el.getAttribute("data-sg-original-color"),priority=el.getAttribute("data-sg-original-priority")||"";
    if(original&&original!=="__none__")el.style.setProperty("color",original,priority);else el.style.removeProperty("color");
    el.removeAttribute("data-sg-contrast");el.removeAttribute("data-sg-original-color");el.removeAttribute("data-sg-original-priority");
  });
}
function forceColor(el,color){
  if(el.getAttribute("data-sg-contrast")==="1")return;
  el.setAttribute("data-sg-contrast","1");
  el.setAttribute("data-sg-original-color",el.style.getPropertyValue("color")||"__none__");
  el.setAttribute("data-sg-original-priority",el.style.getPropertyPriority("color")||"");
  el.style.setProperty("color",color,"important");
}
function fixContentContrast(contents){
  const doc=contents?.document;if(!doc)return;
  restoreContrast(doc);
  if(settings.theme==="paper")return;
  const win=contents.window||doc.defaultView;if(!win)return;
  const candidates=doc.querySelectorAll("body,section,article,aside,div,p,blockquote,figure,figcaption,table,thead,tbody,tfoot,tr,td,th,li,dt,dd,pre,code,span");
  candidates.forEach(el=>{
    const style=win.getComputedStyle(el),bg=rgb(style.backgroundColor);
    if(!bg||bg.a<.2||luminance(bg)<.72)return;
    const text=rgb(style.color);
    if(!text||luminance(text)>.55)forceColor(el,"#17151b");
    el.querySelectorAll("h1,h2,h3,h4,h5,h6,p,span,a,strong,b,em,i,small,code,pre,li,dt,dd,th,td").forEach(child=>{
      const childColor=rgb(win.getComputedStyle(child).color);
      if(childColor&&luminance(childColor)>.62)forceColor(child,"#17151b");
    });
  });
}
function refreshContentContrast(){
  if(!rendition?.getContents)return;
  setTimeout(()=>{try{rendition.getContents().forEach(fixContentContrast)}catch{}},30);
}
function themeCSS(){
  const themes={
    garden:isAdultReader?{bg:"#140d10",text:"#eadde1",link:"#d29aa9"}:{bg:"#120e19",text:"#e8e1f1",link:"#b9a8e3"},
    night:{bg:"#11171a",text:"#d9e0e4",link:"#99bdc8"},
    black:{bg:"#000000",text:"#d7d7d7",link:isAdultReader?"#d29aa9":"#b9a8e3"},
    paper:{bg:"#eee9dc",text:"#292a25",link:"#536e55"}
  },t=themes[settings.theme]||themes.garden;
  const fonts={book:'Georgia, "Times New Roman", serif',system:'Inter, system-ui, sans-serif',classic:'"Palatino Linotype", Palatino, serif'};
  const paginated=settings.flow==="paginated";
  return {
    "html":{"background":`${t.bg} !important`},
    "body":{"background":`${t.bg} !important`,"color":`${t.text} !important`,"font-family":`${fonts[settings.font]} !important`,"font-size":`${settings.fontSize}% !important`,"line-height":`${settings.lineHeight} !important`,"max-width":paginated?"none !important":`${settings.width}px !important`,"width":paginated?"auto !important":"auto !important","margin":paginated?"0 !important":"0 auto !important","padding":"2.5em 4vw !important","box-sizing":"border-box !important"},
    "p":{"line-height":`${settings.lineHeight} !important`},
    "a":{"color":`${t.link} !important`},
    "img":{"max-width":"100% !important","height":"auto !important"}
  };
}
function configureSpread(){
  if(!rendition)return;
  if(settings.flow!=="paginated")rendition.spread("none");
  else rendition.spread("auto",900);
}
function applySettings(redisplay=false){
  document.body.className=`reader-theme-${settings.theme}${isAdultReader?" adult-reader":""}`;
  if(rendition){
    rendition.themes.default(themeCSS());
    rendition.flow(settings.flow);
    configureSpread();
    if(redisplay&&currentCfi)rendition.display(currentCfi);
    refreshContentContrast();
  }
  $("#themeSelect").value=settings.theme;$("#fontSelect").value=settings.font;
  $("#fontSizeRange").value=settings.fontSize;$("#fontSizeValue").textContent=`${settings.fontSize}%`;
  $("#lineHeightRange").value=settings.lineHeight;$("#lineHeightValue").textContent=settings.lineHeight;
  $("#widthRange").value=settings.width;$("#widthValue").textContent=`${settings.width}px`;
  $("#flowSelect").value=settings.flow;
  writeJSON(settingsKey,settings);
}
function bindSettings(){
  ["themeSelect","fontSelect","flowSelect"].forEach(id=>$("#"+id).addEventListener("change",e=>{const key=id==="themeSelect"?"theme":id==="fontSelect"?"font":"flow";settings[key]=e.target.value;applySettings(key==="flow"||key==="theme")}));
  $("#fontSizeRange").addEventListener("input",e=>{settings.fontSize=+e.target.value;applySettings()});
  $("#lineHeightRange").addEventListener("input",e=>{settings.lineHeight=+e.target.value;applySettings()});
  $("#widthRange").addEventListener("input",e=>{settings.width=+e.target.value;applySettings()});
  $("#resetReader").addEventListener("click",()=>{settings={...defaults};applySettings(true);toast("Reader settings reset")});
}
function seekTo(percentage){
  const p=clamp01(percentage);setProgressUI(p);
  if(!locationsReady){pendingSeek=p;if(locationsFailed)toast("Progress seeking is unavailable for this EPUB");return}
  clearTimeout(seekTimer);seekTimer=setTimeout(()=>{
    try{const cfi=book.locations.cfiFromPercentage(p);if(cfi)rendition.display(cfi)}catch(e){console.error(e)}
  },45);
}
async function init(){
  if(!bookUrl){$("#readerLoading").innerHTML="<p>No EPUB file was selected.</p>";return}
  let returnHref="/";
  if(seriesId){
    if(String(seriesId).startsWith("adult-")&&localStorage.getItem("sg-adult-ack")!=="1"){
      const ret=`/reader.html?book=${encodeURIComponent(bookUrl)}&series=${encodeURIComponent(seriesId)}`;
      location.replace(`/nsfw.html?return=${encodeURIComponent(ret)}`);
      return;
    }
    returnHref=`/series.html?id=${encodeURIComponent(seriesId)}`;
  }
  $("#backLink").href=returnHref;$("#returnButton").href=returnHref;
  applySettings();bindSettings();
  try{
    book=ePub(bookUrl);
    rendition=book.renderTo("viewer",{width:"100%",height:"100%",spread:"auto",minSpreadWidth:900,flow:"paginated"});
    rendition.hooks.content.register(contents=>{setTimeout(()=>fixContentContrast(contents),0)});
    applySettings();
    const meta=await book.loaded.metadata;
    $("#bookTitle").textContent=meta.title||"Untitled EPUB";document.title=`${meta.title||"Reader"} — Shadow Garden`;
    const nav=await book.loaded.navigation;
    $("#tocPanel").innerHTML=nav.toc.map(item=>`<button class="toc-link" type="button" data-href="${esc(item.href)}">${esc(item.label.trim())}</button>`).join("");
    $("#tocPanel").addEventListener("click",e=>{const b=e.target.closest("[data-href]");if(!b)return;rendition.display(b.dataset.href);closeDrawers()});
    const saved=readJSON(progressKey,null);if(saved?.percentage)setProgressUI(saved.percentage);
    rendition.on("relocated",loc=>{
      const href=loc.start?.href||"";
      const match=nav.toc.find(x=>href.endsWith(x.href.split("#")[0])||x.href.split("#")[0].endsWith(href));
      currentChapter=match?.label?.trim()||(loc.start?.displayed?.page?`Page ${loc.start.displayed.page}`:"");
      $("#chapterTitle").textContent=currentChapter;
      saveProgress(loc);refreshContentContrast();
    });
    rendition.on("rendered",()=>refreshContentContrast());
    rendition.on("keyup",e=>{if(e.key==="ArrowRight")rendition.next();if(e.key==="ArrowLeft")rendition.prev()});
    const locationsPromise=book.ready.then(()=>book.locations.generate(1200)).then(()=>{
      locationsReady=true;locationsFailed=false;
      const requested=pendingSeek;pendingSeek=null;
      if(requested!=null)seekTo(requested);
      else if(currentCfi){try{setProgressUI(book.locations.percentageFromCfi(currentCfi))}catch{}}
    }).catch(e=>{locationsFailed=true;console.warn("EPUB locations generation failed",e)});
    await rendition.display(saved?.cfi||undefined);
    $("#readerLoading").classList.add("hidden");
    locationsPromise.catch(()=>{});
  }catch(e){console.error(e);$("#readerLoading").innerHTML="<p>Shadow Garden could not open this EPUB.</p>"}
}
$("#tocToggle").addEventListener("click",()=>openDrawer("tocDrawer"));$("#settingsToggle").addEventListener("click",()=>openDrawer("settingsDrawer"));$("#drawerBackdrop").addEventListener("click",closeDrawers);
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawers));
document.querySelector(".drawer-tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;document.querySelectorAll(".drawer-tabs button").forEach(x=>x.classList.toggle("active",x===b));$("#tocPanel").classList.toggle("hidden",b.dataset.panel!=="toc");$("#bookmarksPanel").classList.toggle("hidden",b.dataset.panel!=="bookmarks");if(b.dataset.panel==="bookmarks")renderBookmarks()});
$("#bookmarkButton").addEventListener("click",()=>{if(!currentCfi)return;const list=bookmarks();if(list.some(b=>b.cfi===currentCfi)){toast("This location is already bookmarked");return}list.push({cfi:currentCfi,label:currentChapter||$("#bookTitle").textContent,at:Date.now()});writeJSON(bookmarksKey,list);renderBookmarks();toast("Bookmark saved")});
$("#bookmarksPanel").addEventListener("click",e=>{const o=e.target.closest("[data-open]"),d=e.target.closest("[data-delete]");if(o){const b=bookmarks()[+o.dataset.open];if(b){rendition.display(b.cfi);closeDrawers()}}if(d){const list=bookmarks();list.splice(+d.dataset.delete,1);writeJSON(bookmarksKey,list);renderBookmarks()}});
["prevPage","prevBottom"].forEach(id=>$("#"+id).addEventListener("click",()=>rendition?.prev()));["nextPage","nextBottom"].forEach(id=>$("#"+id).addEventListener("click",()=>rendition?.next()));
$("#progressRange").addEventListener("input",e=>seekTo(+e.target.value/1000));
$("#fullscreenButton").addEventListener("click",()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.());
window.addEventListener("resize",()=>{clearTimeout(window.__sgReaderResize);window.__sgReaderResize=setTimeout(()=>{configureSpread();if(currentCfi)rendition?.display(currentCfi)},120)});
document.addEventListener("keydown",e=>{if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;if(e.key==="ArrowRight")rendition?.next();if(e.key==="ArrowLeft")rendition?.prev();if(e.key==="Escape")closeDrawers();if(e.key.toLowerCase()==="t")openDrawer("tocDrawer")});
init();
