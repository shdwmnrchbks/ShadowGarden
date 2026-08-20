/* Normalize pointer interaction for the vertical Continuous-mode seek rail.
 * Native vertical <input type="range"> behavior differs across desktop/mobile browsers,
 * so pointer position is converted to an explicit 0..1000 value before forwarding the
 * normal input/change events to the existing reader seek engine.
 */
(()=>{
  let activePointer=null;
  let activeRange=null;

  function continuousRange(target){
    const range=target?.closest?.("#progressRange");
    if(!range||!document.body?.classList.contains("reader-flow-scrolled"))return null;
    return range;
  }

  function valueFromPointer(range,clientY){
    const rect=range.getBoundingClientRect();
    if(!rect.height)return Number(range.value||0)/1000;
    const percentage=Math.min(1,Math.max(0,(clientY-rect.top)/rect.height));
    return percentage;
  }

  function setRailValue(range,percentage){
    const value=Math.round(Math.min(1,Math.max(0,percentage))*1000);
    range.value=String(value);
    const text=document.getElementById("progressText");
    if(text)text.textContent=`${Math.round(value/10)}%`;
  }

  function forward(range,type){
    range.dispatchEvent(new Event(type,{bubbles:true}));
  }

  document.addEventListener("pointerdown",event=>{
    const range=continuousRange(event.target);
    if(!range)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activePointer=event.pointerId;
    activeRange=range;
    try{range.setPointerCapture?.(event.pointerId)}catch{}
    const percentage=valueFromPointer(range,event.clientY);
    setRailValue(range,percentage);
    forward(range,"input");
  },true);

  document.addEventListener("pointermove",event=>{
    if(activePointer===null||event.pointerId!==activePointer||!activeRange)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const percentage=valueFromPointer(activeRange,event.clientY);
    setRailValue(activeRange,percentage);
    forward(activeRange,"input");
  },true);

  document.addEventListener("pointerup",event=>{
    if(activePointer===null||event.pointerId!==activePointer||!activeRange)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const range=activeRange;
    const percentage=valueFromPointer(range,event.clientY);
    setRailValue(range,percentage);
    activePointer=null;
    activeRange=null;
    try{range.releasePointerCapture?.(event.pointerId)}catch{}
    forward(range,"change");
  },true);

  document.addEventListener("pointercancel",event=>{
    if(activePointer===null||event.pointerId!==activePointer)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const range=activeRange;
    activePointer=null;
    activeRange=null;
    try{range?.releasePointerCapture?.(event.pointerId)}catch{}
  },true);

  /* Suppress the browser's follow-up native range click after our pointer sequence. */
  document.addEventListener("click",event=>{
    if(!continuousRange(event.target))return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
})();
