/* Shadow Garden v1.6.0 — Catalog History deletion controls. */
(()=>{
  const list=document.getElementById('backupList');
  if(!list)return;

  function enhance(){
    list.querySelectorAll('[data-restore-backup]').forEach(restore=>{
      const id=restore.dataset.restoreBackup;
      const actions=restore.closest('.maintenance-item-actions');
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
      await api('/admin-api/backup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'delete',id})});
      if(typeof window.loadMaintenance==='function')await window.loadMaintenance(true);
    }catch(error){
      alert(error.message);
      button.disabled=false;
    }
  }

  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-delete-backup]');
    if(button){event.preventDefault();deleteBackup(button.dataset.deleteBackup,button)}
  });
  new MutationObserver(enhance).observe(list,{childList:true,subtree:true});
  enhance();
})();

/* v1.7+ runs after every deferred Garden Keeper controller has initialized, including the
   targeted-series New Books layer. This keeps the existing uploader engine intact. */
window.addEventListener('DOMContentLoaded',()=>{
  const addStyle=(selector,href,datasetKey)=>{
    if(document.querySelector(selector))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=href;link.dataset[datasetKey]='1';document.head.appendChild(link);
  };
  addStyle('link[data-admin-v17]','/assets/css/admin-v1.7.css?v=1.7.0','adminV17');
  addStyle('link[data-admin-v171]','/assets/css/admin-v1.7.1.css?v=1.7.1','adminV171');
  addStyle('link[data-admin-v172]','/assets/css/admin-v1.7.2.css?v=1.7.2','adminV172');

  const loadCompletionFix=()=>{
    if(document.querySelector('script[data-admin-upload-completion-v171]'))return;
    const fix=document.createElement('script');
    fix.src='/assets/js/admin-upload-completion-v1.7.1.js?v=1.7.1';
    fix.dataset.adminUploadCompletionV171='1';
    document.body.appendChild(fix);
  };
  const loadPolish=()=>{
    if(document.querySelector('script[data-admin-v172]'))return;
    const polish=document.createElement('script');
    polish.src='/assets/js/admin-v1.7.2.js?v=1.7.3';
    polish.dataset.adminV172='1';
    document.body.appendChild(polish);
  };
  const afterWorkflow=()=>{loadCompletionFix();loadPolish()};

  const existing=document.querySelector('script[data-admin-upload-v17]');
  if(existing){
    if(existing.dataset.loaded==='1')afterWorkflow();
    else existing.addEventListener('load',()=>{existing.dataset.loaded='1';afterWorkflow()},{once:true});
    return;
  }

  const script=document.createElement('script');
  script.src='/assets/js/admin-upload-workflow-v1.7.0.js?v=1.7.0';
  script.dataset.adminUploadV17='1';
  script.addEventListener('load',()=>{script.dataset.loaded='1';afterWorkflow()},{once:true});
  document.body.appendChild(script);
},{once:true});
