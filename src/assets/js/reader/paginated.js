/* Shadow Garden R4 — Paginated-mode navigation adapter. */
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

function cleanHref(value){
  let href=String(value||"").split("#")[0].split("?")[0];
  try{href=decodeURIComponent(href)}catch{}
  return href.replace(/^\.\//,"").replace(/^\//,"");
}

function hrefMatches(a,b){
  const left=cleanHref(a),right=cleanHref(b);
  return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
}

function linearSpine(rendition){
  const raw=rendition?.book?.spine?.spineItems||[];
  const linear=raw.filter(item=>item?.href&&item.linear!=="no");
  return linear.length?linear:raw.filter(item=>item?.href);
}

function onFinalSpineItem(rendition){
  const items=linearSpine(rendition),last=items[items.length-1];
  const location=rendition?.location,start=location?.start||{},end=location?.end||{};
  const href=end.href||start.href;
  return Boolean(last?.href&&hrefMatches(href,last.href));
}

function locationKey(rendition){
  const location=rendition?.location||{},start=location.start||{},end=location.end||{};
  const manager=rendition?.manager;
  return[
    cleanHref(start.href),String(start.cfi||""),Number(start.displayed?.page)||0,Number(start.displayed?.total)||0,
    cleanHref(end.href),String(end.cfi||""),Number(end.displayed?.page)||0,Number(end.displayed?.total)||0,
    Number(manager?.scrollLeft)||0,Number(manager?.scrollTop)||0
  ].join("|");
}

function showEndPage(){
  const page=document.getElementById("volumeEndPage");
  if(!page||!document.body.classList.contains("reader-flow-paginated"))return false;
  page.classList.remove("hidden");page.classList.add("active");
  requestAnimationFrame(()=>page.querySelector("a:not(.hidden)")?.focus?.({preventScroll:true}));
  return true;
}

export function createPaginatedController({getRendition,beforeTurn}={}){
  async function turn(direction){
    const rendition=getRendition?.();if(!rendition)return false;
    beforeTurn?.();
    if(direction<0){await rendition.prev?.();return true}

    /* EPUB.js does not report `location.atEnd` consistently on narrow Chromium viewports.
       When Next resolves without changing any rendered-location signal while the Reader is
       already in the final linear spine item, that is the stable cross-browser definition of
       "next past the last page". Keep the normal final-page turn first; only reveal the
       completion page after a terminal no-op. */
    const wasFinalSpine=onFinalSpineItem(rendition),before=locationKey(rendition);
    await rendition.next?.();
    await paint();
    if(wasFinalSpine&&before&&locationKey(rendition)===before)showEndPage();
    return true;
  }
  return{turn};
}
