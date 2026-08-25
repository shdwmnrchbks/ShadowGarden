/* Shadow Garden v2.4 — Reader interaction and perceived-loading controller. */

const EXTERNAL_RE=/^(?:https?:)?\/\//i;

function externalHref(anchor){
  const raw=String(anchor?.getAttribute?.("href")||"").trim();
  return EXTERNAL_RE.test(raw)?raw:"";
}

function decorateExternalLinks(doc){
  if(!doc?.documentElement||doc.documentElement.dataset.sgInteractionLinks==="1")return;
  doc.documentElement.dataset.sgInteractionLinks="1";
  const style=doc.createElement?.("style");
  if(style){
    style.id="sg-external-link-affordance";
    style.textContent='.sg-external-link::after{content:" ↗";display:inline-block;margin-inline-start:.12em;font-size:.72em;line-height:1;vertical-align:.16em;opacity:.68;text-decoration:none!important}';
    doc.head?.appendChild(style);
  }
  doc.querySelectorAll?.("a[href]").forEach(anchor=>{
    if(!externalHref(anchor))return;
    anchor.classList.add("sg-external-link");
    if(!anchor.title)anchor.title="External link — opens after confirmation";
  });
}

export function installReaderInteractionController(){
  const loading=document.getElementById("readerLoading");
  const loadingText=loading?.querySelector("p");
  const bookTitle=document.getElementById("bookTitle");
  const progressText=document.getElementById("progressText");
  const viewer=document.getElementById("viewer");
  const mobile=window.matchMedia?.("(max-width:700px)");
  let chromeTimer=0;
  let lastStage="";

  function stage(message,key=message){
    if(!loadingText||loading?.classList.contains("hidden")||lastStage===key)return;
    lastStage=key;
    loading.dataset.stage=key;
    loadingText.textContent=message;
  }

  function chromeBlocked(){
    return Boolean(document.querySelector(".reader-drawer.open,dialog[open],.reader-image-focus:not(.hidden)"));
  }

  function setChromeHidden(hidden){
    document.body.classList.toggle("reader-chrome-hidden",Boolean(hidden&&mobile?.matches));
  }

  function scheduleChromeHide(){
    clearTimeout(chromeTimer);
    if(!mobile?.matches||chromeBlocked()||!loading?.classList.contains("hidden")){setChromeHidden(false);return}
    chromeTimer=setTimeout(()=>{if(!chromeBlocked())setChromeHidden(true)},3200);
  }

  function revealChrome(){
    setChromeHidden(false);
    scheduleChromeHide();
  }

  function attachContentDocument(doc){
    if(!doc?.documentElement||doc.documentElement.dataset.sgInteractionReady==="1")return;
    doc.documentElement.dataset.sgInteractionReady="1";
    decorateExternalLinks(doc);
    doc.addEventListener("pointerdown",revealChrome,{passive:true});
  }

  function attachIframe(frame){
    if(!frame||frame.dataset.sgInteractionFrame==="1")return;
    frame.dataset.sgInteractionFrame="1";
    const attach=()=>{try{attachContentDocument(frame.contentDocument)}catch{}};
    frame.addEventListener("load",attach);
    attach();
  }

  function inspectViewer(){
    viewer?.querySelectorAll?.("iframe").forEach(attachIframe);
    if(viewer?.querySelector?.("iframe"))stage("Laying out the page…","layout");
  }

  document.addEventListener("pointerdown",revealChrome,{passive:true});
  document.addEventListener("focusin",event=>{if(event.target?.closest?.(".reader-topbar,.reader-bottombar,.reader-drawer"))revealChrome()});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)revealChrome()});
  mobile?.addEventListener?.("change",revealChrome);

  if(bookTitle){
    const syncTitle=()=>{const value=String(bookTitle.textContent||"").trim();if(value&&!/^Opening EPUB/i.test(value))stage("Preparing chapters…","metadata")};
    new MutationObserver(syncTitle).observe(bookTitle,{childList:true,characterData:true,subtree:true});
    syncTitle();
  }

  if(progressText){
    const syncMap=()=>{if(/Preparing device page map/i.test(progressText.title||""))stage("Mapping pages for this device…","page-map")};
    new MutationObserver(syncMap).observe(progressText,{attributes:true,attributeFilter:["title"]});
    syncMap();
  }

  if(viewer){new MutationObserver(inspectViewer).observe(viewer,{childList:true,subtree:true});inspectViewer()}
  if(loading)new MutationObserver(()=>{if(loading.classList.contains("hidden"))scheduleChromeHide();else setChromeHidden(false)}).observe(loading,{attributes:true,attributeFilter:["class"]});

  stage("Authorizing the book…","authorize");
  return {stage,revealChrome,decorateExternalLinks};
}
