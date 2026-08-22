/* Shadow Garden v1.8.0 — Garden Keeper backup actions + compatibility bootstrap.
 *
 * This file remains under its historical name because admin.html references it directly.
 * All post-v1.6 visual patches are consolidated into admin-current.css, and runtime add-ons are
 * loaded in one explicit order after the base deferred controllers have initialized.
 */
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
  if(!document.querySelector('link[data-admin-v17]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/css/admin-current.css?v=1.8.0';
    link.dataset.adminV17='1';
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
    await loadScript('script[data-admin-upload-v17]','/assets/js/admin-upload-workflow-v1.7.0.js?v=1.8.0','adminUploadV17');
    await loadScript('script[data-admin-upload-completion-v171]','/assets/js/admin-upload-completion-v1.7.1.js?v=1.8.0','adminUploadCompletionV171');
    await loadScript('script[data-admin-v172]','/assets/js/admin-v1.7.2.js?v=1.8.0','adminV172');
    await loadScript('script[data-admin-backup-v174]','/assets/js/admin-backup-history-v1.7.4.js?v=1.8.0','adminBackupV174');
    await loadScript('script[data-ui-direction-triangles]','/assets/js/ui-direction-triangles.js?v=1.8.0','uiDirectionTriangles');
  };
  void boot().catch(error=>console.error('Garden Keeper compatibility bootstrap failed',error));
},{once:true});
