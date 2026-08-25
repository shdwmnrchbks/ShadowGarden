const STATUS_ALIASES=new Map([
  ["complete","Complete"],["completed","Complete"],["finished","Complete"],
  ["ongoing","Ongoing"],["active","Ongoing"],["current","Ongoing"],
  ["stalled","Stalled"],["paused","Stalled"],["inactive","Stalled"],
  ["partial","Partial"],["incomplete","Partial"]
]);
export const TRANSLATION_STATUSES=Object.freeze(["Complete","Ongoing","Stalled","Partial"]);
const clean=(value,max=500)=>String(value??"").trim().slice(0,max);

export function normalizeTranslationStatus(value){
  return STATUS_ALIASES.get(clean(value,80).toLowerCase())||"";
}

function external(value){
  const raw=clean(value,2000);
  if(!raw)return{ok:true,value:""};
  try{
    const url=new URL(raw);
    return["http:","https:"].includes(url.protocol)?{ok:true,value:url.href}:{ok:false};
  }catch{return{ok:false}}
}

export function validateTranslationCredits(value){
  if(value!=null&&!Array.isArray(value))return{ok:false,error:"Translation credits must be an array"};
  const credits=[],seen=new Set();
  for(const raw of Array.isArray(value)?value:[]){
    if(!raw||typeof raw!=="object")continue;
    const name=clean(raw.name,160);
    if(!name)continue;
    const url=external(raw.url);
    if(!url.ok)return{ok:false,error:`Translator URL for ${name} must use http:// or https://`};
    const coverage=clean(raw.coverage,300);
    const credit={name,...(url.value?{url:url.value}:{}),...(coverage?{coverage}:{})};
    const key=[credit.name,credit.url||"",credit.coverage||""].join("\u0000").toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);credits.push(credit);
    if(credits.length>=24)break;
  }
  return{ok:true,value:credits};
}
