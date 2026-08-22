/* Shadow Garden v1.7.0 — shelf-scoped collapsible pinned-series sidebar and library indicators. */
(()=>{
  const nav=document.querySelector('.site-header nav');
  if(!nav||!window.ShadowGardenData)return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const arr=value=>Array.isArray(value)?value:[];
  const pinnedIds=()=>{try{return new Set(JSON.parse(localStorage.getItem('sg-pinned')||'[]'))}catch{return new Set()}};
  const collapseKey='sg-pinned-nav-collapsed';

  nav.querySelector('#pinnedNav')?.remove();

  const section=document.createElement('section');
  section.className='nav-pinned-section';
  section.innerHTML=`<button class="nav-pinned-toggle" type="button" data-nav-keep-open aria-expanded="true"><strong>Pinned series</strong><span aria-hidden="true">▲</span></button><div class="nav-pinned-list"></div>`;
  nav.appendChild(section);
  const toggle=section.querySelector('.nav-pinned-toggle');
  const list=section.querySelector('.nav-pinned-list');

  function readCollapsed(){try{return localStorage.getItem(collapseKey)==='1'}catch{return false}}
  function setCollapsed(collapsed,save=true){
    section.classList.toggle('is-collapsed',collapsed);
    toggle.setAttribute('aria-expanded',String(!collapsed));
    toggle.querySelector('span').textContent=collapsed?'▼':'▲';
    if(save){try{localStorage.setItem(collapseKey,collapsed?'1':'0')}catch{}}
  }
  setCollapsed(readCollapsed(),false);
  toggle.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    setCollapsed(!section.classList.contains('is-collapsed'));
  });

  const requestedSeries=new URLSearchParams(location.search).get('id')||'';
  const currentAdult=document.body.dataset.libraryScope==='nsfw'||document.body.classList.contains('adult-library')||requestedSeries.startsWith('adult-');
  const currentScope=currentAdult?'adult':'main';
  const catalogPromise=window.ShadowGardenData.loadCatalog(currentAdult)
    .catch(()=>({series:[]}))
    .then(catalog=>arr(catalog?.series).map(series=>({...series,__scope:currentScope})));

  function markCards(){
    const pins=pinnedIds();
    document.querySelectorAll('.series-card').forEach(card=>{
      let id='';
      try{id=new URL(card.getAttribute('href')||'',location.href).searchParams.get('id')||''}catch{}
      const cover=card.querySelector('.cover');
      if(!cover)return;
      let badge=cover.querySelector('.pinned-indicator');
      if(pins.has(id)){
        if(!badge){badge=document.createElement('span');badge.className='pinned-indicator';badge.textContent='◆ Pinned';cover.appendChild(badge)}
      }else badge?.remove();
    });
  }

  async function render(){
    const pins=pinnedIds();
    const shelf=await catalogPromise;
    const pinned=shelf.filter(series=>pins.has(series.id)).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
    if(!pinned.length){
      list.innerHTML=`<div class="nav-pinned-empty">No pinned ${currentAdult?'18+ ':''}series yet.</div>`;
    }else{
      list.innerHTML=pinned.map(series=>`<a class="nav-pinned-entry" href="/series.html?id=${encodeURIComponent(series.id)}"><span class="pin-mark" aria-hidden="true">◆</span><span class="pin-title">${esc(series.title||'Untitled series')}</span>${currentAdult?'<span class="pin-scope">18+</span>':''}</a>`).join('');
    }
    markCards();
  }

  const observer=new MutationObserver(markCards);
  const grid=document.querySelector('#catalogGrid');
  if(grid)observer.observe(grid,{childList:true,subtree:true});

  document.addEventListener('click',event=>{
    if(event.target.closest('#pinButton'))window.setTimeout(()=>void render(),0);
  });
  window.addEventListener('storage',event=>{if(event.key==='sg-pinned'||event.key===collapseKey)void render()});
  void render();
})();
