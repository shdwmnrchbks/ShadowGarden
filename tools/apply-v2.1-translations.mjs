import fs from "node:fs/promises";

const read=file=>fs.readFile(file,"utf8");
const write=(file,text)=>fs.writeFile(file,text);
function one(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error(`Missing ${label}`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Ambiguous ${label}`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
function afterLine(source,needle,line,label){
  const at=source.indexOf(needle);if(at<0)throw new Error(`Missing ${label}`);
  const end=source.indexOf("\n",at);if(end<0)throw new Error(`No line end for ${label}`);
  return source.slice(0,end+1)+line+"\n"+source.slice(end+1);
}
async function patch(file,fn){const source=await read(file),next=fn(source);if(next===source)throw new Error(`No change in ${file}`);await write(file,next)}
async function append(file,marker,lines){await patch(file,s=>s.includes(marker)?s:s.trimEnd()+"\n\n"+lines.join("\n")+"\n")}

await patch("src/assets/js/library.js",s=>{
  s=one(s,'query:"",author:"",tags:new Set()','query:"",author:"",translator:"",tags:new Set()','Library translator state');
  s=one(s,'  function collectFilters(){','  function mountTranslatorFilter(){\n    if($("#translatorSelect"))return;\n    const anchor=$("#authorSelect")?.closest(".filter-group");if(!anchor)return;\n    const group=document.createElement("div");group.className="filter-group";group.innerHTML=\'<label for="translatorSelect">Fan translator / group</label><select id="translatorSelect"><option value="">Any translator</option></select>\';anchor.after(group);\n  }\n\n  function collectFilters(){','translator filter mount');
  s=one(s,'    const options=model.filterOptions(state.items);','    const options=model.filterOptions(state.items);\n    mountTranslatorFilter();','translator filter mount call');
  s=afterLine(s,'$("#authorSelect").innerHTML=', '    $("#translatorSelect").innerHTML=\'<option value="">Any translator</option>\'+options.translators.map(translator=>`<option value="${esc(translator)}">${esc(translator)}</option>`).join("");','translator options');
  s=one(s,'    state.author=params.get("author")||"";','    state.author=params.get("author")||"";\n    state.translator=params.get("translator")||"";','translator URL read');
  s=one(s,'["q","author","tag","year","vols","reading","sort","pinned","view"]','["q","author","translator","tag","year","vols","reading","sort","pinned","view"]','translator URL keys');
  s=one(s,'    if(state.author)params.set("author",state.author);','    if(state.author)params.set("author",state.author);\n    if(state.translator)params.set("translator",state.translator);','translator URL write');
  s=one(s,'state.query.trim()||state.author||state.tags.size','state.query.trim()||state.author||state.translator||state.tags.size','translator active focus');
  s=one(s,'    if(state.author)pills.push(filterPill(`Author: ${state.author}`,"author",`author filter ${state.author}`));','    if(state.author)pills.push(filterPill(`Author: ${state.author}`,"author",`author filter ${state.author}`));\n    if(state.translator)pills.push(filterPill(`Translator: ${state.translator}`,"translator",`translator filter ${state.translator}`));','translator pill');
  s=one(s,'    else if(key==="author")state.author="";','    else if(key==="author")state.author="";\n    else if(key==="translator")state.translator="";','translator pill clear');
  s=one(s,'    if($("#authorSelect"))$("#authorSelect").value=state.author;','    if($("#authorSelect"))$("#authorSelect").value=state.author;\n    if($("#translatorSelect"))$("#translatorSelect").value=state.translator;','translator control sync');
  s=one(s,'state.query="";state.author="";state.tags=new Set();','state.query="";state.author="";state.translator="";state.tags=new Set();','translator clear all');
  s=afterLine(s,'$("#authorSelect")?.addEventListener("change"', '    $("#translatorSelect")?.addEventListener("change",event=>{state.translator=event.target.value;apply({historyMode:"push"})});','translator change binding');
  return s;
});

await patch("src/assets/js/admin/upload-fields.js",s=>{
  const marker='  if(description&&!$("#audioAlignedInput")){';
  if(!s.includes(marker))throw new Error("Missing upload field anchor");
  const insert='  if(description&&!$("#translationStatusInput")){\n    const fields=[\n      ["translationStatusInput","Translation status","select"],\n      ["translatorNameInput","Fan translator","text"],\n      ["translatorGroupInput","Translation group","text"],\n      ["translatorUrlInput","Translator / group URL","url"],\n      ["translatorCoverageInput","Translation coverage","text"]\n    ];\n    for(const [id,label,type] of fields){const field=document.createElement("label");field.className="admin-field"+(id==="translationStatusInput"?"":" wide");if(type==="select")field.innerHTML=`<span>${label}</span><select id="${id}"><option value="">Not set</option><option>Complete</option><option>Ongoing</option><option>Stalled</option><option>Partial</option></select>`;else{const placeholder=id==="translatorCoverageInput"?"Chapters 1–627 or Volumes 1–4":id==="translatorUrlInput"?"https://translator.example/":"Optional";field.innerHTML=`<span>${label}</span><input id="${id}" type="${type}" ${type==="url"?\'inputmode="url"\':""} placeholder="${placeholder}">`}description.before(field)}\n  }\n';
  return s.slice(0,s.indexOf(marker))+insert+s.slice(s.indexOf(marker));
});

await patch("src/assets/js/admin-batch.js",s=>{
  s=one(s,'"descriptionInput","adultInput","audioAlignedInput"]','"descriptionInput","adultInput","audioAlignedInput","translationStatusInput","translatorNameInput","translatorGroupInput","translatorUrlInput","translatorCoverageInput"]','batch translation field ids');
  s=one(s,'metaReady:false,adult:false,audioAlignedUrl:""','metaReady:false,adult:false,audioAlignedUrl:"",translationStatus:"",translations:[]','new batch translation state');
  s=one(s,'metaReady:Boolean(meta.title),adult:false,audioAlignedUrl:""','metaReady:Boolean(meta.title),adult:false,audioAlignedUrl:"",translationStatus:"",translations:[]','inspected batch translation state');
  s=one(s,'    item.audioAlignedUrl=$("#audioAlignedInput")?.value.trim()||"";','    item.audioAlignedUrl=$("#audioAlignedInput")?.value.trim()||"";\n    item.translationStatus=$("#translationStatusInput")?.value||"";\n    const translation={name:$("#translatorNameInput")?.value.trim()||"",group:$("#translatorGroupInput")?.value.trim()||"",url:$("#translatorUrlInput")?.value.trim()||"",coverage:$("#translatorCoverageInput")?.value.trim()||""};item.translations=translation.name||translation.group?[translation]:[];','save upload translation editor');
  s=one(s,'    if($("#audioAlignedInput"))$("#audioAlignedInput").value=item.audioAlignedUrl||"";','    if($("#audioAlignedInput"))$("#audioAlignedInput").value=item.audioAlignedUrl||"";\n    if($("#translationStatusInput"))$("#translationStatusInput").value=item.translationStatus||"";\n    const translation=item.translations?.[0]||{};if($("#translatorNameInput"))$("#translatorNameInput").value=translation.name||"";if($("#translatorGroupInput"))$("#translatorGroupInput").value=translation.group||"";if($("#translatorUrlInput"))$("#translatorUrlInput").value=translation.url||"";if($("#translatorCoverageInput"))$("#translatorCoverageInput").value=translation.coverage||"";','populate upload translation editor');
  s=one(s,'      audioAlignedUrl:item.audioAlignedUrl,date:item.date','      audioAlignedUrl:item.audioAlignedUrl,translationStatus:item.translationStatus,translations:item.translations,date:item.date','send upload translation metadata');
  return s;
});

await patch("functions/services/validation.js",s=>{
  s=one(s,'import { headObject, validObjectKey } from "./storage.js";','import { headObject, validObjectKey } from "./storage.js";\nimport { normalizeTranslationStatus, validateTranslationCredits } from "../_lib/translations.js";','translation validation import');
  s=one(s,'  const audioAlignedUrl = externalUrl(input.audioAlignedUrl), replaceTargetFile = clean(input.replaceTargetFile, 1000);','  const audioAlignedUrl = externalUrl(input.audioAlignedUrl), replaceTargetFile = clean(input.replaceTargetFile, 1000);\n  const rawTranslationStatus=clean(input.translationStatus,80),translationStatus=normalizeTranslationStatus(rawTranslationStatus),translationCredits=validateTranslationCredits(input.translations);','translation upload validation');
  s=one(s,'  if (audioAlignedUrl === null) return { ok: false, status: 400, error: "Audio-aligned EPUB folder URL must use http:// or https://" };','  if (audioAlignedUrl === null) return { ok: false, status: 400, error: "Audio-aligned EPUB folder URL must use http:// or https://" };\n  if (rawTranslationStatus && !translationStatus) return { ok: false, status: 400, error: "Unknown translation status" };\n  if (!translationCredits.ok) return { ok: false, status: 400, error: translationCredits.error };','translation upload validation errors');
  s=one(s,'    size: Math.max(0, Number(input.size) || 0), audioAlignedUrl, sha256: safeHash(input.sha256),','    size: Math.max(0, Number(input.size) || 0), audioAlignedUrl, translationStatus, translations: translationCredits.value, sha256: safeHash(input.sha256),','normalized upload translation values');
  return s;
});

await patch("functions/services/catalog.js",s=>{
  s=one(s,'        tags: withSeriesStatusTag(input.incomingTags, requestedStatus), cover, coverThumb, audioAlignedUrl: input.audioAlignedUrl, nsfw: input.adult, volumes: [] };','        tags: withSeriesStatusTag(input.incomingTags, requestedStatus), cover, coverThumb, audioAlignedUrl: input.audioAlignedUrl, ...(input.translationStatus ? { translationStatus: input.translationStatus } : {}), ...(input.translations.length ? { translations: input.translations } : {}), nsfw: input.adult, volumes: [] };','new series translation metadata');
  s=one(s,'      if (input.audioAlignedUrl) series.audioAlignedUrl = input.audioAlignedUrl;','      if (input.audioAlignedUrl) series.audioAlignedUrl = input.audioAlignedUrl;\n      if (input.translationStatus) series.translationStatus = input.translationStatus;\n      if (input.translations.length) series.translations = input.translations;','existing series translation seed');
  s=one(s,'      ...(input.sha256 ? { sha256: input.sha256 } : {}), ...(input.originalFilename ? { originalFilename: input.originalFilename } : {}) };','      ...(replacing && previous?.translations ? { translations: previous.translations } : {}),\n      ...(input.sha256 ? { sha256: input.sha256 } : {}), ...(input.originalFilename ? { originalFilename: input.originalFilename } : {}) };','preserve volume translation override');
  return s;
});

await append("src/assets/css/library-features.css","/* v2.1 translation attribution */",[
  "/* v2.1 translation attribution */",
  ".card-translator{margin-top:-2px!important;color:var(--gold)!important;font-size:.68rem!important;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".adult-library .card-translator{color:var(--adult-accent,#c98299)!important}",
  "@media(max-width:720px){.card-translator{max-width:100%;font-size:.64rem!important}}"
]);

await append("src/assets/css/series-extra.css","/* v2.1 fan-translation provenance */",[
  "/* v2.1 fan-translation provenance */",
  ".series-translator-summary{margin:.42rem 0 0;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.76rem}.series-translator-summary>span{color:var(--dim);font-size:.62rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.series-translator-summary a,.translation-name,.volume-translator-link{color:var(--gold);text-decoration:none}.series-translator-summary a:hover,.translation-name:hover,.volume-translator-link:hover{color:var(--text);text-decoration:underline;text-underline-offset:3px}",
  ".translation-panel{margin:0 0 30px;padding:18px 20px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.018)}.translation-panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.translation-panel-head span{display:block;color:var(--dim);font-size:.58rem;font-weight:800;letter-spacing:.16em}.translation-panel-head h2{margin:3px 0 0;font:500 1.12rem var(--serif)}.translation-status{padding:5px 9px;border:1px solid rgba(185,157,107,.28);border-radius:999px;color:var(--gold);font-size:.62rem;letter-spacing:.05em;text-transform:uppercase}.translation-credit-list{display:grid;gap:8px}.translation-credit{min-width:0;padding:10px 11px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:9px;background:rgba(255,255,255,.018)}.translation-credit>div{min-width:0;display:grid;gap:3px}.translation-credit strong{min-width:0}.translation-credit span,.translation-credit small{color:var(--dim);font-size:.68rem}.translation-source{flex:none;color:var(--muted);font-size:.68rem;text-decoration:none}.translation-source:hover{color:var(--text)}.volume-translator{margin:3px 0 0;color:var(--dim);font-size:.65rem}.volume-translator>span{font-weight:800;letter-spacing:.05em;text-transform:uppercase}.adult-library .series-translator-summary a,.adult-library .translation-name,.adult-library .volume-translator-link{color:var(--adult-accent-strong,#e0a8b8)}.adult-library .translation-panel{border-color:var(--adult-border,rgba(214,137,160,.18));background:rgba(126,54,77,.045)}.adult-library .translation-status{border-color:var(--adult-border-strong,rgba(225,151,173,.32));color:var(--adult-accent-strong,#e0a8b8)}",
  "@media(max-width:720px){.translation-panel{margin-bottom:20px;padding:15px}.translation-panel-head{align-items:flex-start}.translation-credit{align-items:flex-start;flex-direction:column}.translation-source{padding-top:2px}.series-translator-summary{flex-wrap:wrap}}"
]);

await append("src/assets/css/admin-components.css","/* v2.1 Keeper translation provenance */",[
  "/* v2.1 Keeper translation provenance */",
  ".keeper-translation-section{margin:18px 0 24px;padding:16px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.018)}.keeper-translation-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:7px}.keeper-translation-head>div>span{color:var(--dim);font-size:.56rem;font-weight:800;letter-spacing:.15em}.keeper-translation-head h3{margin:3px 0 0}.keeper-translation-head label{display:grid;gap:5px;color:var(--dim);font-size:.65rem}.keeper-translation-head select{min-width:150px}.keeper-translation-list{display:grid;gap:9px;margin-top:12px}.keeper-translation-row{position:relative;padding:11px 38px 11px 11px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border:1px solid var(--line);border-radius:9px;background:rgba(0,0,0,.12)}.keeper-translation-row label{min-width:0;display:grid;gap:4px}.keeper-translation-row label>span{color:var(--dim);font-size:.59rem}.keeper-translation-row .wide{grid-column:1/-1}.translation-remove{position:absolute;top:8px;right:8px;width:27px;height:27px;border:0;border-radius:7px;color:var(--dim);background:transparent;cursor:pointer}.translation-remove:hover{color:var(--text);background:rgba(255,255,255,.05)}.keeper-translation-actions{margin-top:10px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.volume-translation-editor{margin-top:12px;padding:12px;border:1px dashed var(--line);border-radius:9px}.volume-translation-head strong,.volume-translation-head small{display:block}.volume-translation-head small{margin-top:2px;color:var(--dim);font-size:.64rem}",
  "@media(max-width:720px){.keeper-translation-head{align-items:stretch;flex-direction:column}.keeper-translation-head select{width:100%}.keeper-translation-row{grid-template-columns:1fr}.keeper-translation-row .wide{grid-column:auto}.keeper-translation-actions>*{flex:1 1 auto}}"
]);

await patch("docs/architecture/README.md",s=>one(s,'## R4 + R4.1 Reader application','## v2.1 fan-translation provenance\n\n- [`TRANSLATION_METADATA.md`](./TRANSLATION_METADATA.md) — structured fan translator/group credits, translation status, series-to-volume inheritance, Library filtering, Series attribution, and Garden Keeper write ownership.\n\n## R4 + R4.1 Reader application','translation architecture index'));

console.log("Patched existing v2 owners for fan-translation provenance.");
