/* Shadow Garden v1.7.1 — reliable terminal handoff for the v1.7 upload workflow.
 *
 * The legacy batch uploader briefly writes COMPLETE, then its final renderQueue() can replace
 * that pill with WAITING/READY before MutationObserver callbacks run. The v1.7 workflow then
 * remains on its 100% Uploading screen even though B2 and the catalog are already finished.
 *
 * Treat q.running as the authoritative transaction boundary instead. Once a workflow upload
 * has actually been observed running and the legacy batch loop exits, re-emit COMPLETE after
 * the final queue redraw. The existing v1.7 controller then builds either its success or partial
 * completion screen from the captured per-item terminal states and returned series IDs.
 */
(()=>{
  const q=state?.batch;
  const dialog=document.querySelector('#addBooksDialog');
  const stage=document.querySelector('#uploadWorkflowStage');
  const uploadState=document.querySelector('#uploadState');
  if(!q||!dialog||!stage||!uploadState)return;

  let observedRunning=false;
  let completionSent=false;

  function uploadingStageVisible(){
    return dialog.classList.contains('sg-workflow-stage')&&Boolean(stage.querySelector('.upload-state-uploading'));
  }

  function check(){
    if(!uploadingStageVisible()){
      observedRunning=false;
      completionSent=false;
      return;
    }

    if(q.running){
      observedRunning=true;
      completionSent=false;
      return;
    }

    if(!observedRunning||completionSent)return;

    /* q.running flips false only in the legacy uploader's finally block, after the catalog loop
       has ended. Waiting one task also lets its final renderQueue()/pill reset finish first. */
    completionSent=true;
    setTimeout(()=>{
      if(!uploadingStageVisible()||q.running){completionSent=false;return}
      uploadState.textContent='COMPLETE';
      uploadState.className='state-pill ready';
      observedRunning=false;
    },0);
  }

  const timer=setInterval(check,160);
  dialog.addEventListener('close',()=>{observedRunning=false;completionSent=false});
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  check();
})();
