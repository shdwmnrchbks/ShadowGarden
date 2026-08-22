/* Shadow Garden v1.6.0 — desktop mouse-wheel page turns in Paginated mode. */
(()=>{
  const shell=document.getElementById('viewerShell');
  if(!shell)return;
  const finePointer=window.matchMedia('(pointer:fine)');
  const desktop=window.matchMedia('(min-width: 900px)');
  let accumulated=0,lastTurn=0;

  function enabled(){return finePointer.matches&&desktop.matches&&document.body.classList.contains('reader-flow-paginated')}
  function normalizeDelta(event){
    let delta=event.deltaY;
    if(event.deltaMode===1)delta*=18;
    else if(event.deltaMode===2)delta*=window.innerHeight;
    return delta;
  }
  function handleWheel(event){
    if(!enabled()||event.ctrlKey||event.metaKey)return;
    const vertical=normalizeDelta(event);
    if(Math.abs(vertical)<Math.abs(event.deltaX||0))return;
    event.preventDefault();
    const now=performance.now();
    if(now-lastTurn<190)return;
    accumulated+=vertical;
    if(Math.abs(accumulated)<48)return;
    const forward=accumulated>0;
    accumulated=0;
    lastTurn=now;
    document.getElementById(forward?'nextPage':'prevPage')?.click();
  }

  function attachDocument(doc){
    if(!doc||doc.documentElement?.dataset.sgWheelPages==='1')return;
    try{
      doc.documentElement.dataset.sgWheelPages='1';
      doc.addEventListener('wheel',handleWheel,{passive:false,capture:true});
    }catch{}
  }
  function attachFrame(frame){
    const attach=()=>{try{attachDocument(frame.contentDocument)}catch{}};
    attach();
    frame.addEventListener('load',attach);
  }
  function scanFrames(){document.querySelectorAll('#viewer iframe').forEach(attachFrame)}

  shell.addEventListener('wheel',handleWheel,{passive:false,capture:true});
  const observer=new MutationObserver(scanFrames);
  observer.observe(document.getElementById('viewer')||shell,{childList:true,subtree:true});
  scanFrames();
})();
