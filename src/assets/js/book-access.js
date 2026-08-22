/* Shadow Garden Security Milestone 2 — short-lived EPUB access tickets. */
(()=>{
  const nativeFetch=window.fetch.bind(window);
  const cache=new Map();
  const initialBook=new URLSearchParams(location.search).get("book")||"";
  const ACCESS_TIMEOUT_MS=12000;
  let renewalTimer=0;

  function normalizeIdentity(book){
    try{return new URL(String(book||""),location.href).pathname}catch{return String(book||"")}
  }
  function requestUrl(value){
    try{return new URL(value instanceof Request?value.url:String(value||""),location.href)}catch{return null}
  }
  function isRawEpubRequest(value){
    const url=requestUrl(value);
    return Boolean(url&&url.origin===location.origin&&url.pathname.startsWith("/media/shadow-garden/")&&url.pathname.toLowerCase().endsWith(".epub")&&!url.searchParams.has("sig"));
  }

  async function requestTicket(identity){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),ACCESS_TIMEOUT_MS);
    try{
      return await nativeFetch("/book-access",{
        method:"POST",
        credentials:"same-origin",
        signal:controller.signal,
        headers:{"content-type":"application/json"},
        body:JSON.stringify({book:identity})
      });
    }catch(error){
      if(error?.name==="AbortError")throw new Error("Book authorization timed out. Please try again.");
      throw error;
    }finally{
      clearTimeout(timer);
    }
  }

  async function resolve(book,{force=false}={}){
    const identity=normalizeIdentity(book);
    if(!identity)throw new Error("No EPUB was selected.");
    const now=Math.floor(Date.now()/1000);
    const cached=cache.get(identity);
    if(!force&&cached&&(!cached.protected||Number(cached.expiresAt)-now>45))return cached;

    const response=await requestTicket(identity);
    let payload=null;
    try{payload=await response.json()}catch{}
    if(response.status===503&&payload?.code==="ticketing_not_configured"){
      const legacy={url:identity,identity,protected:false,expiresAt:0};
      cache.set(identity,legacy);
      return legacy;
    }
    if(!response.ok||!payload?.url)throw new Error(payload?.error||`Book access failed (${response.status}).`);
    const resolved=new URL(payload.url,location.href);
    const result={url:resolved.pathname+resolved.search,identity,protected:true,expiresAt:Number(payload.expiresAt)||0,ttlSeconds:Number(payload.ttlSeconds)||0};
    cache.set(identity,result);
    return result;
  }

  function scheduleRenewal(ticket){
    clearTimeout(renewalTimer);
    if(!ticket?.protected||!initialBook)return;
    const delay=Math.max(30000,(Number(ticket.expiresAt)-Math.floor(Date.now()/1000)-60)*1000);
    renewalTimer=setTimeout(()=>{
      resolve(initialBook,{force:true}).then(scheduleRenewal).catch(error=>{
        console.warn("Reader ticket renewal delayed",error);
        renewalTimer=setTimeout(()=>resolve(initialBook,{force:true}).then(scheduleRenewal).catch(()=>{}),60000);
      });
    },delay);
  }

  window.fetch=async(input,init)=>{
    if(!isRawEpubRequest(input))return nativeFetch(input,init);
    const identity=normalizeIdentity(input instanceof Request?input.url:input);
    await resolve(identity);
    return nativeFetch(input,init);
  };

  async function download(book,filename=""){
    const ticket=await resolve(book);
    const link=document.createElement("a");
    link.href=ticket.url;
    link.download=filename||"";
    link.rel="nofollow";
    link.dataset.sgBookAccessBypass="1";
    link.style.display="none";
    document.body.appendChild(link);
    try{link.click()}finally{link.remove()}
    return ticket;
  }

  document.addEventListener("click",event=>{
    const link=event.target.closest?.("a[download]");
    if(!link||link.dataset.sgBookAccessBypass==="1"||!isRawEpubRequest(link.href))return;
    event.preventDefault();
    if(link.dataset.sgBookAccessBusy==="1")return;
    link.dataset.sgBookAccessBusy="1";
    const original=link.textContent;
    if(original)link.textContent="Preparing…";
    download(link.href,link.getAttribute("download")||"").catch(error=>{
      console.error("EPUB download authorization failed",error);
      alert(error?.message||"Could not prepare this EPUB download.");
    }).finally(()=>{
      delete link.dataset.sgBookAccessBusy;
      if(original)link.textContent=original;
    });
  });

  const initial=initialBook?resolve(initialBook):Promise.resolve(null);
  initial.then(scheduleRenewal).catch(()=>{});
  window.addEventListener("pagehide",()=>clearTimeout(renewalTimer),{once:true});
  window.ShadowGardenBookAccess={resolve,download,initial,identity:initialBook};
})();
