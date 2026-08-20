(()=>{
  const header=document.querySelector('.site-header');
  if(!header)return;
  const nav=header.querySelector('nav');
  const trigger=header.querySelector('.brand-mark');
  if(!nav||!trigger)return;

  if(!nav.id)nav.id='siteNav';
  trigger.setAttribute('aria-controls',nav.id);
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-label','Open navigation');

  const backdrop=document.createElement('div');
  backdrop.className='site-nav-backdrop';
  backdrop.hidden=true;
  document.body.appendChild(backdrop);

  let open=false;
  const focusable=()=>[...nav.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node=>!node.hidden);
  const setOpen=(next,{returnFocus=false}={})=>{
    open=Boolean(next);
    nav.classList.toggle('nav-open',open);
    trigger.classList.toggle('menu-open',open);
    document.body.classList.toggle('site-nav-open',open);
    trigger.setAttribute('aria-expanded',String(open));
    trigger.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    nav.setAttribute('aria-hidden',open?'false':'true');
    backdrop.hidden=!open;
    if(open){
      const first=focusable()[0];
      window.setTimeout(()=>first?.focus({preventScroll:true}),60);
    }else if(returnFocus){
      window.setTimeout(()=>trigger.focus({preventScroll:true}),0);
    }
  };

  trigger.addEventListener('click',event=>{
    event.preventDefault();
    setOpen(!open,{returnFocus:open});
  });
  backdrop.addEventListener('click',()=>setOpen(false,{returnFocus:true}));

  document.addEventListener('keydown',event=>{
    if(!open)return;
    if(event.key==='Escape'){
      event.preventDefault();
      setOpen(false,{returnFocus:true});
      return;
    }
    if(event.key!=='Tab')return;
    const items=focusable();
    if(!items.length){event.preventDefault();trigger.focus();return}
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });

  nav.addEventListener('click',event=>{
    if(event.target.closest('a,button'))window.setTimeout(()=>setOpen(false),0);
  });
  setOpen(false);
})();
