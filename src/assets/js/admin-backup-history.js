/* Shadow Garden — authoritative Catalog History row renderer. */
(()=>{
  const list=document.getElementById('backupList');
  if(!list)return;

  let observer=null;
  let scheduled=false;
  const textOf=el=>String(el?.textContent||'').trim();

  function rebuild(){
    scheduled=false;
    observer?.disconnect();
    try{
      for(const oldRow of [...list.children]){
        if(oldRow.classList.contains('sg-backup-row'))continue;
        const restore=oldRow.querySelector?.('[data-restore-backup]');
        if(!restore)continue;
        const id=restore.dataset.restoreBackup||'';
        if(!id)continue;

        const oldCopy=oldRow.querySelector('.maintenance-item-copy,.backup-history-copy');
        const reason=textOf(oldCopy?.querySelector('strong'))||'Catalog backup';
        const dateEl=oldCopy?[...oldCopy.children].find(el=>el.tagName==='SPAN'&&!el.classList.contains('backup-meta')):null;
        const date=textOf(dateEl)||'Unknown time';
        const chips=[...(oldCopy?.querySelectorAll('.backup-meta i')||[])].map(textOf).filter(Boolean);

        const row=document.createElement('article');
        row.className='sg-backup-row';
        row.dataset.backupId=id;

        const copy=document.createElement('div');
        copy.className='sg-backup-copy';
        const title=document.createElement('strong');
        title.className='sg-backup-title';
        title.textContent=reason;
        const stamp=document.createElement('time');
        stamp.className='sg-backup-date';
        stamp.textContent=date;
        const meta=document.createElement('div');
        meta.className='sg-backup-meta';
        for(const value of chips){
          const chip=document.createElement('span');
          chip.textContent=value;
          meta.appendChild(chip);
        }
        copy.append(title,stamp,meta);

        const actions=document.createElement('div');
        actions.className='sg-backup-actions';
        const restoreButton=document.createElement('button');
        restoreButton.type='button';
        restoreButton.className='admin-secondary';
        restoreButton.dataset.restoreBackup=id;
        restoreButton.textContent='Restore';
        const deleteButton=document.createElement('button');
        deleteButton.type='button';
        deleteButton.className='danger-button backup-delete-icon';
        deleteButton.dataset.deleteBackup=id;
        deleteButton.setAttribute('aria-label','Delete catalog backup');
        deleteButton.title='Delete backup';
        actions.append(restoreButton,deleteButton);

        row.append(copy,actions);
        oldRow.replaceWith(row);
      }
    }finally{
      observer?.observe(list,{childList:true,subtree:false});
    }
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(rebuild);
  }

  observer=new MutationObserver(schedule);
  observer.observe(list,{childList:true,subtree:false});
  schedule();
})();
