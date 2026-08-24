/* Shadow Garden v1.15.14 — volume covers mirror their Read/Continue/Read Again action. */
(()=>{
  const root=document.querySelector("#seriesRoot");
  if(!root)return;

  function wireVolumeCovers(){
    root.querySelectorAll(".volume-card").forEach(card=>{
      const read=card.querySelector(".volume-actions a.read");
      if(!read)return;
      let link=card.querySelector(":scope > .volume-cover-link");
      if(!link){
        const cover=card.querySelector(":scope > .volume-cover");
        if(!cover)return;
        link=document.createElement("a");
        link.className="volume-cover-link";
        cover.replaceWith(link);
        link.appendChild(cover);
      }
      const title=card.querySelector(".volume-title")?.textContent?.trim()||"volume";
      const state=read.dataset.volumeState||card.dataset.readingState||"unread";
      const action=read.textContent.trim()||"Read";
      link.href=read.href;
      link.dataset.volumeState=state;
      link.dataset.volumeTitle=read.dataset.volumeTitle||title;
      link.setAttribute("aria-label",`${action} ${title}`);
      link.title=`${action} ${title}`;
    });
  }

  const observer=new MutationObserver(wireVolumeCovers);
  observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:["data-reading-state","data-volume-state"]});
  wireVolumeCovers();
})();
