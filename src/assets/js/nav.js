(()=>{
  const header=document.querySelector('.site-header');
  if(!header)return;
  const nav=header.querySelector('nav');
  const mark=header.querySelector('.brand-mark');
  if(!nav||!mark)return;

  if(!nav.id)nav.id='siteNav';
  mark.setAttribute('role','button');
  mark.setAttribute('tabindex','0');
  mark.setAttribute('aria-label','Open navigation');
  mark.setAttribute('aria-controls',nav.id);
  mark.setAttribute('aria-expanded','false');

  const backdrop=document.createElement('div');
  backdrop.className='site-nav-backdrop';
  backdrop.hidden=true;
  document.body.appendChild(backdrop);

  let open=false;
  const setOpen=next=>{
    open=!!next;
    nav.classList.toggle('nav-open',open);
    mark.classList.toggle('menu-open',open);
    document.body.classList.toggle('site-nav-open',open);
    mark.setAttribute('aria-expanded',String(open));
    mark.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    backdrop.hidden=!open;
    if(open){
      const first=nav.querySelector('a,button');
      window.setTimeout(()=>first?.focus({preventScroll:true}),80);
    }
  };

  const toggle=e=>{
    e.preventDefault();
    e.stopPropagation();
    setOpen(!open);
  };

  mark.addEventListener('click',toggle);
  mark.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){toggle(e)}
  });
  backdrop.addEventListener('click',()=>setOpen(false));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&open){setOpen(false);mark.focus({preventScroll:true})}
  });
  nav.addEventListener('click',e=>{
    if(e.target.closest('a,button'))window.setTimeout(()=>setOpen(false),0);
  });
})();
