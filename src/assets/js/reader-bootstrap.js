/* Shadow Garden Security Milestones 2–3 — authorize and resolve the selected book before Reader startup. */
(async()=>{
  const access=window.ShadowGardenBookAccess;
  try{
    const ticket=access?.initial?await access.initial:null;
    if(ticket?.identity&&access?.migrateLegacyState)await access.migrateLegacyState([ticket.identity]);
    if(ticket?.url)window.__sgReaderBookSource=ticket.url;
    if(ticket?.identity)window.__sgReaderBookIdentity=ticket.identity;
    await import("/assets/js/reader.js?v=1.9.0");
  }catch(error){
    console.error("Reader book authorization failed",error);
    const loading=document.getElementById("readerLoading");
    if(loading){
      loading.classList.remove("hidden");
      loading.innerHTML=`<p>${String(error?.message||"Shadow Garden could not authorize this EPUB.").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</p>`;
    }
  }
})();
