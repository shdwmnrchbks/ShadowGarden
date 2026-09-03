/* Shadow Garden v2.9 — deterministic, reversible helpers for unsaved bulk metadata input. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$}=keeper.util;
  const taxonomyPromise=import("/assets/js/domain/catalog-taxonomy.js");
  const runWhenReady=callback=>window.ShadowGardenKeeperReady?callback():keeper.events.addEventListener("app:ready",callback,{once:true});

  function install(){
    const dialog=$("#bulkSeriesEditor"),genres=$("#bulkGenresInput"),mode=$("#bulkGenresMode"),validation=$("#bulkSeriesValidation");
    if(!dialog||!genres||!mode||!validation||validation.dataset.fixActionsReady==="1")return;
    validation.dataset.fixActionsReady="1";

    if(!document.querySelector('link[href="/assets/css/admin-bulk-edit-fixes.css"]')){
      const link=document.createElement("link");link.rel="stylesheet";link.href="/assets/css/admin-bulk-edit-fixes.css";document.head.appendChild(link);
    }

    const actions=document.createElement("div");
    actions.className="bulk-edit-fix-actions hidden";
    actions.setAttribute("aria-live","polite");
    validation.insertAdjacentElement("afterend",actions);

    let undo=null;
    let renderToken=0;

    function values(){
      const out=[],seen=new Set();
      for(const raw of String(genres.value||"").split(",")){
        const value=raw.trim(),key=value.toLowerCase().replace(/\s+/g," ");
        if(!value||seen.has(key))continue;seen.add(key);out.push(value);
      }
      return out;
    }

    function canonicalValues(input,taxonomy){
      const out=[],seen=new Set();
      for(const value of input){
        for(const canonical of taxonomy.normalizeGenres([value])){
          const key=canonical.toLowerCase();if(seen.has(key))continue;seen.add(key);out.push(canonical);
        }
      }
      return out;
    }

    async function stateForCurrentInput(){
      const taxonomy=await taxonomyPromise,input=values();
      const unknown=input.filter(value=>!taxonomy.normalizeGenres([value]).length);
      const canonical=canonicalValues(input,taxonomy),target=canonical.join(", ");
      return{unknown,canonical,target};
    }

    async function render(){
      const token=++renderToken,currentUndo=undo;
      const state=await stateForCurrentInput();if(token!==renderToken)return;
      if(currentUndo&&genres.value!==currentUndo.after)undo=null;
      const canUndo=Boolean(undo&&genres.value===undo.after);
      const canFix=mode.value!=="keep"&&!genres.disabled&&state.unknown.length>0&&state.canonical.length>0&&genres.value.trim()!==state.target;
      actions.classList.toggle("hidden",!canFix&&!canUndo);
      if(canUndo){
        actions.innerHTML='<span>Canonical genre fix applied to the unsaved draft.</span><button type="button" class="admin-secondary compact-button" data-bulk-undo-genre-fix>Undo genre fix</button>';
        return;
      }
      if(canFix){
        const count=state.unknown.length;
        actions.innerHTML=`<span>${count} ignored genre${count===1?"":"s"} can be removed without guessing.</span><button type="button" class="admin-secondary compact-button" data-bulk-apply-genre-fix>Remove ignored genres</button>`;
        return;
      }
      actions.replaceChildren();
    }

    async function applyGenreFix(button){
      if(button.disabled||genres.disabled||mode.value==="keep")return;
      button.disabled=true;
      try{
        const state=await stateForCurrentInput();
        if(!state.unknown.length||!state.canonical.length||genres.value.trim()===state.target)return;
        const before=genres.value;undo={before,after:state.target};genres.value=state.target;
        genres.dispatchEvent(new Event("input",{bubbles:true}));
      }finally{void render()}
    }

    function undoGenreFix(){
      if(!undo||genres.disabled)return;
      const before=undo.before;undo=null;genres.value=before;genres.dispatchEvent(new Event("input",{bubbles:true}));void render();
    }

    actions.addEventListener("click",event=>{
      const apply=event.target.closest("[data-bulk-apply-genre-fix]");if(apply){void applyGenreFix(apply);return}
      if(event.target.closest("[data-bulk-undo-genre-fix]"))undoGenreFix();
    });
    genres.addEventListener("input",()=>{if(undo&&genres.value!==undo.after)undo=null;void render()});
    mode.addEventListener("change",()=>{undo=null;void render()});
    dialog.addEventListener("close",()=>{undo=null;actions.classList.add("hidden");actions.replaceChildren()});
    new MutationObserver(()=>void render()).observe(genres,{attributes:true,attributeFilter:["disabled"]});
    void render();
  }

  runWhenReady(install);
})();
