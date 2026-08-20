/* Turn each volume cover into the same reader link used by its Read/Continue button. */
(()=>{
  const root=document.querySelector("#seriesRoot");
  if(!root)return;

  function wireVolumeCovers(){
    root.querySelectorAll(".volume-card").forEach(card=>{
      const cover=card.querySelector(":scope > .volume-cover");
      const read=card.querySelector(".volume-actions a.read");
      if(!cover||!read||cover.parentElement?.classList.contains("volume-cover-link"))return;
      const link=document.createElement("a");
      link.className="volume-cover-link";
      link.href=read.href;
      link.setAttribute("aria-label",`Read ${card.querySelector(".volume-title")?.textContent?.trim()||"volume"}`);
      cover.replaceWith(link);
      link.appendChild(cover);
    });
  }

  const observer=new MutationObserver(wireVolumeCovers);
  observer.observe(root,{childList:true,subtree:true});
  wireVolumeCovers();
})();
