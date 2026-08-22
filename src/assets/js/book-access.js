/* Shadow Garden Security Milestone 2 — short-lived EPUB access tickets. */
(()=>{
  const nativeFetch=window.fetch.bind(window);
  const cache=new Map();
  const initialBook=new URLSearchParams(location.search).get("book")||"";

  function normalizeIdentity(book){
    try{return new URL(String(book||""),location.href).pathname}catch{return String(book||"")}
  }
  function isRawEpubRequest(value){
    try{
      const url=new URL(value instanceof Request?value.url:String(value||""),location.href);
      return url.origin===location.origin&&url.pathname.startsWith("/media/shadow-garden/")&&url.pathname.toLowerCase().endsWith(".epub")&&!url.searchParams.has("sig");
    }catch{return false}
  }

  async function resolve(book){
    const identity=normalizeIdentity(book);
    if(!identity)throw new Error("No EPUB was selected.");
    const now=Math.floor(Date.now()/1000);
    const cached=cache.get(identity);
    if(cached&&(!cached.protected||Number(cached.expiresAt)-now>45))return cached;

    const response=await nativeFetch("/book-access",{
      method:"POST",
      credentials:"same-origin",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({book:identity})
    });
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
    link.style.display="none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return ticket;
  }

  const initial=initialBook?resolve(initialBook):Promise.resolve(null);
  window.ShadowGardenBookAccess={resolve,download,initial,identity:initialBook};
})();
