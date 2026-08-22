/* Shadow Garden v1.7.2 — Catalog History rows, persistent queue editor, and cover chooser. */
(()=>{
  const dialog=document.querySelector('#addBooksDialog');
  const batchList=document.querySelector('#batchList');
  const metadata=document.querySelector('#metadataCard');
  const preflight=document.querySelector('#preflightCard');
  const stage=document.querySelector('#uploadWorkflowStage');
  const backupList=document.querySelector('#backupList');
  const q=state?.batch;

  /* Catalog History gets a dedicated component instead of inheriting the generic maintenance
     item geometry. This prevents older mobile/grid rules from collapsing backup rows together. */
  function normalizeBackupRows(){
    if(!backupList)return;
    for(const row of backupList.children){
      if(!row.querySelector?.('[data-restore-backup]'))continue;
      row.classList.add('backup-history-entry');
      row.classList.remove('maintenance-item');
      const copy=row.querySelector('.maintenance-item-copy');
      if(copy){
        copy.classList.add('backup-history-copy');
        copy.querySelector('strong')?.classList.add('backup-history-reason');
        const date=[...copy.children].find(el=>el.tagName==='SPAN'&&!el.classList.contains('backup-meta'));
        date?.classList.add('backup-history-date');
        copy.querySelector('.backup-meta')?.classList.add('backup-history-meta');
      }
      row.querySelector('.maintenance-item-actions')?.classList.add('backup-history-actions');
    }
  }
  if(backupList){
    new MutationObserver(()=>queueMicrotask(normalizeBackupRows)).observe(backupList,{childList:true,subtree:false});
    normalizeBackupRows();
  }

  /* admin-batch.js hides the editor whenever Add more EPUBs begins. If a valid active queue item
     already exists, keep its editor/preflight visible while the new files are inspected. */
  function keepActiveEditorVisible(){
    if(!q||!dialog?.open||q.running||dialog.classList.contains('sg-workflow-stage'))return;
    const active=q.items?.find(item=>item.id===q.activeId&&item.metaReady);
    if(!active)return;
    metadata?.classList.remove('hidden');
    preflight?.classList.remove('hidden');
    const picker=document.querySelector('#batchEditorPicker');
    if(picker&&q.items.length>1)picker.classList.remove('hidden');
  }
  if(batchList){
    new MutationObserver(()=>queueMicrotask(keepActiveEditorVisible)).observe(batchList,{childList:true,subtree:false});
  }
  if(metadata){
    new MutationObserver(()=>queueMicrotask(keepActiveEditorVisible)).observe(metadata,{attributes:true,attributeFilter:['class']});
  }

  /* Turn the multi-series completion chooser into library-like cover cards. The v1.7 listener is
     attached to each button itself, so replacing its children keeps navigation behavior intact. */
  let libraryPromise=null;
  async function getLibrary(){
    if(!libraryPromise){
      libraryPromise=(typeof api==='function'?api('/admin-api/library',{method:'GET'}):Promise.resolve(null))
        .catch(error=>{console.warn('Uploaded series cover lookup failed',error);return null});
    }
    return libraryPromise;
  }
  async function enhanceSeriesChooser(){
    const grid=stage?.querySelector('.upload-series-grid');
    if(!grid||grid.dataset.coverCards)return;
    grid.dataset.coverCards='loading';
    const data=await getLibrary();
    const seriesMap=new Map([
      ...((Array.isArray(data?.main)?data.main:[]).map(series=>[series.id,series])),
      ...((Array.isArray(data?.adult)?data.adult:[]).map(series=>[series.id,series]))
    ]);
    for(const button of grid.querySelectorAll('[data-open-uploaded-series]')){
      const id=button.dataset.openUploadedSeries||'';
      const existingTitle=button.querySelector('strong')?.textContent||'Uploaded series';
      const existingMeta=button.querySelector('span')?.textContent||'';
      const series=seriesMap.get(id);
      const cover=series?.coverThumb||series?.cover||series?.volumes?.find(volume=>volume.coverThumb||volume.cover)?.coverThumb||series?.volumes?.find(volume=>volume.cover)?.cover||'';
      const coverBox=document.createElement('span');
      coverBox.className='upload-series-card-cover';
      if(cover){
        const img=document.createElement('img');
        img.src=cover;img.alt='';img.loading='lazy';img.decoding='async';
        coverBox.appendChild(img);
      }else{
        const fallback=document.createElement('span');fallback.className='upload-series-card-fallback';fallback.textContent='✦';coverBox.appendChild(fallback);
      }
      const copy=document.createElement('span');copy.className='upload-series-card-copy';
      const title=document.createElement('strong');title.textContent=series?.title||existingTitle;
      const meta=document.createElement('small');meta.textContent=existingMeta;
      copy.append(title,meta);
      button.classList.add('upload-series-card');
      button.replaceChildren(coverBox,copy);
    }
    grid.dataset.coverCards='ready';
  }
  if(stage){
    new MutationObserver(()=>queueMicrotask(()=>void enhanceSeriesChooser())).observe(stage,{childList:true,subtree:true});
    void enhanceSeriesChooser();
  }
})();
