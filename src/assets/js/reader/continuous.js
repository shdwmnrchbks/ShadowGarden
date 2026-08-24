/* Shadow Garden R4 — Continuous-mode navigation adapter. */
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

export function createContinuousController({getRendition,beforeNavigate}={}){
  async function display(target,{settle=true}={}){
    const rendition=getRendition?.();if(!rendition||!target)return false;
    beforeNavigate?.();
    await rendition.display(target);
    if(settle){await nextPaint();if(rendition===getRendition?.())await rendition.display(target)}
    return true;
  }
  return{display};
}
