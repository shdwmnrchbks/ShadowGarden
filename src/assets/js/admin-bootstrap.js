/* Shadow Garden v1.15.10 — Garden Keeper security + current workflow bootstrap. */
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
  /* Milestone 9: public cover URLs must not disclose series slugs, volume numbers, or
     source-image fingerprints. Existing catalog URLs are intentionally left untouched;
     every new Garden Keeper cover upload is rewritten to an opaque cv_ identifier. */
  const installOpaqueCoverStorage=()=>{
    if(window.ShadowGardenOpaqueCoverStorage?.installed)return;
    if(typeof api!=='function'||typeof uploadObject!=='function'){
      console.warn('Opaque cover storage could not initialize');
      return;
    }
    const originalApi=api;
    const originalUploadObject=uploadObject;
    const prefix='shadow-garden/covers/';
    const opaquePattern=/^shadow-garden\/covers\/cv_[A-Za-z0-9_-]{20,64}-(?:detail|thumb)\.[A-Za-z0-9]+$/i;
    const mappedKeys=new Map();
    const rootIds=new Map();

    const randomCoverId=()=>{
      if(globalThis.crypto?.getRandomValues){
        const bytes=new Uint8Array(16);
        crypto.getRandomValues(bytes);
        let binary='';
        for(const value of bytes)binary+=String.fromCharCode(value);
        return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
      }
      if(globalThis.crypto?.randomUUID)return crypto.randomUUID().replace(/-/g,'');
      throw new Error('Secure random cover identifiers are unavailable in this browser.');
    };

    const opaqueCoverKey=key=>{
      const raw=String(key||'');
      if(!raw.startsWith(prefix)||opaquePattern.test(raw))return raw;
      const extension=(raw.match(/(\.[A-Za-z0-9]+)$/)||[])[1]?.toLowerCase();
      if(!extension)throw new Error('Cover upload is missing a file extension.');
      const stem=raw.slice(prefix.length,-extension.length);
      const variant=stem.match(/^(.*)-(detail|thumb)$/i);
      const root=variant?variant[1]:stem;
      const kind=(variant?.[2]||'detail').toLowerCase();
      let id=rootIds.get(root);
      if(!id){id=randomCoverId();rootIds.set(root,id)}
      const opaque=`${prefix}cv_${id}-${kind}${extension}`;
      mappedKeys.set(raw,opaque);
      return opaque;
    };

    const rewriteCoverKeys=value=>{
      if(Array.isArray(value))return value.map(rewriteCoverKeys);
      if(!value||typeof value!=='object')return value;
      const copy={};
      for(const [key,item] of Object.entries(value)){
        if((key==='coverKey'||key==='coverThumbKey')&&typeof item==='string')copy[key]=mappedKeys.get(item)||item;
        else copy[key]=rewriteCoverKeys(item);
      }
      return copy;
    };

    uploadObject=async function(key,blob,type){
      return originalUploadObject(opaqueCoverKey(key),blob,type);
    };
    api=async function(path,options={}){
      let next=options;
      if(typeof options?.body==='string'&&String(path||'').startsWith('/admin-api/')){
        try{
          const parsed=JSON.parse(options.body);
          next={...options,body:JSON.stringify(rewriteCoverKeys(parsed))};
        }catch{}
      }
      return originalApi(path,next);
    };
    window.ShadowGardenOpaqueCoverStorage={installed:true,opaqueCoverKey,mappedKeys};
  };
  installOpaqueCoverStorage();

  if(!document.querySelector('link[data-admin-current]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/css/admin-current.css?v=1.15.0';
    link.dataset.adminCurrent='1';
    document.head.appendChild(link);
  }
  if(!document.querySelector('link[data-admin-version]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/css/admin-version.css?v=1.15.3';
    link.dataset.adminVersion='1';
    document.head.appendChild(link);
  }
  if(!document.querySelector('link[data-admin-series-banner]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/css/admin-v1.9.4.css?v=1.9.4';
    link.dataset.adminSeriesBanner='1';
    document.head.appendChild(link);
  }

  const mountVersion=async()=>{
    let footer=document.querySelector('.admin-version-footer');
    if(!footer){
      footer=document.createElement('footer');
      footer.className='admin-version-footer';
      footer.setAttribute('aria-label','Deployment version');
      footer.innerHTML='<span id="adminVersion" class="admin-version">Version …</span>';
      document.body.appendChild(footer);
    }
    const label=footer.querySelector('#adminVersion');
    if(!label)return;
    try{
      const response=await fetch('/data/version.json',{cache:'no-store'});
      if(!response.ok)throw new Error(`version metadata ${response.status}`);
      const info=await response.json();
      const version=String(info?.version||'unknown');
      const commit=String(info?.shortCommit||'');
      label.textContent=`Shadow Garden v${version}${commit?` · ${commit}`:''}`;
      label.title=[`Shadow Garden v${version}`,commit?`Commit ${info.commit||commit}`:'',info?.builtAt?`Built ${new Date(info.builtAt).toLocaleString()}`:''].filter(Boolean).join(' · ');
    }catch(error){
      console.warn('Deployment version metadata unavailable',error);
      label.textContent='Shadow Garden · version unavailable';
    }
  };
  void mountVersion();

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
