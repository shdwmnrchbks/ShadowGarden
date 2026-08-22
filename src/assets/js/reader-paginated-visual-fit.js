/* Shadow Garden v1.4.2 — paginated standalone visual-page fit.
 *
 * Runs after the v1.3 Visual Page Cache. In Pages mode, EPUB.js normally applies
 * multi-column pagination to each reflowable XHTML document. A synthetic visual page can
 * therefore still be confined to the left column of a desktop spread. This layer reapplies
 * deterministic visual-page geometry after EPUB.js has formatted the view so the image uses
 * the full rendered spread, remains centered, and is contained vertically inside the reader.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const EDGE_INSET=12;

  function isPaginated(options,rendition){
    const flow=String(options?.flow||rendition?.settings?.flow||"");
    return !flow.startsWith("scrolled");
  }

  function positive(values){
    return values.map(Number).filter(value=>Number.isFinite(value)&&value>0);
  }

  function metricsFor(rendition,view){
    const manager=rendition?.manager;
    const viewer=document.getElementById("viewer");
    const viewerRect=viewer?.getBoundingClientRect?.();
    const frameRect=view?.iframe?.getBoundingClientRect?.();

    const heights=positive([
      manager?.layout?.height,
      manager?._stageSize?.height,
      manager?.container?.clientHeight,
      viewerRect?.height,
      frameRect?.height
    ]);
    const widths=positive([
      manager?.layout?.width,
      manager?._stageSize?.width,
      manager?.container?.clientWidth,
      viewerRect?.width,
      view?._width,
      frameRect?.width
    ]);

    /* Choose the smallest credible page height so rounding/chrome differences can never crop
       the visual. Use the largest page width so a desktop two-page spread can be treated as one
       centered visual canvas instead of a left-hand text column. */
    const height=Math.max(240,Math.floor((heights.length?Math.min(...heights):window.innerHeight||800)-2));
    const width=Math.max(320,Math.floor(widths.length?Math.max(...widths):window.innerWidth||720));
    return{width,height};
  }

  function important(style,property,value){
    try{style.setProperty(property,value,"important")}catch{}
  }

  function clearColumnLayout(element){
    if(!element?.style)return;
    [
      "columns","column-width","column-count","column-gap","column-fill","column-rule",
      "-webkit-columns","-webkit-column-width","-webkit-column-count","-webkit-column-gap","-webkit-column-fill",
      "-moz-columns","-moz-column-width","-moz-column-count","-moz-column-gap","-moz-column-fill"
    ].forEach(property=>important(element.style,property,property.includes("gap")?"0px":property.includes("count")?"1":"auto"));
  }

  function fitVisualPage(view,rendition){
    const cache=window.__sgVisualPageCache;
    const href=view?.section?.href||"";
    if(!cache?.has?.(href)||!view?.contents?.document)return false;

    const {width,height}=metricsFor(rendition,view);
    try{cache.applyToContents?.(view.contents,href,{width,height})}catch{}

    const doc=view.contents.document;
    const html=doc.documentElement,body=doc.body;
    const wrapper=body?.querySelector?.(".sg-synthetic-visual-page");
    const image=wrapper?.querySelector?.("img");
    if(!html||!body||body.dataset.sgSyntheticVisual!=="1"||!wrapper||!image)return false;

    const innerWidth=Math.max(1,width-(EDGE_INSET*2));
    const innerHeight=Math.max(1,height-(EDGE_INSET*2));

    clearColumnLayout(html);
    clearColumnLayout(body);
    clearColumnLayout(wrapper);

    important(html.style,"margin","0");
    important(html.style,"padding","0");
    important(html.style,"width",`${width}px`);
    important(html.style,"min-width",`${width}px`);
    important(html.style,"max-width",`${width}px`);
    important(html.style,"height",`${height}px`);
    important(html.style,"min-height",`${height}px`);
    important(html.style,"max-height",`${height}px`);
    important(html.style,"overflow","hidden");
    important(html.style,"box-sizing","border-box");

    important(body.style,"margin","0");
    important(body.style,"padding",`${EDGE_INSET}px`);
    important(body.style,"width",`${width}px`);
    important(body.style,"min-width",`${width}px`);
    important(body.style,"max-width",`${width}px`);
    important(body.style,"height",`${height}px`);
    important(body.style,"min-height",`${height}px`);
    important(body.style,"max-height",`${height}px`);
    important(body.style,"display","grid");
    important(body.style,"place-items","center");
    important(body.style,"overflow","hidden");
    important(body.style,"box-sizing","border-box");

    important(wrapper.style,"margin","0");
    important(wrapper.style,"padding","0");
    important(wrapper.style,"width",`${innerWidth}px`);
    important(wrapper.style,"height",`${innerHeight}px`);
    important(wrapper.style,"min-width",`${innerWidth}px`);
    important(wrapper.style,"min-height",`${innerHeight}px`);
    important(wrapper.style,"max-width",`${innerWidth}px`);
    important(wrapper.style,"max-height",`${innerHeight}px`);
    important(wrapper.style,"display","grid");
    important(wrapper.style,"place-items","center");
    important(wrapper.style,"overflow","hidden");
    important(wrapper.style,"box-sizing","border-box");
    important(wrapper.style,"break-inside","avoid");

    important(image.style,"display","block");
    important(image.style,"position","static");
    important(image.style,"margin","auto");
    important(image.style,"padding","0");
    important(image.style,"width","auto");
    important(image.style,"height","auto");
    important(image.style,"max-width",`${innerWidth}px`);
    important(image.style,"max-height",`${innerHeight}px`);
    important(image.style,"object-fit","contain");
    important(image.style,"object-position","center center");

    try{
      view.contents.textWidth=()=>width;
      view.contents.textHeight=()=>height;
      view.stopExpanding=false;
      view.expand?.(true);
    }catch{}

    html.dataset.sgPaginatedVisualFit="1";
    return true;
  }

  function patchView(view,rendition){
    if(!view||view.__sgPaginatedVisualFitPatched)return view;
    view.__sgPaginatedVisualFitPatched=true;

    if(typeof view.render==="function"){
      const rawRender=view.render.bind(view);
      view.render=(...args)=>Promise.resolve(rawRender(...args)).then(result=>{
        fitVisualPage(view,rendition);
        return result;
      });
    }
    if(view.contents)fitVisualPage(view,rendition);
    return view;
  }

  function patchRendition(rendition,options={}){
    if(!rendition||rendition.__sgPaginatedVisualFitPatched||!isPaginated(options,rendition))return rendition;
    rendition.__sgPaginatedVisualFitPatched=true;

    const install=()=>{
      const manager=rendition.manager;
      if(!manager||manager.__sgPaginatedVisualFitManagerPatched)return;
      manager.__sgPaginatedVisualFitManagerPatched=true;
      if(typeof manager.createView==="function"){
        const rawCreateView=manager.createView.bind(manager);
        manager.createView=(...args)=>patchView(rawCreateView(...args),rendition);
      }
      try{manager.views?.all?.().forEach(view=>patchView(view,rendition))}catch{}
    };

    install();
    try{Promise.resolve(rendition.started).then(install).catch(()=>{})}catch{}
    try{rendition.on?.("started",install)}catch{}
    try{
      rendition.on?.("rendered",(_section,view)=>{
        patchView(view,rendition);
        fitVisualPage(view,rendition);
        requestAnimationFrame(()=>fitVisualPage(view,rendition));
      });
    }catch{}
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgPaginatedVisualFitBookPatched||typeof book.renderTo!=="function")return book;
    book.__sgPaginatedVisualFitBookPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options),options);
    return book;
  }

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
