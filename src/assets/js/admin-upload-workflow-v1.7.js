/* Shadow Garden v1.7.0 — stateful New Books workflow layered over the stable batch uploader. */
(()=>{
  const dialog=document.querySelector('#addBooksDialog');
  const addView=document.querySelector('#addView');
  const q=state?.batch;
  const list=document.querySelector('#batchList');
  const panel=document.querySelector('#batchPanel');
  const uploadState=document.querySelector('#uploadState');
  const uploadButton=document.querySelector('#uploadButton');
  const fileInput=document.querySelector('#epubFile');
  const preflight=document.querySelector('#preflightCard');
  if(!dialog||!addView||!q||!list||!panel||!uploadState||!uploadButton||!fileInput||!preflight)return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const arr=value=>Array.isArray(value)?value:[];
  const svgTrash='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M7 7l1 13h8l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>';
  let mode='edit';
  let sessionIds=[];
  let completedSeries=[];
  let finishing=false;

  /* Load the v1.7 visual layer without requiring another large admin shell rewrite. */
  if(!document.querySelector('link[data-admin-v17]')){
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='/assets/css/admin-v1.7.css?v=1.7.0';link.dataset.adminV17='1';
    document.head.appendChild(link);
  }

  const stage=document.createElement('section');
  stage.id='uploadWorkflowStage';
  stage.className='upload-workflow-stage hidden';
  stage.setAttribute('aria-live','polite');
  addView.before(stage);

  const legacyOpen=document.querySelector('#openSeries');
  legacyOpen?.classList.add('sg-legacy-open-series');

  function actionableItems(){
    return q.items.filter(item=>item.metaReady&&item.validation?.status!=='fail'&&item.action!=='skip'&&item.status!=='done');
  }

  function updateQueueChrome(){
    const ready=actionableItems().length;
    const failed=q.items.filter(item=>item.validation?.status==='fail'||item.status==='failed').length;
    const duplicates=q.items.filter(item=>item.duplicate).length;
    const summary=document.querySelector('#batchSummary');
    if(summary)summary.textContent=q.items.length?`${q.items.length} selected · ${ready} upload · ${duplicates} duplicate${duplicates===1?'':'s'}${failed?` · ${failed} failed`:''}`:'';
    panel.classList.toggle('hidden',!q.items.length);
    if(!q.running){
      uploadButton.disabled=!ready;
      uploadButton.textContent=ready?`Upload ${ready} ${ready===1?'Book':'Books'}`:'Nothing to upload';
      document.querySelector('#uploadCard')?.classList.toggle('hidden',!q.items.length);
    }
    const pickerTitle=document.querySelector('#filePickerTitle');
    const pickerMeta=document.querySelector('#filePickerMeta');
    if(q.items.length){
      if(pickerTitle)pickerTitle.textContent=`${q.items.length} EPUB${q.items.length===1?'':'s'} in batch`;
      if(pickerMeta)pickerMeta.textContent='Review duplicates and metadata, then upload the queue.';
    }
  }

  function batchDuplicateReasons(a,b){
    const reasons=[];
    if(a.sha256&&b.sha256&&a.sha256===b.sha256)reasons.push('same file hash');
    if(typeof slug==='function'&&slug(a.series)===slug(b.series)&&Number(a.number)===Number(b.number))reasons.push(`same series volume ${a.number}`);
    if(String(a.title||'').trim().toLowerCase()&&String(a.title||'').trim().toLowerCase()===String(b.title||'').trim().toLowerCase()&&typeof slug==='function'&&slug(a.series)===slug(b.series))reasons.push('same title');
    return [...new Set(reasons)];
  }

  function reconcileBatchDuplicates(){
    for(const item of q.items){
      if(item.duplicate?.batch)item.duplicate=null;
    }
    for(let i=0;i<q.items.length;i++){
      const a=q.items[i];if(!a.metaReady)continue;
      for(let j=i+1;j<q.items.length;j++){
        const b=q.items[j];if(!b.metaReady)continue;
        const reasons=batchDuplicateReasons(a,b);if(!reasons.length)continue;
        if(!a.duplicate)a.duplicate={batch:true,reasons};
        if(!b.duplicate)b.duplicate={batch:true,reasons};
      }
    }
    for(const item of q.items){
      if(item.duplicate?.batch&&item.action==='new')item.action='skip';
      if(!item.duplicate&&item.action==='skip'&&item.validation?.status!=='fail'&&item.status!=='failed')item.action='new';
    }
  }

  function duplicateText(item){
    const d=item.duplicate;
    if(!d)return'';
    if(d.batch)return arr(d.reasons).join(' · ');
    const title=d.series?.title||'Existing series';
    const volume=d.volume?.title||`Volume ${d.volume?.number??'?'}`;
    return`${title} · ${volume} · ${d.scope==='adult'?'18+':'Main'} · ${arr(d.reasons).join(', ')}`;
  }

  function syncDuplicateBlock(article,item){
    const block=article.querySelector('.batch-duplicate');
    if(!block)return;
    if(!item.duplicate){
      article.classList.remove('has-duplicate');
      block.hidden=true;
      return;
    }
    article.classList.add('has-duplicate');
    block.hidden=false;
    const choices=item.duplicate.batch
      ? `<option value="skip"${item.action==='skip'?' selected':''}>Skip</option><option value="separate"${item.action==='separate'?' selected':''}>Add separate</option>`
      : `<option value="skip"${item.action==='skip'?' selected':''}>Skip</option><option value="replace"${item.action==='replace'?' selected':''}>Replace existing</option><option value="separate"${item.action==='separate'?' selected':''}>Add separate</option>`;
    block.innerHTML=`<label>Duplicate action<select data-batch-action="${esc(item.id)}" ${item.status==='done'?'disabled':''}>${choices}</select></label><p>${esc(duplicateText(item))}</p>`;
  }

  function enhanceQueue(){
    for(const article of list.querySelectorAll('.batch-item')){
      const id=article.dataset.batchId;
      const item=q.items.find(entry=>entry.id===id);if(!item)continue;
      const actions=article.querySelector('.batch-actions');
      if(actions&&!actions.querySelector('[data-batch-remove]')){
        const button=document.createElement('button');
        button.className='batch-remove';button.type='button';button.dataset.batchRemove=id;
        button.innerHTML=svgTrash;button.title='Remove from upload queue';button.setAttribute('aria-label','Remove EPUB from upload queue');
        actions.appendChild(button);
      }
      const remove=actions?.querySelector('[data-batch-remove]');
      if(remove)remove.disabled=q.running||item.status==='uploading';
      syncDuplicateBlock(article,item);
    }
    updateQueueChrome();
  }

  function clearEmptyEditor(){
    document.querySelector('#metadataCard')?.classList.add('hidden');
    preflight.classList.add('hidden');
    document.querySelector('#uploadCard')?.classList.add('hidden');
    document.querySelector('#batchEditorPicker')?.classList.add('hidden');
    if(typeof setFileState==='function')setFileState('WAITING');
    const pickerTitle=document.querySelector('#filePickerTitle');if(pickerTitle)pickerTitle.textContent='Choose EPUBs from phone';
    const pickerMeta=document.querySelector('#filePickerMeta');if(pickerMeta)pickerMeta.textContent='Select one or many EPUBs · 50 MB maximum per file';
    fileInput.value='';
  }

  function removeQueueItem(id){
    if(q.running)return;
    const index=q.items.findIndex(item=>item.id===id);if(index<0)return;
    const wasActive=q.activeId===id;
    q.items.splice(index,1);
    if(wasActive){q.activeId=null;if(q.objectUrl){try{URL.revokeObjectURL(q.objectUrl)}catch{}q.objectUrl=''}}
    list.querySelector(`[data-batch-id="${CSS.escape(id)}"]`)?.remove();
    reconcileBatchDuplicates();
    enhanceQueue();
    if(!q.items.length){clearEmptyEditor();return}
    if(wasActive){
      const next=q.items.find(item=>item.metaReady);
      if(next)queueMicrotask(()=>list.querySelector(`[data-batch-edit="${CSS.escape(next.id)}"]`)?.click());
    }
  }

  list.addEventListener('click',event=>{
    const remove=event.target.closest('[data-batch-remove]');
    if(!remove)return;
    event.preventDefault();event.stopPropagation();
    removeQueueItem(remove.dataset.batchRemove);
  },true);

  /* Compact preflight: status sentence remains visible, structural detail is opt-in. */
  const preflightHead=preflight.querySelector('.admin-card-head');
  const preflightToggle=document.createElement('button');
  preflightToggle.className='preflight-collapse-toggle';preflightToggle.type='button';
  preflightToggle.setAttribute('aria-controls','preflightChecks');
  preflightHead?.appendChild(preflightToggle);
  function setPreflightCollapsed(collapsed){
    preflight.classList.toggle('sg-preflight-collapsed',collapsed);
    preflightToggle.setAttribute('aria-expanded',String(!collapsed));
    preflightToggle.title=collapsed?'Show preflight details':'Hide preflight details';
    preflightToggle.setAttribute('aria-label',collapsed?'Show preflight details':'Hide preflight details');
    preflightToggle.innerHTML=`<span aria-hidden="true">${collapsed?'▼':'▲'}</span><b>Details</b>`;
  }
  setPreflightCollapsed(true);
  preflightToggle.addEventListener('click',()=>setPreflightCollapsed(!preflight.classList.contains('sg-preflight-collapsed')));
  list.addEventListener('click',event=>{if(event.target.closest('[data-batch-edit]'))queueMicrotask(()=>setPreflightCollapsed(true))},true);
  document.querySelector('#batchEditorSelect')?.addEventListener('change',()=>queueMicrotask(()=>setPreflightCollapsed(true)));

  function showStage(){dialog.classList.add('sg-workflow-stage');stage.classList.remove('hidden')}
  function showEditor(){
    mode='edit';dialog.classList.remove('sg-workflow-stage');stage.classList.add('hidden');stage.innerHTML='';
    if(!q.items.length){
      clearEmptyEditor();
      if(typeof setUploadState==='function')setUploadState('WAITING');
      if(typeof setStatus==='function')setStatus('Ready to upload','Choose one or more EPUBs to begin.','✦');
    }
  }

  function renderUploading(){
    showStage();
    stage.innerHTML=`<div class="upload-state-card upload-state-uploading">
      <div class="upload-state-mark" aria-hidden="true">✦</div>
      <p class="kicker">PLANTING BOOKS</p><h2>Uploading to the Garden</h2>
      <p id="uploadStageDetail">Preparing the batch for private storage…</p>
      <div class="upload-stage-progress" aria-hidden="true"><i id="uploadStageBar"></i></div>
      <div class="upload-stage-meta"><span id="uploadStagePercent">0%</span><span id="uploadStageCount">0 / ${sessionIds.length}</span></div>
    </div>`;
    updateUploading();
  }

  function updateUploading(){
    if(mode!=='uploading')return;
    const items=sessionIds.map(id=>q.items.find(item=>item.id===id)).filter(Boolean);
    const total=Math.max(1,items.length);
    const aggregate=items.reduce((sum,item)=>sum+Math.max(0,Math.min(100,Number(item.progress)||0)),0)/total;
    const done=items.filter(item=>item.status==='done').length;
    const current=items.find(item=>item.status==='uploading')||items.find(item=>item.status!=='done'&&item.status!=='failed');
    const bar=document.querySelector('#uploadStageBar');if(bar)bar.parentElement?.style.setProperty('--upload-stage-progress',`${aggregate.toFixed(1)}%`);
    const percent=document.querySelector('#uploadStagePercent');if(percent)percent.textContent=`${Math.round(aggregate)}%`;
    const count=document.querySelector('#uploadStageCount');if(count)count.textContent=`${done} / ${items.length} uploaded`;
    const detail=document.querySelector('#uploadStageDetail');
    if(detail)detail.textContent=current?.progressLabel?`${current.title||current.file?.name||'EPUB'} — ${current.progressLabel}`:done===items.length?'Finishing catalog updates…':'Preparing the next EPUB…';
  }

  function collectCompletedSeries(items){
    const map=new Map();
    for(const item of items){
      const id=item.result?.seriesId;if(!id)continue;
      if(!map.has(id))map.set(id,{id,title:item.series||item.result?.seriesTitle||'Uploaded series',adult:Boolean(item.adult),books:0});
      map.get(id).books++;
    }
    return [...map.values()];
  }

  function clearQueueAfterSuccess(){
    q.items.splice(0,q.items.length);q.activeId=null;q.library=null;
    if(q.objectUrl){try{URL.revokeObjectURL(q.objectUrl)}catch{}q.objectUrl=''}
    list.innerHTML='';panel.classList.add('hidden');
    const summary=document.querySelector('#batchSummary');if(summary)summary.textContent='';
    fileInput.value='';
    document.querySelector('#metadataCard')?.classList.add('hidden');preflight.classList.add('hidden');document.querySelector('#uploadCard')?.classList.add('hidden');document.querySelector('#batchEditorPicker')?.classList.add('hidden');
    const pickerTitle=document.querySelector('#filePickerTitle');if(pickerTitle)pickerTitle.textContent='Choose EPUBs from phone';
    const pickerMeta=document.querySelector('#filePickerMeta');if(pickerMeta)pickerMeta.textContent='Select one or many EPUBs · 50 MB maximum per file';
  }

  function renderComplete(successes,failures){
    const success=failures.length===0&&successes.length===sessionIds.length;
    mode=success?'complete':'partial';
    completedSeries=collectCompletedSeries(successes);
    showStage();
    const openLabel=completedSeries.length>1?'Open uploaded series':'Open uploaded series';
    stage.innerHTML=`<div class="upload-state-card ${success?'upload-state-complete':'upload-state-partial'}">
      <div class="upload-state-mark" aria-hidden="true">${success?'✓':'△'}</div>
      <p class="kicker">${success?'UPLOAD COMPLETE':'BATCH FINISHED'}</p>
      <h2>${success?'The new books have taken root.':'Some books need attention.'}</h2>
      <p>${success?`${successes.length} book${successes.length===1?' was':'s were'} uploaded successfully and the upload queue has been cleared.`:`${successes.length} uploaded · ${failures.length} failed. Failed/reviewable entries remain in the queue so they can be corrected or retried.`}</p>
      <div class="upload-state-actions">
        ${completedSeries.length?`<button id="workflowOpenSeries" class="admin-primary" type="button">${openLabel}</button>`:''}
        <button id="workflowNextBatch" class="admin-secondary" type="button">${success?'Upload another batch':'Review upload queue'}</button>
      </div>
    </div>`;
    if(success)clearQueueAfterSuccess();
    document.querySelector('#workflowOpenSeries')?.addEventListener('click',()=>{
      if(completedSeries.length===1)location.href=`/series.html?id=${encodeURIComponent(completedSeries[0].id)}`;
      else renderSeriesChooser();
    });
    document.querySelector('#workflowNextBatch')?.addEventListener('click',showEditor);
  }

  function renderSeriesChooser(){
    mode='chooser';showStage();
    stage.innerHTML=`<div class="upload-state-card upload-state-complete">
      <div class="upload-state-mark" aria-hidden="true">✦</div>
      <p class="kicker">UPLOADED SERIES</p><h2>Choose a shelf to open</h2>
      <p>This batch added books to ${completedSeries.length} series.</p>
      <div class="upload-series-grid">${completedSeries.map(series=>`<button class="upload-series-choice" type="button" data-open-uploaded-series="${esc(series.id)}"><strong>${esc(series.title)}</strong><span>${series.adult?'18+ Library':'Main Library'} · ${series.books} uploaded book${series.books===1?'':'s'}</span></button>`).join('')}</div>
      <div class="upload-state-actions"><button id="workflowChooserBack" class="admin-secondary" type="button">← Back</button><button id="workflowChooserNext" class="admin-secondary" type="button">Upload another batch</button></div>
    </div>`;
    stage.querySelectorAll('[data-open-uploaded-series]').forEach(button=>button.addEventListener('click',()=>{location.href=`/series.html?id=${encodeURIComponent(button.dataset.openUploadedSeries)}`}));
    document.querySelector('#workflowChooserBack')?.addEventListener('click',()=>renderCompleteSnapshot());
    document.querySelector('#workflowChooserNext')?.addEventListener('click',showEditor);
  }

  let completionSnapshot={successes:[],failures:[]};
  function renderCompleteSnapshot(){renderComplete(completionSnapshot.successes,completionSnapshot.failures)}

  function beginUploadStage(){
    if(mode==='uploading')return;
    const items=actionableItems();if(!items.length)return;
    sessionIds=items.map(item=>item.id);completedSeries=[];finishing=false;mode='uploading';
    renderUploading();
  }

  function finishUploadStage(){
    if(mode!=='uploading'||finishing)return;
    finishing=true;
    const items=sessionIds.map(id=>q.items.find(item=>item.id===id)).filter(Boolean);
    const successes=items.filter(item=>item.status==='done');
    const failures=items.filter(item=>item.status==='failed'||item.validation?.status==='fail');
    completionSnapshot={successes:[...successes],failures:[...failures]};
    renderComplete(successes,failures);
    finishing=false;
  }

  function syncWorkflowFromUploadState(){
    const text=String(uploadState.textContent||'').trim().toUpperCase();
    if(text==='UPLOADING'){beginUploadStage();updateUploading();return}
    if(text.startsWith('COMPLETE'))finishUploadStage();
  }

  const queueObserver=new MutationObserver(()=>queueMicrotask(()=>{enhanceQueue();updateUploading();syncWorkflowFromUploadState()}));
  queueObserver.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['data-status','data-action','style','class']});
  new MutationObserver(()=>queueMicrotask(syncWorkflowFromUploadState)).observe(uploadState,{childList:true,subtree:true,characterData:true});

  dialog.addEventListener('close',()=>{if(mode!=='uploading')showEditor()});
  dialog.addEventListener('cancel',event=>{if(mode==='uploading')event.preventDefault()});

  enhanceQueue();
})();
