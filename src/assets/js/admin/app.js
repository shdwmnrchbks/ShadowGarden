/* Shadow Garden R5/R7 — explicit Garden Keeper composition root with semantic CSS ownership. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)throw new Error("Garden Keeper core did not initialize.");
  keeper.workflows=keeper.workflows||keeper.core?.workflows;
  if(!keeper.workflows)throw new Error("Garden Keeper workflow registry did not initialize.");
  const loadScript=src=>new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[src^="${src.split("?")[0]}"]`);if(existing){if(existing.dataset.loaded==="1")resolve(existing);else{existing.addEventListener("load",()=>resolve(existing),{once:true});existing.addEventListener("error",reject,{once:true})}return}
    const script=document.createElement("script");script.src=src;script.defer=true;script.dataset.keeperModule="1";script.addEventListener("load",()=>{script.dataset.loaded="1";resolve(script)},{once:true});script.addEventListener("error",()=>reject(new Error(`Could not load ${src}`)),{once:true});document.body.appendChild(script);
  });
  const loadStyle=href=>{if(document.querySelector(`link[href^="${href.split("?")[0]}"]`))return;const link=document.createElement("link");link.rel="stylesheet";link.href=href;link.dataset.keeperStyle="1";document.head.appendChild(link)};

  async function boot(){
    loadStyle("/assets/css/admin-components.css?v=1.22.0");loadStyle("/assets/css/admin-version.css?v=1.22.0");loadStyle("/assets/css/admin-presentation.css?v=1.22.0");

    /* Register first-class workflows. */
    for(const src of [
      "/assets/js/admin/upload-fields.js?v=1.20.0",
      "/assets/js/admin/auth-session.js?v=1.20.0",
      "/assets/js/admin/library-workflow.js?v=1.20.0",
      "/assets/js/admin/maintenance-workflow.js?v=1.20.0",
      "/assets/js/admin/history-workflow.js?v=1.20.0",
      "/assets/js/admin/trash-workflow.js?v=1.20.0",
      "/assets/js/admin/abuse-workflow.js?v=1.20.0",
      "/assets/js/admin/version.js?v=1.20.0"
    ])await loadScript(src);

    /* Upload remains a composed workflow internally: engine -> safety -> editor -> stateful
       presentation. These pieces are isolated to Upload and no longer modify the shared API,
       authentication, Library/Series, Maintenance, History, Trash, or Abuse owners. */
    for(const src of [
      "/assets/js/admin-batch.js?v=1.20.0",
      "/assets/js/admin/upload-safety.js?v=1.20.0",
      "/assets/js/admin-batch-editor.js?v=1.20.0",
      "/assets/js/admin-upload-workflow.js?v=1.20.0",
      "/assets/js/admin-upload-completion.js?v=1.20.0",
      "/assets/js/admin-upload-polish.js?v=1.20.0",
      "/assets/js/admin/upload-events.js?v=1.20.0"
    ])await loadScript(src);

    await loadScript("/assets/js/admin/shell.js?v=1.20.0");
    await Promise.all([loadScript("/assets/js/site-flavor.js?v=1.20.0"),loadScript("/assets/js/ui-direction-triangles.js?v=1.20.0")]);

    for(const name of ["version","session","library","maintenance","history","trash","abuse","shell"])await keeper.initializeWorkflow(name);

    keeper.events.addEventListener("library:invalidate",()=>{
      const workflow=keeper.workflows.get("library")?.instance;if(workflow&&keeper.client.isAuthorized())void workflow.refresh();
    });
    window.ShadowGardenKeeperReady=true;
    keeper.events.dispatchEvent(new Event("app:ready"));
  }

  boot().catch(error=>{
    console.error("Garden Keeper R5 bootstrap failed",error);
    const state=document.querySelector("#authState");if(state){state.textContent="FAILED";state.className="state-pill error"}
    const button=document.querySelector("#unlockButton");if(button)button.disabled=true;
  });
})();