/* Shadow Garden v2.1 — authenticated fan-translation metadata mutations. */
import { normalizeTranslationStatus, validateTranslationCredits } from "../_lib/translations.js";
import { requireAdmin } from "./auth.js";
import { invalidateCatalogCache, loadCatalogPair, locateSeries, saveCatalog, snapshotCatalogs } from "./catalog.js";
import { json, parseJson } from "./http.js";
import { writeClient } from "./storage.js";
import { clean } from "./validation.js";

export async function handleTranslationsPost({request,env}){
  if(!(await requireAdmin(request,env)))return json({ok:false,error:"Unauthorized"},401);
  const body=await parseJson(request);
  if(!body.ok)return json({ok:false,error:"Invalid JSON body"},400);
  const input=body.value||{},id=clean(input.id,180),target=clean(input.target,20);
  if(!id||!["series","volume"].includes(target))return json({ok:false,error:"Series id and translation target are required"},400);
  const parsed=validateTranslationCredits(input.translations);
  if(!parsed.ok)return json({ok:false,error:parsed.error},400);

  try{
    const aws=writeClient(env),data=await loadCatalogPair(aws),found=locateSeries(data,id);
    if(!found)return json({ok:false,error:"Series not found"},404);

    let volumeIndex=-1;
    if(target==="volume"){
      volumeIndex=Number(input.volumeIndex);
      const volumes=Array.isArray(found.series?.volumes)?found.series.volumes:[];
      if(!Number.isInteger(volumeIndex)||volumeIndex<0||volumeIndex>=volumes.length)return json({ok:false,error:"Volume not found"},404);
    }

    await snapshotCatalogs(aws,data.main,data.adult,target==="series"?"update-translation-credits":"update-volume-translation-override");

    if(target==="series"){
      const status=normalizeTranslationStatus(input.translationStatus);
      if(status)found.series.translationStatus=status;else delete found.series.translationStatus;
      if(parsed.value.length)found.series.translations=parsed.value;else delete found.series.translations;
    }else{
      const volume=found.series.volumes[volumeIndex];
      if(parsed.value.length)volume.translations=parsed.value;else delete volume.translations;
    }

    await saveCatalog(aws,found.key,found.catalog);
    await invalidateCatalogCache(request);
    return json({
      ok:true,
      id:found.series.id,
      target,
      translationStatus:found.series.translationStatus||"",
      translations:target==="series"?(found.series.translations||[]):(found.series.volumes[volumeIndex]?.translations||[])
    });
  }catch(error){
    console.error("Translation metadata update failed",error);
    return json({ok:false,error:"Could not update translation metadata",detail:String(error?.message||error)},502);
  }
}
