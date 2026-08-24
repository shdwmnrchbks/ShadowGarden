/* Shadow Garden R5 — fields required by the Upload workflow before its engine initializes. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$}=keeper.util;
  const description=$("#descriptionInput")?.closest("label");
  if(description&&!$("#audioAlignedInput")){
    const field=document.createElement("label");field.className="admin-field wide";
    field.innerHTML='<span>Audio-aligned EPUB folder URL (series, optional)</span><input id="audioAlignedInput" type="url" inputmode="url" placeholder="https://example.com/series-audio-epubs/">';
    description.before(field);
  }
})();