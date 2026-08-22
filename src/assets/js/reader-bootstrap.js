/* Shadow Garden Security Milestones 2–3 — authorize and resolve the selected book before Reader startup. */
(async()=>{
  const access=window.ShadowGardenBookAccess;
  const requested=new URLSearchParams(location.search).get("book")||"";
  try{
    const ticket=access?.initial?await access.initial:null;
    if(ticket?.identity&&access?.migrateLegacyState)await access.migrateLegacyState([ticket.identity]);

    if(/^bk_[A-Za-z0-9_-]{22}$/.test(requested)&&ticket?.url){
      const sourcePath=new URL(ticket.url,location.href).pathname;
      if(/^\/media\/shadow-garden\/books\/.+\.epub$/i.test(sourcePath)){
        const next=new URL(location.href);
        next.searchParams.set("book",sourcePath);
        history.replaceState(history.state,"",`${next.pathname}${next.search}${next.hash}`);
        location.reload();
        return;
      }
    }

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
