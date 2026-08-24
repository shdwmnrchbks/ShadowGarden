/* Shadow Garden R4 — Paginated-mode navigation adapter. */
export function createPaginatedController({getRendition,beforeTurn}={}){
  function turn(direction){
    const rendition=getRendition?.();if(!rendition)return false;
    beforeTurn?.();
    if(direction<0)rendition.prev?.();else rendition.next?.();
    return true;
  }
  return{turn};
}
