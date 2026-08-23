/* Shadow Garden v1.14 — Milestone 8 Abuse Watch */
(()=>{
  const maintenanceView=$("#maintenanceView");
  if(!maintenanceView)return;

  let card=$("#abuseWatchCard");
  if(!card){
    card=document.createElement("section");
    card.id="abuseWatchCard";
    card.className="admin-card maintenance-card";
    card.innerHTML=`
      <div class="admin-card-head">
        <div><span>WATCH</span><h2>Abuse Watch</h2></div>
        <strong id="abuseWatchState" class="state-pill">LOADING</strong>
      </div>
      <p class="maintenance-copy">Review persistent tripwire activations and significant Garden Keeper cooldowns. Network identities are HMAC-derived; raw IP addresses are never stored.</p>
      <div id="abuseWatchMetrics" class="maintenance-metrics"></div>
      <div class="maintenance-actions"><button id="refreshAbuseWatch" class="admin-secondary compact-button" type="button">Refresh Abuse Watch</button></div>
      <div id="abuseWatchList" class="maintenance-list"><div class="maintenance-empty">Loading security telemetry…</div></div>`;
    const anchor=$("#gardenHealthCard");
    if(anchor?.parentNode)anchor.insertAdjacentElement("afterend",card);
    else maintenanceView.prepend(card);
  }

  let loading=false;
  let snapshot=null;
  const arrLocal=value=>Array.isArray(value)?value:[];
  const safe=value=>esc(String(value??""));
  const fmtDate=value=>{try{return new Date(value).toLocaleString()}catch{return String(value||"")}};
  const fmtDuration=seconds=>{
    const value=Math.max(0,Number(seconds)||0);
    if(value>=3600)return`${Math.round(value/3600)}h`;
    if(value>=60)return`${Math.round(value/60)}m`;
    return`${Math.round(value)}s`;
  };
  const signalLabel=value=>String(value||"")
    .replace(/^media_/,"media ")
    .replace(/^turnstile_/,"Turnstile ")
    .replace(/^automation_/,"automation ")
    .replace(/^acquisition_/,"acquisition ")
    .replace(/_/g," ");

  function setPill(text,kind=""){
    const el=$("#abuseWatchState");
    if(!el)return;
    el.textContent=text;
    el.className=`state-pill ${kind}`.trim();
  }

  function metric(label,value){return`<div class="maintenance-metric"><strong>${safe(value)}</strong><span>${safe(label)}</span></div>`}

  function eventTitle(event){
    if(event.kind==="public_cooldown")return"Public access cooldown";
    if(event.kind==="admin_cooldown")return"Garden Keeper cooldown";
    return String(event.kind||"Security event").replace(/_/g," ");
  }

  function eventDetail(event,now){
    if(event.kind==="public_cooldown"){
      const remaining=Math.max(0,Number(event.cooldownUntil||0)-now);
      const bits=[`Trigger: ${signalLabel(event.trigger)}`,`score ${Number(event.score)||0}`];
      if(event.releasedAt)bits.push(`released ${fmtDate(event.releasedAt)}`);
      else if(remaining>0)bits.push(`${fmtDuration(remaining)} remaining`);
      else bits.push("expired");
      return bits.join(" · ");
    }
    if(event.kind==="admin_cooldown"){
      const detail=event.detail||{};
      return [`${Number(detail.failures)||0} failed unlocks`,`${fmtDuration(detail.retryAfterSeconds)} cooldown`].join(" · ");
    }
    return "Recorded security event";
  }

  function render(data){
    snapshot=data;
    const events=arrLocal(data?.events);
    const active=Number(data?.activeCooldowns)||0;
    const policy=data?.policy||{};
    setPill(active?`${active} ACTIVE`:events.length?"MONITORING":"QUIET",active?"error":"ready");
    $("#abuseWatchMetrics").innerHTML=[
      metric("Active cooldowns",active),
      metric("Recent events",events.length),
      metric("Tripwire window",fmtDuration(policy.windowSeconds||0)),
      metric("Public cooldown",fmtDuration(policy.cooldownSeconds||0))
    ].join("");

    const list=$("#abuseWatchList");
    if(!events.length){
      list.innerHTML='<div class="maintenance-empty maintenance-good">No recent abuse tripwires or significant Keeper cooldowns.</div>';
      return;
    }
    const now=Math.floor(Date.now()/1000);
    list.innerHTML=events.slice(0,50).map(event=>{
      const activePublic=event.kind==="public_cooldown"&&!event.releasedAt&&Number(event.cooldownUntil||0)>now;
      const client=String(event.clientId||"");
      return`<div class="maintenance-item">
        <div class="maintenance-item-copy">
          <strong>${safe(eventTitle(event))}</strong>
          <span>${safe(eventDetail(event,now))}</span>
          <span class="backup-meta"><i>${safe(fmtDate(event.createdAt))}</i><i>network ${safe(client.slice(0,8)||"unknown")}</i></span>
        </div>
        ${activePublic?`<div class="maintenance-item-actions"><button class="admin-secondary" type="button" data-release-abuse="${safe(client)}">Release</button></div>`:""}
      </div>`;
    }).join("");
  }

  async function loadAbuseWatch(force=false){
    if(loading)return;
    if(snapshot&&!force){render(snapshot);return}
    loading=true;setPill("LOADING");
    try{render(await api("/admin-api/abuse",{method:"GET"}))}
    catch(error){
      console.error("Abuse Watch load failed",error);
      setPill("FAILED","error");
      $("#abuseWatchList").innerHTML=`<div class="maintenance-empty maintenance-bad">${safe(error.message)}</div>`;
    }finally{loading=false}
  }
  window.loadAbuseWatch=loadAbuseWatch;

  async function release(clientId){
    if(!clientId)return;
    if(!confirm("Release this public access cooldown? This does not erase the recorded event."))return;
    try{
      const data=await api("/admin-api/abuse",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"release",clientId})
      });
      render(data);
    }catch(error){alert(error.message)}
  }

  $("#openMaintenance")?.addEventListener("click",()=>void loadAbuseWatch());
  $("#refreshMaintenance")?.addEventListener("click",()=>void loadAbuseWatch(true));
  $("#refreshAbuseWatch")?.addEventListener("click",()=>void loadAbuseWatch(true));
  $("#abuseWatchList")?.addEventListener("click",event=>{
    const button=event.target.closest("[data-release-abuse]");
    if(button)void release(button.dataset.releaseAbuse);
  });
})();
