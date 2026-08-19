const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search),bookUrl=params.get("book"),seriesId=params.get("series"),isAdultReader=String(params.get("series")||"").startsWith("adult-");
const progressKey=`sg-progress:${bookUrl}`,settingsKey="sg-reader-settings",bookmarksKey=`sg-bookmarks:${bookUrl}`;
let book,rendition,currentCfi="",currentChapter="",locationsReady=false,toastTimer;
const defaults={theme:"garden",font:"book",fontSize:100,lineHeight:1.6,width:760,flow:"paginated"};
let settings={...defaults,...readJSON(settingsKey,{})};
function readJSON(k,fallback){try{return JSON.parse(localStorage.getItem(k)||"null")??fallback}catch{return fallback}}
function writeJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(msg){$("#toast").textContent=msg;$("#toast").classList.remove("hidden");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.add("hidden"),1800)}
function openDrawer(id){document.querySelectorAll(".reader-drawer").forEach(d=>d.classList.toggle("open",d.id===id));$("#drawerBackdrop").classList.remove("hidden")}
function closeDrawers(){document.querySelectorAll(".reader-drawer").forEach(d=>d.classList.remove("open"));$("#drawerBackdrop").classList.add("hidden")}
function bookmarks(){return readJSON(bookmarksKey,[])}
function renderBookmarks(){
  const list=bookmarks();
  $("#bookmarksPanel").innerHTML=list.length?list.map((b,i)=>`<div class="bookmark-row"><div><div class="bookmark-label">${esc(b.label||"Saved location")}</div><div class="bookmark-meta">${new Date(b.at).toLocaleString()}</div></div><button type="button" data-open="${i}">↗</button><button type="button" data-delete="${i}">×</button></div>`).join(""):`<p style="color:#6f7a72;padding:12px;font-size:.76rem">No bookmarks yet.</p>`;
}
function saveProgress(location){
  if(!location?.start?.cfi)return;
  currentCfi=location.start.cfi;
  const percentage=locationsReady?book.locations.percentageFromCfi(currentCfi):(location.start.percentage||0);
  const payload={file:bookUrl,cfi:currentCfi,percentage:Number.isFinite(percentage)?percentage:0,chapter:currentChapter,title:$("#bookTitle").textContent,updatedAt:Date.now()};
  writeJSON(progressKey,payload);
  $("#progressRange").value=Math.round(payload.percentage*1000);
  $("#progressText").textContent=`${Math.round(payload.percentage*100)}%`;
}
function themeCSS(){
  const themes={
    garden:isAdultReader?{bg:"#140d10",text:"#eadde1",link:"#d29aa9"}:{bg:"#120e19",text:"#e8e1f1",link:"#b9a8e3"},
    night:{bg:"#11171a",text:"#d9e0e4",link:"#99bdc8"},
    black:{bg:"#000000",text:"#d7d7d7",link:isAdultReader?"#d29aa9":"#b9a8e3"},
    paper:{bg:"#eee9dc",text:"#292a25",link:"#536e55"}
  },t=themes[settings.theme]||themes.garden;
  const fonts={book:'Georgia, "Times New Roman", serif',system:'Inter, system-ui, sans-serif',classic:'"Palatino Linotype", Palatino, serif'};
  return {
    "body":{"background":`${t.bg} !important`,"color":`${t.text} !important`,"font-family":`${fonts[settings.font]} !important`,"font-size":`${settings.fontSize}% !important`,"line-height":`${settings.lineHeight} !important`,"max-width":`${settings.width}px !important`,"margin":"0 auto !important","padding":"2.5em 4vw !important","box-sizing":"border-box !important"},
    "p":{"line-height":`${settings.lineHeight} !important`},
    "a":{"color":`${t.link} !important`},
    "img":{"max-width":"100% !important","height":"auto !important"}
  };
}
function applySettings(redisplay=false){
  document.body.className=`reader-theme-${settings.theme}${isAdultReader?" adult-reader":""}`;
  if(rendition){
    rendition.themes.default(themeCSS());
    rendition.flow(settings.flow);
    if(redisplay&&currentCfi)rendition.display(currentCfi);
  }
  $("#themeSelect").value=settings.theme;$("#fontSelect").value=settings.font;
  $("#fontSizeRange").value=settings.fontSize;$("#fontSizeValue").textContent=`${settings.fontSize}%`;
  $("#lineHeightRange").value=settings.lineHeight;$("#lineHeightValue").textContent=settings.lineHeight;
  $("#widthRange").value=settings.width;$("#widthValue").textContent=`${settings.width}px`;
  $("#flowSelect").value=settings.flow;
  writeJSON(settingsKey,settings);
}
function bindSettings(){
  ["themeSelect","fontSelect","flowSelect"].forEach(id=>$("#"+id).addEventListener("change",e=>{const key=id==="themeSelect"?"theme":id==="fontSelect"?"font":"flow";settings[key]=e.target.value;applySettings(key==="flow")}));
  $("#fontSizeRange").addEventListener("input",e=>{settings.fontSize=+e.target.value;applySettings()});
  $("#lineHeightRange").addEventListener("input",e=>{settings.lineHeight=+e.target.value;applySettings()});
  $("#widthRange").addEventListener("input",e=>{settings.width=+e.target.value;applySettings()});
  $("#resetReader").addEventListener("click",()=>{settings={...defaults};applySettings(true);toast("Reader settings reset")});
}
async function init(){
  if(!bookUrl){$("#readerLoading").innerHTML="<p>No EPUB file was selected.</p>";return}
  if(seriesId){
    if(String(seriesId).startsWith("adult-")&&localStorage.getItem("sg-adult-ack")!=="1"){
      const ret=`/reader.html?book=${encodeURIComponent(bookUrl)}&series=${encodeURIComponent(seriesId)}`;
      location.replace(`/nsfw.html?return=${encodeURIComponent(ret)}`);
      return;
    }
    $("#backLink").href=`/series.html?id=${encodeURIComponent(seriesId)}`;
  }
  applySettings();bindSettings();
  try{
    book=ePub(bookUrl);
    rendition=book.renderTo("viewer",{width:"100%",height:"100%",spread:"auto",minSpreadWidth:850});
    applySettings();
    const meta=await book.loaded.metadata;
    $("#bookTitle").textContent=meta.title||"Untitled EPUB";document.title=`${meta.title||"Reader"} — Shadow Garden`;
    const nav=await book.loaded.navigation;
    $("#tocPanel").innerHTML=nav.toc.map(item=>`<button class="toc-link" type="button" data-href="${esc(item.href)}">${esc(item.label.trim())}</button>`).join("");
    $("#tocPanel").addEventListener("click",e=>{const b=e.target.closest("[data-href]");if(!b)return;rendition.display(b.dataset.href);closeDrawers()});
    const saved=readJSON(progressKey,null);
    await rendition.display(saved?.cfi||undefined);
    rendition.on("relocated",loc=>{
      const href=loc.start?.href||"";
      const match=nav.toc.find(x=>href.endsWith(x.href.split("#")[0])||x.href.split("#")[0].endsWith(href));
      currentChapter=match?.label?.trim()||(loc.start?.displayed?.page?`Page ${loc.start.displayed.page}`:"");
      $("#chapterTitle").textContent=currentChapter;
      saveProgress(loc);
    });
    rendition.on("keyup",e=>{if(e.key==="ArrowRight")rendition.next();if(e.key==="ArrowLeft")rendition.prev()});
    $("#readerLoading").classList.add("hidden");
    book.ready.then(()=>book.locations.generate(1400)).then(()=>{locationsReady=true;const p=readJSON(progressKey,null);if(p?.cfi){p.percentage=book.locations.percentageFromCfi(p.cfi);writeJSON(progressKey,p);$("#progressRange").value=Math.round(p.percentage*1000);$("#progressText").textContent=`${Math.round(p.percentage*100)}%`}}).catch(()=>{});
  }catch(e){console.error(e);$("#readerLoading").innerHTML="<p>Shadow Garden could not open this EPUB.</p>"}
}
$("#tocToggle").addEventListener("click",()=>openDrawer("tocDrawer"));$("#settingsToggle").addEventListener("click",()=>openDrawer("settingsDrawer"));$("#drawerBackdrop").addEventListener("click",closeDrawers);
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawers));
document.querySelector(".drawer-tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;document.querySelectorAll(".drawer-tabs button").forEach(x=>x.classList.toggle("active",x===b));$("#tocPanel").classList.toggle("hidden",b.dataset.panel!=="toc");$("#bookmarksPanel").classList.toggle("hidden",b.dataset.panel!=="bookmarks");if(b.dataset.panel==="bookmarks")renderBookmarks()});
$("#bookmarkButton").addEventListener("click",()=>{if(!currentCfi)return;const list=bookmarks();if(list.some(b=>b.cfi===currentCfi)){toast("This location is already bookmarked");return}list.push({cfi:currentCfi,label:currentChapter||$("#bookTitle").textContent,at:Date.now()});writeJSON(bookmarksKey,list);renderBookmarks();toast("Bookmark saved")});
$("#bookmarksPanel").addEventListener("click",e=>{const o=e.target.closest("[data-open]"),d=e.target.closest("[data-delete]");if(o){const b=bookmarks()[+o.dataset.open];if(b){rendition.display(b.cfi);closeDrawers()}}if(d){const list=bookmarks();list.splice(+d.dataset.delete,1);writeJSON(bookmarksKey,list);renderBookmarks()}});
["prevPage","prevBottom"].forEach(id=>$("#"+id).addEventListener("click",()=>rendition?.prev()));["nextPage","nextBottom"].forEach(id=>$("#"+id).addEventListener("click",()=>rendition?.next()));
$("#progressRange").addEventListener("change",e=>{if(!locationsReady)return;const cfi=book.locations.cfiFromPercentage(+e.target.value/1000);if(cfi)rendition.display(cfi)});
$("#fullscreenButton").addEventListener("click",()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.());
document.addEventListener("keydown",e=>{if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;if(e.key==="ArrowRight")rendition?.next();if(e.key==="ArrowLeft")rendition?.prev();if(e.key==="Escape")closeDrawers();if(e.key.toLowerCase()==="t")openDrawer("tocDrawer")});
init();
