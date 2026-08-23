/* Shadow Garden v1.15.0 — browser-local reading completion state. */
(()=>{
  const KEY="sg-finished-books";
  const EVENT="sg-reading-status-changed";

  if(!document.querySelector('link[data-reading-status-style]')){
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="/assets/css/reading-status.css?v=1.15.0";
    link.dataset.readingStatusStyle="1";
    document.head.appendChild(link);
  }

  function load(){
    try{
      const value=JSON.parse(localStorage.getItem(KEY)||"{}");
      if(Array.isArray(value))return Object.fromEntries(value.filter(Boolean).map(id=>[String(id),Date.now()]));
      return value&&typeof value==="object"?value:{};
    }catch{return{}}
  }
  function save(value){
    try{localStorage.setItem(KEY,JSON.stringify(value));return true}catch(error){console.warn("Shadow Garden could not persist reading completion",error);return false}
  }
  function cleanId(value){return String(value||"").trim()}
  function isFinished(bookId){const id=cleanId(bookId);return Boolean(id&&load()[id])}
  function setFinished(bookId,finished=true){
    const id=cleanId(bookId);if(!id)return false;
    const state=load();
    if(finished)state[id]=Date.now();else delete state[id];
    const ok=save(state);
    if(ok)window.dispatchEvent(new CustomEvent(EVENT,{detail:{bookId:id,finished:Boolean(finished)}}));
    return ok;
  }
  function finishedCount(series){return (Array.isArray(series?.volumes)?series.volumes:[]).filter(volume=>isFinished(volume?.file)).length}
  function seriesFinished(series){const volumes=Array.isArray(series?.volumes)?series.volumes:[];return volumes.length>0&&finishedCount(series)===volumes.length}

  window.ShadowGardenReadingStatus={KEY,EVENT,load,isFinished,setFinished,finishedCount,seriesFinished};
})();
