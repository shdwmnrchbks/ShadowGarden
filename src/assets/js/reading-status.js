/* Shadow Garden v1.15.14 — canonical browser-local volume reading state. */
(()=>{
  const KEY="sg-finished-books";
  const MARKER_PREFIX="sg-finished:";
  const EVENT="sg-reading-status-changed";
  const STATES=Object.freeze({UNREAD:"unread",IN_PROGRESS:"in-progress",FINISHED:"finished"});

  if(!document.querySelector('link[data-reading-status-style]')){
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="/assets/css/reading-status.css?v=1.15.3";
    link.dataset.readingStatusStyle="1";
    document.head.appendChild(link);
  }

  function load(){
    try{
      const value=JSON.parse(localStorage.getItem(KEY)||"{}");
      if(Array.isArray(value))return Object.fromEntries(value.filter(Boolean).map(id=>[String(id),Date.now()]));
      return value&&typeof value==="object"?value:{};
    }catch{return{}}
  }
  function save(value){
    try{localStorage.setItem(KEY,JSON.stringify(value));return true}catch(error){console.warn("Shadow Garden could not persist reading completion",error);return false}
  }
  function cleanId(value){return String(value||"").trim()}
  function cleanIds(values){return [...new Set((Array.isArray(values)?values:[values]).map(cleanId).filter(Boolean))]}
  function markerKey(id){return `${MARKER_PREFIX}${id}`}
  function markerFinished(id){try{return localStorage.getItem(markerKey(id))==="1"}catch{return false}}
  function isFinished(bookId){const id=cleanId(bookId);return Boolean(id&&(load()[id]||markerFinished(id)))}
  function isAnyFinished(ids){return cleanIds(ids).some(isFinished)}

  function setAliasesFinished(ids,finished=true){
    const aliases=cleanIds(ids);if(!aliases.length)return false;
    const state=load(),stamp=Date.now();
    try{
      for(const id of aliases){
        if(finished){state[id]=stamp;localStorage.setItem(markerKey(id),"1")}
        else{delete state[id];localStorage.removeItem(markerKey(id))}
      }
      if(!save(state))return false;
      const verified=aliases.every(id=>isFinished(id)===Boolean(finished));
      if(!verified)return false;
      window.dispatchEvent(new CustomEvent(EVENT,{detail:{bookId:aliases[0],bookIds:aliases,finished:Boolean(finished)}}));
      return true;
    }catch(error){
      console.warn("Shadow Garden could not persist reading completion aliases",error);
      return false;
    }
  }

  function setFinished(bookId,finished=true){return setAliasesFinished([bookId],finished)}
  function migrateFinished(fromId,toId){
    const from=cleanId(fromId),to=cleanId(toId);
    if(!from||!to||from===to||!isFinished(from))return false;
    const ok=setAliasesFinished([from,to],true);
    if(!ok)return false;
    try{
      const state=load();delete state[from];localStorage.removeItem(markerKey(from));save(state);
      window.dispatchEvent(new CustomEvent(EVENT,{detail:{bookId:to,bookIds:[to],finished:true,migratedFrom:from}}));
      return isFinished(to)&&!isFinished(from);
    }catch{return false}
  }

  function volumeId(volume){return cleanId(volume?.file||volume?.bookId)}
  function stableVolumeId(seriesId,volume,index=-1){
    const sid=cleanId(seriesId);if(!sid)return"";
    const number=Number(volume?.number);
    if(Number.isFinite(number))return `series:${sid}:volume:${number}`;
    const title=cleanId(volume?.title);
    if(title)return `series:${sid}:title:${title}`;
    return index>=0?`series:${sid}:index:${index}`:"";
  }
  function volumeAliases(seriesId,volume,index=-1,extra=[]){return cleanIds([volume?.file,volume?.bookId,stableVolumeId(seriesId,volume,index),...(Array.isArray(extra)?extra:[extra])])}
  function isVolumeFinished(seriesId,volume,index=-1){return isAnyFinished(volumeAliases(seriesId,volume,index))}
  function setVolumeFinished(seriesId,volume,finished=true,index=-1,extra=[]){return setAliasesFinished(volumeAliases(seriesId,volume,index,extra),finished)}

  function progressForIdentity(identity){
    const id=cleanId(identity);if(!id)return null;
    try{
      const value=JSON.parse(localStorage.getItem(`sg-progress:${id}`)||"null");
      return value&&typeof value==="object"?value:null;
    }catch{return null}
  }
  function progressForAliases(ids){
    const aliases=cleanIds(ids);
    let newest=null;
    for(const id of aliases){
      const item=progressForIdentity(id);
      if(!item)continue;
      if(!newest||(Number(item.updatedAt)||0)>(Number(newest.updatedAt)||0))newest=item;
    }
    return newest;
  }
  function volumeProgress(seriesId,volume,index=-1,extra=[]){return progressForAliases(volumeAliases(seriesId,volume,index,extra))}
  function progressAtBeginning(progress){
    if(!progress)return true;
    const page=Number(progress.page);
    if(Number.isFinite(page)&&page>0)return page<=1;
    const percentage=Number(progress.percentage);
    if(Number.isFinite(percentage))return percentage<=0.01;
    return true;
  }
  function volumeState(seriesId,volume,index=-1,extra=[]){
    if(isVolumeFinished(seriesId,volume,index))return STATES.FINISHED;
    const progress=volumeProgress(seriesId,volume,index,extra);
    return progressAtBeginning(progress)?STATES.UNREAD:STATES.IN_PROGRESS;
  }
  function actionLabelForState(state){
    if(state===STATES.FINISHED)return"Read Again";
    if(state===STATES.IN_PROGRESS)return"Continue";
    return"Read";
  }
  function clearProgressAliases(ids){
    const aliases=cleanIds(ids);if(!aliases.length)return true;
    try{
      for(const id of aliases)localStorage.removeItem(`sg-progress:${id}`);
      return aliases.every(id=>localStorage.getItem(`sg-progress:${id}`)===null);
    }catch(error){console.warn("Shadow Garden could not clear reading progress",error);return false}
  }
  function clearVolumeProgress(seriesId,volume,index=-1,extra=[]){return clearProgressAliases(volumeAliases(seriesId,volume,index,extra))}

  function finishedCount(series){const volumes=Array.isArray(series?.volumes)?series.volumes:[];return volumes.filter((volume,index)=>isVolumeFinished(series?.id,volume,index)).length}
  function seriesFinished(series){const volumes=Array.isArray(series?.volumes)?series.volumes:[];return volumes.length>0&&finishedCount(series)===volumes.length}

  window.ShadowGardenReadingStatus={KEY,MARKER_PREFIX,EVENT,STATES,load,isFinished,isAnyFinished,setFinished,setAliasesFinished,migrateFinished,volumeId,stableVolumeId,volumeAliases,isVolumeFinished,setVolumeFinished,progressForIdentity,progressForAliases,volumeProgress,progressAtBeginning,volumeState,actionLabelForState,clearProgressAliases,clearVolumeProgress,finishedCount,seriesFinished};
})();
