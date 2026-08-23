/* Shadow Garden v1.14.0 — Garden Keeper security + current workflow bootstrap. */
(()=>{
  const list=document.getElementById('backupList');
  if(!list)return;

  function enhanceDeleteButtons(){
    list.querySelectorAll('[data-restore-backup]').forEach(restore=>{
      const id=restore.dataset.restoreBackup;
      const actions=restore.closest('.maintenance-item-actions,.sg-backup-actions');
      if(!id||!actions||actions.querySelector(`[data-delete-backup="${CSS.escape(id)}"]`))return;
      const button=document.createElement('button');
      button.className='danger-button backup-delete-icon';
      button.type='button';
      button.dataset.deleteBackup=id;
      button.setAttribute('aria-label','Delete catalog backup');
      button.title='Delete backup';
      actions.appendChild(button);
    });
  }

  async function deleteBackup(id,button){
    if(!id)return;
    if(!confirm('Delete this catalog backup permanently?\n\nThis removes only the selected backup snapshot. Current catalogs and EPUB/cover files are not changed.'))return;
    button.disabled=true;
    try{
      await api('/admin-api/backup',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'delete',id})
      });
      if(typeof window.loadMaintenance==='function')await window.loadMaintenance(true);
    }catch(error){
      alert(error.message);
      button.disabled=false;
    }
  }

  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-delete-backup]');
    if(!button)return;
    event.preventDefault();
    void deleteBackup(button.dataset.deleteBackup,button);
  });
  new MutationObserver(enhanceDeleteButtons).observe(list,{childList:true,subtree:true});
  enhanceDeleteButtons();
})();

window.addEventListener('DOMContentLoaded',()=>{
  if(!document.querySelector('link[data-admin-current]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/css/admin-current.css?v=1.8.0';
    link.dataset.adminCurrent='1';
    document.head.appendChild(link);
  }
  if(!document.querySelector('link[data-admin-series-banner]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/css/admin-v1.9.4.css?v=1.9.4';
    link.dataset.adminSeriesBanner='1';
    document.head.appendChild(link);
  }

  const loadScript=(selector,src,datasetKey)=>new Promise((resolve,reject)=>{
    const existing=document.querySelector(selector);
    if(existing){
      if(existing.dataset.loaded==='1'||existing.readyState==='complete')resolve(existing);
      else{
        existing.addEventListener('load',()=>resolve(existing),{once:true});
        existing.addEventListener('error',reject,{once:true});
      }
      return;
    }
    const script=document.createElement('script');
    script.src=src;
    script.dataset[datasetKey]='1';
    script.addEventListener('load',()=>{script.dataset.loaded='1';resolve(script)},{once:true});
    script.addEventListener('error',reject,{once:true});
    document.body.appendChild(script);
  });

  const boot=async()=>{
    await loadScript('script[data-admin-security]','/assets/js/admin-security.js?v=1.13.0','adminSecurity');
    await loadScript('script[data-admin-series-status]','/assets/js/admin-series-status.js?v=1.10.4','adminSeriesStatus');
    await loadScript('script[data-admin-upload-workflow]','/assets/js/admin-upload-workflow.js?v=1.8.0','adminUploadWorkflow');
    await loadScript('script[data-admin-upload-completion]','/assets/js/admin-upload-completion.js?v=1.8.0','adminUploadCompletion');
    await loadScript('script[data-admin-upload-polish]','/assets/js/admin-upload-polish.js?v=1.8.0','adminUploadPolish');
    await loadScript('script[data-admin-backup-history]','/assets/js/admin-backup-history.js?v=1.8.0','adminBackupHistory');
    await loadScript('script[data-admin-series-banner]','/assets/js/admin-series-banner.js?v=1.9.4','adminSeriesBanner');
    await loadScript('script[data-admin-abuse]','/assets/js/admin-abuse.js?v=1.14.0','adminAbuse');
    await loadScript('script[data-ui-direction-triangles]','/assets/js/ui-direction-triangles.js?v=1.8.0','uiDirectionTriangles');
  };
  void boot().catch(error=>console.error('Garden Keeper bootstrap failed',error));
},{once:true});
