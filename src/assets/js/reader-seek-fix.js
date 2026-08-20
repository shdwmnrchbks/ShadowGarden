/* Robust progress seeking: use generated CFIs when available and a spine fallback otherwise. */
(()=>{
  const range=document.querySelector("#progressRange");
  if(!range)return;

  let robustSeekTimer=0,seekSerial=0;

  function spineTarget(percentage){
    const raw=book?.spine?.spineItems||[];
    const linear=raw.filter(item=>item?.href&&item.linear!=="no");
    const items=linear.length?linear:raw.filter(item=>item?.href);
    if(!items.length)return"";
    const p=Math.min(1,Math.max(0,Number(percentage)||0));
    const index=p>=1?items.length-1:Math.min(items.length-1,Math.floor(p*items.length));
    return items[index]?.href||"";
  }

  async function navigateToPercentage(percentage){
    if(!book||!rendition)return;
    const p=Math.min(1,Math.max(0,Number(percentage)||0));
    const serial=++seekSerial;

    if(locationsReady&&book.locations){
      try{
        const cfi=book.locations.cfiFromPercentage(p);
        if(cfi){
          await rendition.display(cfi);
          return;
        }
      }catch(error){console.warn("Exact progress seek failed; using spine fallback",error)}
    }

    if(serial!==seekSerial)return;
    const href=spineTarget(p);
    if(!href)return;
    try{await rendition.display(href)}catch(error){console.error("Progress seek failed",error)}
  }

  seekTo=function(percentage,immediate=false){
    const p=Math.min(1,Math.max(0,Number(percentage)||0));
    setProgressUI(p);
    if(!locationsReady)pendingSeek=p;else pendingSeek=null;
    clearTimeout(robustSeekTimer);
    if(immediate)navigateToPercentage(p);
    else robustSeekTimer=setTimeout(()=>navigateToPercentage(p),140);
  };

  /* The original input listener resolves seekTo at event time, so it now uses the robust function above. */
  range.addEventListener("change",event=>seekTo(+event.target.value/1000,true));
  range.addEventListener("pointerup",event=>seekTo(+event.target.value/1000,true));
  range.addEventListener("touchend",event=>seekTo(+event.currentTarget.value/1000,true),{passive:true});
})();
