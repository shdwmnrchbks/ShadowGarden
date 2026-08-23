/* Shadow Garden Security Milestone 7 — hardened Garden Keeper unlock. */
(()=>{
  const TURNSTILE_SCRIPT="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  const unlockButton=document.getElementById("unlockButton");
  const tokenInput=document.getElementById("adminToken");
  const authCard=document.getElementById("authCard");
  const authState=document.getElementById("authState");
  const lockButton=document.getElementById("lockButton");
  if(!unlockButton||!tokenInput||!authCard||!authState)return;

  let allowLegacyUnlockOnce=false;
  let turnstileScriptPromise=null;
  let widgetId=null;
  let challenge=null;
  let submitting=false;
  let cooldownTimer=0;

  function setAuthState(label,kind=""){
    authState.textContent=label;
    authState.className=`state-pill ${kind}`.trim();
  }

  function installStyles(){
    if(document.getElementById("sg-admin-security-style"))return;
    const style=document.createElement("style");
    style.id="sg-admin-security-style";
    style.textContent=`
      .admin-security-panel{margin:2px 0 14px;padding:13px;border:1px solid rgba(196,184,225,.14);border-radius:12px;background:rgba(154,134,211,.035)}
      .admin-security-panel.hidden{display:none!important}
      .admin-security-label{margin:0 0 9px;color:#9e96a8;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      .admin-security-widget{min-height:66px;display:grid;align-items:center;overflow:hidden}
      .admin-security-status{min-height:1.35em;margin:9px 0 0;color:#81798b;font-size:.69rem;line-height:1.45}
      .admin-security-status.error{color:#cf8181}
      .admin-security-panel[data-cooldown="true"]{border-color:rgba(207,129,129,.24);background:rgba(207,129,129,.035)}
      @media(max-width:520px){.admin-security-panel{padding:11px}.admin-security-widget{min-height:62px}}
    `;
    document.head.appendChild(style);
  }

  function panel(){
    let host=document.getElementById("adminSecurityPanel");
    if(host)return host;
    installStyles();
    host=document.createElement("section");
    host.id="adminSecurityPanel";
    host.className="admin-security-panel hidden";
    host.setAttribute("aria-label","Garden Keeper human verification");
    host.innerHTML=`
      <p class="admin-security-label">Keeper verification</p>
      <div class="admin-security-widget" data-admin-security-widget></div>
      <p class="admin-security-status" data-admin-security-status aria-live="polite"></p>`;
    unlockButton.insertAdjacentElement("beforebegin",host);
    return host;
  }

  function setPanelStatus(message,error=false){
    const host=panel();
    const status=host.querySelector("[data-admin-security-status]");
    status.textContent=message;
    status.classList.toggle("error",Boolean(error));
  }

  function loadTurnstile(){
    if(window.turnstile?.render)return Promise.resolve(window.turnstile);
    if(turnstileScriptPromise)return turnstileScriptPromise;
    turnstileScriptPromise=new Promise((resolve,reject)=>{
      const ready=()=>window.turnstile?.render?resolve(window.turnstile):reject(new Error("Keeper verification did not initialize."));
      const existing=document.querySelector('script[data-sg-turnstile]');
      if(existing){
        existing.addEventListener("load",ready,{once:true});
        existing.addEventListener("error",()=>reject(new Error("Keeper verification could not be loaded.")),{once:true});
        if(window.turnstile?.render)resolve(window.turnstile);
        return;
      }
      const script=document.createElement("script");
      script.src=TURNSTILE_SCRIPT;
      script.async=true;
      script.defer=true;
      script.dataset.sgTurnstile="1";
      script.addEventListener("load",ready,{once:true});
      script.addEventListener("error",()=>reject(new Error("Keeper verification could not be loaded.")),{once:true});
      document.head.appendChild(script);
    }).catch(error=>{turnstileScriptPromise=null;throw error});
    return turnstileScriptPromise;
  }

  function stopCooldown(){
    clearInterval(cooldownTimer);
    cooldownTimer=0;
    panel().dataset.cooldown="false";
  }

  function beginCooldown(seconds){
    stopCooldown();
    let remaining=Math.max(1,Math.ceil(Number(seconds)||1));
    const host=panel();
    host.classList.remove("hidden");
    host.dataset.cooldown="true";
    unlockButton.disabled=true;
    const tick=()=>{
      setAuthState(`WAIT ${remaining}s`,"error");
      setPanelStatus(`Too many failed unlock attempts. Try again in ${remaining} second${remaining===1?"":"s"}.`,true);
      remaining--;
      if(remaining<0){
        stopCooldown();
        unlockButton.disabled=false;
        setAuthState("LOCKED");
        try{if(widgetId!==null)window.turnstile?.reset(widgetId)}catch{}
        setPanelStatus("Complete the verification to try again.");
      }
    };
    tick();
    if(remaining>=0)cooldownTimer=setInterval(tick,1000);
  }

  async function getChallenge(){
    const response=await fetch("/admin-access",{method:"GET",credentials:"same-origin",cache:"no-store"});
    let data=null;try{data=await response.json()}catch{}
    if(!response.ok||!data?.siteKey)throw new Error(data?.error||"Garden Keeper verification is unavailable.");
    return data;
  }

  async function establishSession(turnstileToken){
    if(submitting||cooldownTimer)return;
    submitting=true;
    unlockButton.disabled=true;
    setAuthState("VERIFYING");
    setPanelStatus("Checking your Garden Pass and keeper token…");
    try{
      const response=await fetch("/admin-access",{
        method:"POST",
        credentials:"same-origin",
        cache:"no-store",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({adminToken:tokenInput.value,turnstileToken})
      });
      let data=null;try{data=await response.json()}catch{}
      const retryAfter=Number(response.headers.get("Retry-After")||0);
      if(response.ok&&data?.ok){
        stopCooldown();
        setPanelStatus("Verified. Opening Garden Keeper…");
        panel().classList.add("hidden");
        allowLegacyUnlockOnce=true;
        unlockButton.disabled=false;
        unlockButton.click();
        return;
      }
      if(retryAfter>0){
        beginCooldown(retryAfter);
      }else{
        setAuthState("DENIED","error");
        setPanelStatus(data?.error||"Access denied. Please try again.",true);
        try{if(widgetId!==null)window.turnstile?.reset(widgetId)}catch{}
        unlockButton.disabled=false;
      }
    }catch(error){
      setAuthState("UNAVAILABLE","error");
      setPanelStatus(error?.message||"Garden Keeper verification is temporarily unavailable.",true);
      unlockButton.disabled=false;
      try{if(widgetId!==null)window.turnstile?.reset(widgetId)}catch{}
    }finally{
      submitting=false;
    }
  }

  async function beginUnlock(){
    if(submitting||cooldownTimer)return;
    if(!tokenInput.value.trim()){
      setAuthState("TOKEN NEEDED","error");
      tokenInput.focus();
      return;
    }
    unlockButton.disabled=true;
    setAuthState("CHECKING");
    const host=panel();
    host.classList.remove("hidden");
    setPanelStatus("Preparing Keeper verification…");
    try{
      if(!challenge)challenge=await getChallenge();
      const turnstile=await loadTurnstile();
      if(widgetId===null){
        const widgetHost=host.querySelector("[data-admin-security-widget]");
        widgetId=turnstile.render(widgetHost,{
          sitekey:challenge.siteKey,
          action:challenge.action||"admin_access",
          theme:"dark",
          size:"flexible",
          callback:token=>void establishSession(token),
          "expired-callback":()=>setPanelStatus("Verification expired. Complete it again.",true),
          "error-callback":()=>{setPanelStatus("Verification could not complete. Please try again.",true);return true},
          "timeout-callback":()=>setPanelStatus("Verification timed out. Please try again.")
        });
      }
      setPanelStatus("Complete the verification to unlock Garden Keeper.");
      unlockButton.disabled=false;
    }catch(error){
      setAuthState("UNAVAILABLE","error");
      setPanelStatus(error?.message||"Garden Keeper verification is unavailable.",true);
      unlockButton.disabled=false;
    }
  }

  document.addEventListener("click",event=>{
    if(event.target!==unlockButton&&!event.target.closest?.("#unlockButton"))return;
    if(allowLegacyUnlockOnce){
      allowLegacyUnlockOnce=false;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    void beginUnlock();
  },true);

  document.addEventListener("keydown",event=>{
    if(event.target!==tokenInput||event.key!=="Enter")return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void beginUnlock();
  },true);

  lockButton?.addEventListener("click",()=>{
    stopCooldown();
    challenge=null;
    panel().classList.add("hidden");
    void fetch("/admin-access",{method:"DELETE",credentials:"same-origin",cache:"no-store",keepalive:true}).catch(()=>{});
  });
})();
