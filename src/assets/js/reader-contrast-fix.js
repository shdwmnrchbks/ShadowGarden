/* Shadow Garden reader contrast repair v2.
 * Preserve EPUB-authored backgrounds. Only repair foreground text when the
 * effective background behind that text would otherwise make it unreadable.
 */
(()=>{
  const DARK_TEXT="#17151b";
  const LIGHT_TEXT="#f1edf6";
  const SKIP=new Set(["SCRIPT","STYLE","NOSCRIPT","IMG","VIDEO","AUDIO","CANVAS","SVG","MATH","IFRAME","OBJECT","EMBED"]);

  function parseColor(value){
    const text=String(value||"").trim();
    if(!text||text==="transparent")return null;
    const m=text.match(/^rgba?\(([^)]+)\)$/i);
    if(!m)return null;
    const parts=m[1].replace(/\//g," ").split(/[\s,]+/).filter(Boolean);
    if(parts.length<3)return null;
    const channel=v=>String(v).endsWith("%")?Math.max(0,Math.min(255,parseFloat(v)*2.55)):Math.max(0,Math.min(255,parseFloat(v)));
    const r=channel(parts[0]),g=channel(parts[1]),b=channel(parts[2]);
    if(![r,g,b].every(Number.isFinite))return null;
    let a=1;
    if(parts[3]!=null){a=String(parts[3]).endsWith("%")?parseFloat(parts[3])/100:parseFloat(parts[3]);if(!Number.isFinite(a))a=1}
    return{r,g,b,a:Math.max(0,Math.min(1,a))};
  }

  function solid(hex){
    const n=parseInt(hex.slice(1),16);
    return{r:(n>>16)&255,g:(n>>8)&255,b:n&255,a:1};
  }

  function composite(top,bottom){
    const a=top.a+bottom.a*(1-top.a);
    if(a<=0)return{r:0,g:0,b:0,a:0};
    return{
      r:(top.r*top.a+bottom.r*bottom.a*(1-top.a))/a,
      g:(top.g*top.a+bottom.g*bottom.a*(1-top.a))/a,
      b:(top.b*top.a+bottom.b*bottom.a*(1-top.a))/a,
      a
    };
  }

  function relativeLuminance(c){
    const f=v=>{const x=Math.max(0,Math.min(255,v))/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};
    return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);
  }

  function contrast(a,b){
    const l1=relativeLuminance(a),l2=relativeLuminance(b);
    return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
  }

  function themeBase(){
    if(settings?.theme==="paper")return solid("#eee9dc");
    if(settings?.theme==="night")return solid("#11171a");
    if(settings?.theme==="black")return solid("#000000");
    return solid(isAdultReader?"#140d10":"#120e19");
  }

  function effectiveBackground(el,win){
    const chain=[];
    for(let node=el;node&&node.nodeType===1;node=node.parentElement)chain.push(node);
    chain.reverse();
    let result=themeBase();
    for(const node of chain){
      const style=win.getComputedStyle(node);
      const bg=parseColor(style.backgroundColor);
      if(bg&&bg.a>0)result=composite(bg,result);
    }
    return result;
  }

  function hasDirectText(el){
    for(const node of el.childNodes){
      if(node.nodeType===3&&node.textContent&&node.textContent.trim())return true;
    }
    return false;
  }

  function shouldInspect(el,win){
    if(SKIP.has(el.tagName)||!hasDirectText(el))return false;
    const style=win.getComputedStyle(el);
    return style.display!=="none"&&style.visibility!=="hidden"&&Number(style.opacity||1)>.05;
  }

  function repairText(el,win){
    const style=win.getComputedStyle(el);
    const fg=parseColor(style.color);
    if(!fg||fg.a<.2)return;
    const bg=effectiveBackground(el,win);
    const current=contrast(fg,bg);
    if(current>=4.15)return;

    const dark=solid(DARK_TEXT),light=solid(LIGHT_TEXT);
    const darkRatio=contrast(dark,bg),lightRatio=contrast(light,bg);
    const replacement=darkRatio>=lightRatio?DARK_TEXT:LIGHT_TEXT;
    if(Math.max(darkRatio,lightRatio)>current+.35)forceColor(el,replacement);
  }

  fixContentContrast=function(contents){
    const doc=contents?.document;if(!doc)return;
    restoreContrast(doc);
    if(settings?.theme==="paper")return;
    const win=contents.window||doc.defaultView;if(!win||!doc.body)return;

    /* The EPUB owns backgrounds. We only alter text-bearing foreground nodes. */
    if(shouldInspect(doc.body,win))repairText(doc.body,win);
    doc.body.querySelectorAll("*").forEach(el=>{
      if(shouldInspect(el,win))repairText(el,win);
    });
  };

  refreshContentContrast=function(){
    if(!rendition?.getContents)return;
    requestAnimationFrame(()=>{
      try{rendition.getContents().forEach(fixContentContrast)}catch(error){console.warn("Contrast repair skipped",error)}
    });
  };
})();
