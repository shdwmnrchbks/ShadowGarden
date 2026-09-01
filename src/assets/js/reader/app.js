/* Shadow Garden R4.1 — Reader application orchestrator. */
import { createReaderStorage } from "./storage.js";
import { createThemeController } from "./theme.js";
import { createTocController } from "./toc.js?v=1.2.2";
import { createPageMapController } from "./page-map.js?v=1.2.0";
import { createSettingsController } from "./settings.js";
import { createProgressController } from "./progress-controller.js";
import { createBookmarksController } from "./bookmarks-controller.js";
import { createBookSearchController } from "./book-search.js";
import { createPageNavigationInput } from "./page-navigation-input.js";
import { createImageFocusController } from "./image-focus.js";
import { createCompletionController } from "./completion.js";
import { createPaginatedController } from "./paginated.js";
import { createContinuousController } from "./continuous.js";
import { createRendition, captureRenditionPosition, configureSpread, destroyRendition, pageMapLayoutMetrics } from "./rendition.js";
import { preferences, urls } from "../domain/index.js";

const $=selector=>document.querySelector(selector);
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

function readerElements(){return{
  readerApp:$("#readerApp"),loading:$("#readerLoading"),viewerShell:$("#viewerShell"),viewer:$("#viewer"),
  imageFocus:$("#imageFocus"),imageFocusViewport:$("#imageFocusViewport"),imageFocusLayer:$("#imageFocusLayer"),imageFocusImage:$("#imageFocusImage"),imageFocusClose:$("#imageFocusClose"),
  bookTitle:$("#bookTitle"),chapterTitle:$("#chapterTitle"),tocToggle:$("#tocToggle"),tocDrawer:$("#tocDrawer"),tocPanel:$("#tocPanel"),bookmarksPanel:$("#bookmarksPanel"),
  bookSearchToggle:$("#bookSearchToggle"),bookSearchDrawer:$("#bookSearchDrawer"),bookSearchForm:$("#bookSearchForm"),bookSearchInput:$("#bookSearchInput"),bookSearchStatus:$("#bookSearchStatus"),bookSearchResults:$("#bookSearchResults"),
  settingsToggle:$("#settingsToggle"),settingsDrawer:$("#settingsDrawer"),backdrop:$("#drawerBackdrop"),bookmarkButton:$("#bookmarkButton"),backLink:$("#backLink"),returnButton:$("#returnButton"),
  fullscreenButton:$("#fullscreenButton"),progressRange:$("#progressRange"),progressText:$("#progressText"),prevPage:$("#prevPage"),nextPage:$("#nextPage"),prevBottom:$("#prevBottom"),nextBottom:$("#nextBottom"),
  themeSelect:$("#themeSelect"),fontSelect:$("#fontSelect"),fontSizeRange:$("#fontSizeRange"),fontSizeValue:$("#fontSizeValue"),lineHeightRange:$("#lineHeightRange"),lineHeightValue:$("#lineHeightValue"),
  widthRange:$("#widthRange"),widthValue:$("#widthValue"),textWidthSetting:$("#textWidthSetting"),flowSelect:$("#flowSelect"),swipeTurnsToggle:$("#swipeTurnsToggle"),resetReader:$("#resetReader"),
  toast:$("#toast"),volumeEndPage:$("#volumeEndPage"),volumeCompleteTitle:$("#volumeCompleteTitle"),volumeCompleteDetail:$("#volumeCompleteDetail"),nextVolumeLink:$("#nextVolumeLink"),completeReturnLink:$("#completeReturnLink")
}}

export async function startReader(session){
  if(!session)return;
  const elements=readerElements();
  const storage=createReaderStorage({sourceIdentity:session.sourcePath,publicIdentity:session.publicBookId});
  const state={book:null,rendition:null,navigation:null,pageMap:null,currentChapter:"",renditionSerial:0,switchingFlow:false,queuedFlow:null,renderedFlow:null,toastTimer:0,resizeTimer:0,relayoutTimer:0,pageMapRefreshTimer:0};
  let settingsController,progressController,bookmarksController,bookSearchController,pageInputController,imageFocusController,paginatedController,continuousController,completionController;

  const themeController=createThemeController({getSettings:()=>settingsController?.get?.()||{},isAdult:session.adult});

  function toast(message){
    if(!elements.toast)return;elements.toast.textContent=message;elements.toast.classList.remove("hidden");clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>elements.toast.classList.add("hidden"),1800);
  }
  function openDrawer(drawer){if(drawer!==elements.bookSearchDrawer)bookSearchController?.cancel?.();document.querySelectorAll(".reader-drawer").forEach(item=>item.classList.toggle("open",item===drawer));elements.backdrop?.classList.remove("hidden")}
  function closeDrawers(){bookSearchController?.cancel?.();document.querySelectorAll(".reader-drawer").forEach(item=>item.classList.remove("open"));elements.backdrop?.classList.add("hidden")}
  function resetReaderInput(){pageInputController?.reset();imageFocusController?.closeImageFocus({restoreFocus:false})}

  async function navigate(target){
    if(!state.rendition||!target)return;
    resetReaderInput();
    if(settingsController.get().flow==="scrolled-doc")await continuousController.display(target);
    else await state.rendition.display(target);
  }

  const tocController=createTocController({panel:elements.tocPanel,navigate,closeDrawers,getBook:()=>state.book});

  function mapMetrics(){return pageMapLayoutMetrics(elements.viewerShell)}
  function mapLayoutChangedSignificantly(){
    const mapped=state.pageMap?.map?.()?.layout;if(!mapped)return true;const current=mapMetrics();
    return Math.abs(Number(mapped.width)-current.width)>24||Math.abs(Number(mapped.height)-current.height)>120||String(mapped.spread)!==String(current.spread);
  }
  function schedulePageMapRefresh(delay=700){
    clearTimeout(state.pageMapRefreshTimer);state.pageMapRefreshTimer=setTimeout(()=>{
      if(!state.pageMap||!state.book)return;state.pageMap.ensure({anchorCfi:progressController?.currentCfi?.()||""}).catch(error=>console.warn("Page map refresh failed",error));
    },delay);
  }
  function scheduleRelayout(){
    clearTimeout(state.relayoutTimer);state.relayoutTimer=setTimeout(async()=>{
      const rendition=state.rendition;if(!rendition||state.switchingFlow)return;
      const keepCfi=progressController.currentCfi();
      try{rendition.resize?.("100%","100%")}catch{}
      configureSpread(rendition,settingsController.get().flow);
      if(keepCfi){try{await rendition.display(keepCfi)}catch(error){console.warn("Reader relayout skipped",error)}}
    },120);
  }
  function applySettings({relayout=false,rebuildPageMap=false}={}){
    if(relayout||rebuildPageMap)resetReaderInput();
    const rendition=state.rendition,settings=settingsController.get();
    if(rendition){
      try{rendition.themes.default(themeController.css(settings))}catch(error){console.warn("Reader theme update skipped",error)}
      configureSpread(rendition,settings.flow);themeController.refresh(rendition);if(relayout)scheduleRelayout();
    }
    if(rebuildPageMap)schedulePageMapRefresh();
  }

  settingsController=createSettingsController({
    storage,elements,isAdult:session.adult,onApply:applySettings,onFlowChange:flow=>void switchFlow(flow),
    onReset:previousFlow=>{resetReaderInput();schedulePageMapRefresh(100);if(previousFlow!==settingsController.get().flow)void switchFlow(settingsController.get().flow);else applySettings({relayout:true,rebuildPageMap:true});toast("Reader settings reset")}
  });

  progressController=createProgressController({
    storage,elements,getBook:()=>state.book,getRendition:()=>state.rendition,getPageMap:()=>state.pageMap,getFlow:()=>settingsController.get().flow,getChapter:()=>state.currentChapter,toast,
    onPositionChange:()=>bookmarksController?.syncButton?.()
  });

  bookmarksController=createBookmarksController({storage,elements,getPosition:()=>progressController.currentPosition(),getCfi:()=>progressController.currentCfi(),getChapter:()=>state.currentChapter,getPageMap:()=>state.pageMap,navigate,closeDrawers,toast});
  bookSearchController=createBookSearchController({drawer:elements.bookSearchDrawer,form:elements.bookSearchForm,input:elements.bookSearchInput,status:elements.bookSearchStatus,results:elements.bookSearchResults,getBook:()=>state.book,getChapter:location=>tocController.chapterForLocation(location),navigate,closeDrawers,toast});

  function turn(direction){if(settingsController.get().flow!=="paginated")return;paginatedController?.turn(direction)}
  pageInputController=createPageNavigationInput({getFlow:()=>settingsController.get().flow,getSwipeTurns:()=>settingsController.get().swipeTurns,turn});
  imageFocusController=createImageFocusController({
    overlay:elements.imageFocus,viewport:elements.imageFocusViewport,layer:elements.imageFocusLayer,image:elements.imageFocusImage,closeButton:elements.imageFocusClose,
    hint:document.getElementById("imageFocusHint"),
    shouldSuppressOpen:()=>pageInputController.shouldSuppressClick()
  });
  paginatedController=createPaginatedController({getRendition:()=>state.rendition,beforeTurn:resetReaderInput});
  continuousController=createContinuousController({getRendition:()=>state.rendition,beforeNavigate:resetReaderInput});

  function onRelocated(rendition,location){
    if(rendition!==state.rendition)return;
    state.currentChapter=tocController.chapterForLocation(location);if(elements.chapterTitle)elements.chapterTitle.textContent=state.currentChapter;
    progressController.save(location);tocController.setActiveForLocation(location);bookmarksController.syncButton();themeController.refresh(rendition);
  }
  function wireRendition(rendition){
    rendition.hooks.content.register(contents=>themeController.prepare(contents));
    pageInputController.attachRendition(rendition);
    imageFocusController.attachRendition(rendition);
    rendition.on("relocated",location=>onRelocated(rendition,location));
    rendition.on("rendered",()=>{if(rendition!==state.rendition)return;themeController.refresh(rendition);bookmarksController.syncButton()});
    rendition.on("keyup",event=>{if(rendition!==state.rendition||settingsController.get().flow!=="paginated"||imageFocusController.isFocused())return;if(event.key==="ArrowRight")turn(1);if(event.key==="ArrowLeft")turn(-1)});
  }

  async function openRendition(target){
    const serial=++state.renditionSerial,flow=settingsController.get().flow;
    const rendition=await createRendition({book:state.book,target,flow,wire:wireRendition,onCreate:value=>{state.rendition=value},themeCss:themeController.css(settingsController.get())});
    if(serial!==state.renditionSerial||rendition!==state.rendition)return rendition;
    state.renderedFlow=flow;themeController.refresh(rendition);bookmarksController.syncButton();return rendition;
  }

  async function switchFlow(nextFlow){
    const desired=nextFlow==="scrolled-doc"?"scrolled-doc":"paginated";
    if(state.switchingFlow){state.queuedFlow=desired;return}
    if(desired===state.renderedFlow&&state.rendition){settingsController.setFlow(desired);return}
    const previousFlow=state.renderedFlow||settingsController.get().flow,old=state.rendition;
    const position=await captureRenditionPosition({rendition:old,flow:previousFlow,pageMap:state.pageMap,fallback:progressController.currentPosition()});
    let target=progressController.currentCfi()||storage.loadProgress()?.cfi||undefined;
    if(state.pageMap&&position){try{target=await state.pageMap.targetForPosition(position,{includeFraction:desired==="scrolled-doc"})||target}catch(error){console.warn("Canonical flow target fallback",error)}}
    progressController.setPosition(position);settingsController.setFlow(desired);resetReaderInput();state.switchingFlow=true;state.rendition=null;destroyRendition(old,elements.viewer);
    try{
      await openRendition(target);
      if(state.pageMap&&position){const canonicalTarget=await state.pageMap.targetForPosition(position,{includeFraction:desired==="scrolled-doc"});if(canonicalTarget&&state.rendition){if(desired==="scrolled-doc")await nextPaint();await state.rendition.display(canonicalTarget)}}
    }catch(error){
      console.error("Reader flow switch failed",error);toast("Could not switch reading flow");try{state.rendition?.destroy?.()}catch{}if(elements.viewer)elements.viewer.innerHTML="";settingsController.setFlow(previousFlow);try{await openRendition(target)}catch(recoveryError){console.error("Reader flow recovery failed",recoveryError);elements.loading?.classList.remove("hidden");if(elements.loading)elements.loading.innerHTML="<p>Shadow Garden could not restore the reader.</p>"}
    }finally{
      state.switchingFlow=false;const queued=state.queuedFlow;state.queuedFlow=null;if(queued&&queued!==state.renderedFlow)setTimeout(()=>void switchFlow(queued),0);
    }
  }

  function onPageMapUpdate(event){
    if(event.type==="loading"){if(elements.progressText)elements.progressText.title="Preparing device page map…";tocController.setPageResolver(null);return}
    if(event.type==="cached"||event.type==="ready"){
      const map=event.map;tocController.setPageResolver(href=>state.pageMap?.firstPageForHref?.(href));if(elements.progressText)elements.progressText.title=`${map.totalPages} device pages cached for this layout`;progressController.pageMapReady();bookmarksController.render();return;
    }
    if(event.type==="error"&&elements.progressText)elements.progressText.title="Page map unavailable; using EPUB location tracking";
  }

  function bindDrawers(){
    elements.tocToggle?.addEventListener("click",()=>openDrawer(elements.tocDrawer));elements.bookSearchToggle?.addEventListener("click",()=>{openDrawer(elements.bookSearchDrawer);bookSearchController?.focus?.()});elements.settingsToggle?.addEventListener("click",()=>openDrawer(elements.settingsDrawer));elements.backdrop?.addEventListener("click",closeDrawers);
    document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",closeDrawers));
    document.querySelector(".drawer-tabs")?.addEventListener("click",event=>{const button=event.target.closest("button[data-panel]");if(!button)return;document.querySelectorAll(".drawer-tabs button").forEach(item=>item.classList.toggle("active",item===button));elements.tocPanel?.classList.toggle("hidden",button.dataset.panel!=="toc");elements.bookmarksPanel?.classList.toggle("hidden",button.dataset.panel!=="bookmarks");if(button.dataset.panel==="bookmarks")bookmarksController.render()});
  }
  function bindNavigation(){
    elements.prevPage?.addEventListener("click",()=>turn(-1));elements.prevBottom?.addEventListener("click",()=>turn(-1));elements.nextPage?.addEventListener("click",()=>turn(1));elements.nextBottom?.addEventListener("click",()=>turn(1));
    elements.progressRange?.addEventListener("input",event=>{resetReaderInput();progressController.seekTo(Number(event.target.value)/1000)});
    elements.progressRange?.addEventListener("change",event=>{resetReaderInput();progressController.seekTo(Number(event.target.value)/1000,true)});
    elements.progressRange?.addEventListener("pointerup",event=>{if(settingsController.get().flow==="paginated"){resetReaderInput();progressController.seekTo(Number(event.currentTarget.value)/1000,true)}});
    elements.progressRange?.addEventListener("touchend",event=>{if(settingsController.get().flow==="paginated"){resetReaderInput();progressController.seekTo(Number(event.currentTarget.value)/1000,true)}},{passive:true});
    elements.fullscreenButton?.addEventListener("click",()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.()});
    document.addEventListener("keydown",event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="f"&&!imageFocusController.isFocused()){event.preventDefault();openDrawer(elements.bookSearchDrawer);bookSearchController?.focus?.();return}
      if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
      if(event.key==="Escape"){if(imageFocusController.isFocused())imageFocusController.closeImageFocus();else closeDrawers();return}
      if(event.key.toLowerCase()==="t"){openDrawer(elements.tocDrawer);return}
      if(settingsController.get().flow!=="paginated"||imageFocusController.isFocused())return;
      if(event.key==="ArrowRight")turn(1);if(event.key==="ArrowLeft")turn(-1);
    });
    window.addEventListener("resize",()=>{
      clearTimeout(state.resizeTimer);state.resizeTimer=setTimeout(async()=>{
        const rendition=state.rendition;if(!rendition||state.switchingFlow)return;resetReaderInput();const keepCfi=progressController.currentCfi();
        try{rendition.resize?.("100%","100%")}catch{}configureSpread(rendition,settingsController.get().flow);
        if(settingsController.get().flow==="paginated"&&keepCfi){try{await rendition.display(keepCfi)}catch{}}
        if(mapLayoutChangedSignificantly())schedulePageMapRefresh(900);
      },180);
    });
  }

  bindDrawers();bindNavigation();
  const returnHref=session.seriesId?urls.seriesUrl(session.seriesId):urls.libraryUrl(session.adult);if(elements.backLink)elements.backLink.href=returnHref;if(elements.returnButton)elements.returnButton.href=returnHref;

  try{
    state.book=window.ePub(session.sourcePath);
    const metadataPromise=state.book.loaded.metadata.catch(()=>({})),navigationPromise=state.book.loaded.navigation.catch(error=>{console.warn("EPUB navigation unavailable",error);return{toc:[]}});
    const[metadata,navigation]=await Promise.all([metadataPromise,navigationPromise]);state.navigation=navigation;
    const title=metadata?.title||"Untitled EPUB";if(elements.bookTitle)elements.bookTitle.textContent=title;document.title=`${title} — Shadow Garden`;tocController.render(navigation?.toc||[]);

    const saved=progressController.restoreSaved();
    state.pageMap=createPageMapController({book:state.book,bookUrl:session.publicBookId||session.storageIdentity,getSettings:()=>settingsController.get(),getLayoutMetrics:mapMetrics,getViewer:()=>elements.viewer,getPaginatedTheme:()=>themeController.css({...settingsController.get(),flow:"paginated"}),onUpdate:onPageMapUpdate});
    const pageMapResult=await state.pageMap.ensure({anchorCfi:saved?.cfi||""});
    let initialTarget=saved?.cfi||undefined;
    if(pageMapResult?.map&&saved?.pageMapFingerprint===state.pageMap.fingerprint()&&Number(saved?.page)>0){try{initialTarget=await state.pageMap.targetForPosition(saved,{includeFraction:settingsController.get().flow==="scrolled-doc"})||initialTarget}catch{}}
    progressController.startLocationGeneration();await openRendition(initialTarget);
    if(pageMapResult?.map&&saved?.pageMapFingerprint===state.pageMap.fingerprint()&&Number(saved?.page)>0){try{const canonicalTarget=await state.pageMap.targetForPosition(saved,{includeFraction:settingsController.get().flow==="scrolled-doc"});if(canonicalTarget)await state.rendition.display(canonicalTarget)}catch{}}
    completionController=await createCompletionController({session,elements,toast});
    elements.loading?.classList.add("hidden");
  }catch(error){
    console.error("Reader initialization failed",error);elements.loading?.classList.remove("hidden");if(elements.loading)elements.loading.innerHTML="<p>Shadow Garden could not open this EPUB.</p>";throw error;
  }

  return{session,state,settings:settingsController,progress:progressController,bookmarks:bookmarksController,search:bookSearchController,pageInput:pageInputController,imageFocus:imageFocusController,completion:completionController};
}
