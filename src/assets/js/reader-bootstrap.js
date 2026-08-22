/* Shadow Garden Security Milestone 2 — authorize the selected EPUB before Reader startup. */
(async()=>{
  const access=window.ShadowGardenBookAccess;
  try{
    if(access?.initial)await access.initial;
    await import("/assets/js/reader.js?v=1.5.0");
  }catch(error){
    console.error("Reader book authorization failed",error);
    const loading=document.getElementById("readerLoading");
    if(loading){
      loading.classList.remove("hidden");
      loading.innerHTML=`<p>${String(error?.message||"Shadow Garden could not authorize this EPUB.").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</p>`;
    }
  }
})();
