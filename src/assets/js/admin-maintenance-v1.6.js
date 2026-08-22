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
