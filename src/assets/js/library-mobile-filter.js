/* Shadow Garden v1.6.0 — mobile-only Library Filter collapse control. */
(()=>{
  const panel=document.querySelector('.filters');
  const toggle=document.getElementById('filterToggle');
  const head=panel?.querySelector('.filter-head');
  const clear=document.getElementById('clearFilters');
  const searchField=panel?.querySelector('.search-field');
  const searchStack=panel?.querySelector('.search-stack');
  const activeTags=document.getElementById('activeTags');
  const tagPicker=activeTags?.parentElement;
  if(!panel||!toggle||!head||!clear||!searchField||!searchStack)return;

  const scope=document.body.dataset.libraryScope||'main';
  const storageKey=`sg-mobile-filters-collapsed:${scope}`;
  const mobileQuery=window.matchMedia('(max-width: 720px)');
  const headActions=document.createElement('span');
  headActions.className='filter-head-actions';
  clear.before(headActions);
  headActions.appendChild(clear);

  function readCollapsed(){
    try{
      const saved=localStorage.getItem(storageKey);
      return saved===null?true:saved!=='0';
    }catch{return true}
  }
  function writeCollapsed(collapsed){try{localStorage.setItem(storageKey,collapsed?'1':'0')}catch{}}

  function placeToggle(collapsed){
    if(!mobileQuery.matches)return;
    if(collapsed)searchField.appendChild(toggle);
    else headActions.appendChild(toggle);
  }

  function placeActiveTags(collapsed){
    if(!activeTags||!tagPicker)return;
    if(mobileQuery.matches&&collapsed){
      searchField.insertAdjacentElement('afterend',activeTags);
      activeTags.classList.add('mobile-collapsed-tags');
    }else{
      tagPicker.appendChild(activeTags);
      activeTags.classList.remove('mobile-collapsed-tags');
    }
  }

  function syncToggle(collapsed){
    toggle.hidden=false;
    toggle.setAttribute('aria-expanded',collapsed?'false':'true');
    toggle.setAttribute('aria-label',collapsed?'Expand library filters':'Collapse library filters');
    toggle.title=collapsed?'Expand filters':'Collapse filters';
    toggle.textContent=collapsed?'▼':'▲';
    placeToggle(collapsed);
    placeActiveTags(collapsed);
  }

  function apply(){
    if(!mobileQuery.matches){
      panel.classList.remove('filters-collapsed');
      toggle.hidden=true;
      toggle.setAttribute('aria-expanded','true');
      headActions.appendChild(toggle);
      placeActiveTags(false);
      return;
    }
    const collapsed=readCollapsed();
    panel.classList.toggle('filters-collapsed',collapsed);
    syncToggle(collapsed);
  }

  toggle.addEventListener('click',()=>{
    if(!mobileQuery.matches)return;
    const collapsed=!panel.classList.contains('filters-collapsed');
    panel.classList.toggle('filters-collapsed',collapsed);
    writeCollapsed(collapsed);
    syncToggle(collapsed);
  });

  if(typeof mobileQuery.addEventListener==='function')mobileQuery.addEventListener('change',apply);
  else mobileQuery.addListener?.(apply);
  apply();
})();
