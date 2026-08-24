/* Shadow Garden R4 — protected Reader startup. */
import { createAuthorizedBookSession, finalizeBookSession } from "./reader/book-session.js";
import { startReader } from "./reader/app.js";

(async()=>{
  try{
    const session=await createAuthorizedBookSession();
    if(!session)return;
    await startReader(session);
    finalizeBookSession(session);
  }catch(error){
    console.error("Reader book authorization/startup failed",error);
    const loading=document.getElementById("readerLoading");
    if(loading){
      loading.classList.remove("hidden");
      loading.innerHTML=`<p>${String(error?.message||"Shadow Garden could not authorize this EPUB.").replace(/[&<>]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[char]))}</p>`;
    }
  }
})();
