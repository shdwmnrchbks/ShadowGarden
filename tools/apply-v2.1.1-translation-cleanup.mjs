import fs from "node:fs/promises";

const read=file=>fs.readFile(file,"utf8");
const write=(file,content)=>fs.writeFile(file,content);
function replaceOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error(`Missing marker: ${label}`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Ambiguous marker: ${label}`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
async function patch(file,mutator){
  const source=await read(file),next=mutator(source);
  if(next===source)throw new Error(`No change produced for ${file}`);
  await write(file,next);
}

await patch("src/assets/js/library.js",source=>replaceOnce(
  source,
  '    setupAdultGate();\n    bindControls();',
  '    setupAdultGate();\n    mountTranslatorFilter();\n    bindControls();',
  "translator filter listener initialization"
));

await patch("src/assets/js/admin-batch.js",source=>{
  let next=source;
  next=replaceOnce(next,
    '  const inputIds=["seriesInput","volumeInput","yearInput","titleInput","authorInput","tagsInput","descriptionInput","adultInput","audioAlignedInput","translationStatusInput","translatorNameInput","translatorGroupInput","translatorUrlInput","translatorCoverageInput"];',
    '  const inputIds=["seriesInput","volumeInput","yearInput","titleInput","authorInput","tagsInput","descriptionInput","adultInput","audioAlignedInput","translationStatusInput","translatorNameInput","translatorUrlInput","translatorCoverageInput"];',
    "retired translator group upload field"
  );

  const inspectMarker='  async function inspect(file){';
  const helper=[
    '  function epubTranslatorNames(opf){',
    '    const refinedRoles=new Map();',
    '    for(const meta of localElements(opf,"meta")){',
    '      if(normalizeText(meta.getAttribute("property"))!=="role")continue;',
    '      const refines=String(meta.getAttribute("refines")||"").trim();',
    '      if(refines.startsWith("#"))refinedRoles.set(refines.slice(1),normalizeText(meta.textContent));',
    '    }',
    '    const translatorRole=value=>{',
    '      const role=normalizeText(value);if(!role)return false;',
    '      const tail=role.split(/[:\\/#]/).filter(Boolean).pop()||"";',
    '      return role==="trl"||role==="translator"||tail==="trl"||tail==="translator";',
    '    };',
    '    const names=[],seen=new Set();',
    '    for(const node of localElements(opf,"contributor")){',
    '      const id=node.getAttribute("id")||"";',
    '      const nsRole=typeof node.getAttributeNS==="function"?node.getAttributeNS("http://www.idpf.org/2007/opf","role"):"";',
    '      const role=node.getAttribute("role")||node.getAttribute("opf:role")||nsRole||refinedRoles.get(id)||"";',
    '      if(!translatorRole(role))continue;',
    '      const name=String(node.textContent||"").trim();if(!name)continue;',
    '      const key=normalizeText(name);if(seen.has(key))continue;seen.add(key);names.push(name);',
    '    }',
    '    return names;',
    '  }',
    ''
  ].join("\n");
  next=replaceOnce(next,inspectMarker,helper+inspectMarker,"EPUB contributor translator scanner");

  next=replaceOnce(next,
    '    const author=firstText(opf,"creator"),date=firstText(opf,"date"),language=firstText(opf,"language"),publisher=firstText(opf,"publisher");\n    const description=cleanHtml(firstText(opf,"description")),tags=[...new Set(texts(opf,"subject"))];',
    '    const author=firstText(opf,"creator"),date=firstText(opf,"date"),language=firstText(opf,"language"),publisher=firstText(opf,"publisher");\n    const translatorNames=epubTranslatorNames(opf);\n    const description=cleanHtml(firstText(opf,"description")),tags=[...new Set(texts(opf,"subject"))];',
    "translator metadata extraction"
  );

  next=replaceOnce(next,
    '    return{file,title,author,date,year:parseInt(date.slice(0,4))||"",language,publisher,description,tags,series,number,coverBlob,coverExt,sha256,validation:finish(r)};',
    '    return{file,title,author,date,year:parseInt(date.slice(0,4))||"",language,publisher,description,tags,series,number,coverBlob,coverExt,sha256,translations:translatorNames.slice(0,1).map(name=>({name})),validation:finish(r)};',
    "translator metadata preseed"
  );

  next=replaceOnce(next,
    '    item.translationStatus=$("#translationStatusInput")?.value||"";\n    const translation={name:$("#translatorNameInput")?.value.trim()||"",group:$("#translatorGroupInput")?.value.trim()||"",url:$("#translatorUrlInput")?.value.trim()||"",coverage:$("#translatorCoverageInput")?.value.trim()||""};item.translations=translation.name||translation.group?[translation]:[];',
    '    item.translationStatus=$("#translationStatusInput")?.value||"";\n    const translation={name:$("#translatorNameInput")?.value.trim()||"",url:$("#translatorUrlInput")?.value.trim()||"",coverage:$("#translatorCoverageInput")?.value.trim()||""};item.translations=translation.name?[translation]:[];',
    "upload translator serialization"
  );

  next=replaceOnce(next,
    '    const translation=item.translations?.[0]||{};if($("#translatorNameInput"))$("#translatorNameInput").value=translation.name||"";if($("#translatorGroupInput"))$("#translatorGroupInput").value=translation.group||"";if($("#translatorUrlInput"))$("#translatorUrlInput").value=translation.url||"";if($("#translatorCoverageInput"))$("#translatorCoverageInput").value=translation.coverage||"";',
    '    const translation=item.translations?.[0]||{};if($("#translatorNameInput"))$("#translatorNameInput").value=translation.name||"";if($("#translatorUrlInput"))$("#translatorUrlInput").value=translation.url||"";if($("#translatorCoverageInput"))$("#translatorCoverageInput").value=translation.coverage||"";',
    "upload translator editor hydration"
  );

  next=replaceOnce(next,
    '        Object.assign(item,meta,{file,status:"queued",metaReady:Boolean(meta.title),adult:false,audioAlignedUrl:"",translationStatus:"",translations:[]});',
    '        Object.assign(item,meta,{file,status:"queued",metaReady:Boolean(meta.title),adult:false,audioAlignedUrl:"",translationStatus:meta.translationStatus||"",translations:arr(meta.translations)});',
    "preserve scanned translator metadata"
  );
  return next;
});

console.log("Applied v2.1.1 translation cleanup patches.");
