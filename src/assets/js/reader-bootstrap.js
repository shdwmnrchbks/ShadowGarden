/* Shadow Garden R4 — protected Reader startup. */
import { createAuthorizedBookSession, finalizeBookSession } from "./reader/book-session.js";
import { startReader } from "./reader/app.js";
import { showReaderFailure } from "./reader/error-presentation.js";
import { installReaderInteractionController } from "./reader/interaction-controller.js";
import { urls } from "./domain/index.js";
import "./reader/image-focus-touch-compat.js";

const interactions=installReaderInteractionController();

(async()=>{
  let session=null;
  try{
    session=await createAuthorizedBookSession();
    if(!session)return;
    interactions.stage("Opening the EPUB…","epub");
    await startReader(session);
    finalizeBookSession(session);
  }catch(error){
    console.error("Reader book authorization/startup failed",error);
    const loading=document.getElementById("readerLoading");
    const hasSeries=Boolean(session?.seriesId);
    const returnHref=hasSeries?urls.seriesUrl(session.seriesId):urls.libraryUrl(session?.adult===true);
    showReaderFailure({container:loading,error,phase:session?"open":"authorization",returnHref,returnLabel:hasSeries?"Return to series":"Return to library"});
  }
})();
