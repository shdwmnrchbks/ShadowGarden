import fs from "node:fs/promises";

const read=file=>fs.readFile(file,"utf8");
const write=(file,content)=>fs.writeFile(file,content);
function replaceOnce(source,from,to,label){
  const index=source.indexOf(from);
  if(index<0)throw new Error(`Missing marker for ${label}`);
  if(source.indexOf(from,index+from.length)>=0)throw new Error(`Ambiguous marker for ${label}`);
  return source.slice(0,index)+to+source.slice(index+from.length);
}
async function patch(file,mutator){
  const source=await read(file),next=mutator(source);
  if(next===source)throw new Error(`No change produced for ${file}`);
  await write(file,next);
}
async function append(file,marker,content){
  await patch(file,source=>source.includes(marker)?source:source.trimEnd()+"\n\n"+content.trim()+"\n");
}

await write("src/assets/js/domain/translations.js",`/* Shadow Garden v2.1 — fan-translation provenance normalization and inheritance. */
const STATUS_ALIASES=new Map([
  ["complete","Complete"],["completed","Complete"],["finished","Complete"],
  ["ongoing","Ongoing"],["active","Ongoing"],["current","Ongoing"],
  ["stalled","Stalled"],["paused","Stalled"],["inactive","Stalled"],
  ["partial","Partial"],["incomplete","Partial"]
]);
export const translationStatuses=Object.freeze(["Complete","Ongoing","Stalled","Partial"]);
const arr=value=>Array.isArray(value)?value:[];
const text=(value,max=500)=>String(value??"").trim().slice(0,max);

export function normalizeTranslationStatus(value){return STATUS_ALIASES.get(text(value,80).toLowerCase())||""}
export function normalizeTranslationCredit(value){
  if(typeof value==="string")value={name:value};
  if(!value||typeof value!=="object")return null;
  let name=text(value.name,160),group=text(value.group,160);if(!name&&group){name=group;group=""}if(!name)return null;
  let url="";const raw=text(value.url,2000);if(raw){try{const parsed=new URL(raw);if(["http:","https:"].includes(parsed.protocol))url=parsed.href}catch{}}
  const coverage=text(value.coverage,300),note=text(value.note,500);
  return {name,...(group?{group}:{}),...(url?{url}:{}),...(coverage?{coverage}:{}),...(note?{note}:{})};
}
export function normalizeTranslations(value){
  const seen=new Set(),out=[];
  for(const raw of arr(value)){
    const credit=normalizeTranslationCredit(raw);if(!credit)continue;
    const key=[credit.name,credit.group||"",credit.url||"",credit.coverage||"",credit.note||""].join("\\u0000").toLowerCase();
    if(seen.has(key))continue;seen.add(key);out.push(credit);if(out.length>=24)break;
  }
  return out;
}
export function creditDisplayName(credit){const item=normalizeTranslationCredit(credit);return item?item.group&&item.group.toLowerCase()!==item.name.toLowerCase()?\`${"${item.name}"} · ${"${item.group}"}\`:item.name:""}
export function effectiveVolumeTranslations(series,volume){const own=normalizeTranslations(volume?.translations);return own.length?own:normalizeTranslations(series?.translations)}
export function translatorNames(series){
  const out=[],seen=new Set();const add=value=>{const v=text(value,160);if(!v)return;const key=v.toLowerCase();if(seen.has(key))return;seen.add(key);out.push(v)};
  for(const credit of normalizeTranslations(series?.translations)){add(credit.name);add(credit.group)}
  for(const volume of arr(series?.volumes))for(const credit of normalizeTranslations(volume?.translations)){add(credit.name);add(credit.group)}
  return out;
}
export function translationSearchTerms(series){
  const values=[normalizeTranslationStatus(series?.translationStatus)];
  for(const credit of normalizeTranslations(series?.translations))values.push(credit.name,credit.group,credit.coverage,credit.note);
  for(const volume of arr(series?.volumes))for(const credit of normalizeTranslations(volume?.translations))values.push(credit.name,credit.group,credit.coverage,credit.note);
  return values.filter(Boolean);
}
export function primaryTranslator(series){return normalizeTranslations(series?.translations)[0]||arr(series?.volumes).flatMap(volume=>normalizeTranslations(volume?.translations))[0]||null}
`);

await patch("src/assets/js/domain/index.js",source=>replaceOnce(source,'export * as catalog from "./catalog.js";','export * as catalog from "./catalog.js";\nexport * as translations from "./translations.js";','domain translation export'));

await patch("src/assets/js/domain/catalog.js",source=>{
  source=replaceOnce(source,'import { migrateLegacyProgress } from "./progress.js";','import { migrateLegacyProgress } from "./progress.js";\nimport { normalizeTranslationStatus, normalizeTranslations } from "./translations.js";','catalog translation import');
  source=replaceOnce(source,`    const volumes = (Array.isArray(item?.volumes) ? item.volumes : []).map(volume => {
      const bookId = String(volume?.bookId || "");
      if (!isBookId(bookId)) return volume;
      bookIds.push(bookId);
      return { ...volume, file: bookId };
    });
    return { ...item, status, tags, volumes };`,`    const volumes = (Array.isArray(item?.volumes) ? item.volumes : []).map(volume => {
      const next = { ...(volume || {}) }, credits = normalizeTranslations(volume?.translations);
      if (credits.length) next.translations = credits; else delete next.translations;
      const bookId = String(volume?.bookId || "");
      if (!isBookId(bookId)) return next;
      bookIds.push(bookId);
      return { ...next, file: bookId };
    });
    const next = { ...item, status, tags, volumes }, translationStatus = normalizeTranslationStatus(item?.translationStatus), credits = normalizeTranslations(item?.translations);
    if (translationStatus) next.translationStatus = translationStatus; else delete next.translationStatus;
    if (credits.length) next.translations = credits; else delete next.translations;
    return next;`,'catalog translation normalization');
  return source;
});

await patch("src/assets/js/library-model.js",source=>{
  source=replaceOnce(source,'/* Shadow Garden R3 — Library catalog query/filter/sort model. */\n\n','/* Shadow Garden R3 — Library catalog query/filter/sort model. */\n\nimport { translationSearchTerms, translatorNames } from "./domain/translations.js";\n\n','library model translation import');
  source=replaceOnce(source,'    series?.description,\n    ...arr(series?.tags),','    series?.description,\n    ...translationSearchTerms(series),\n    ...arr(series?.tags),','translation search haystack');
  source=replaceOnce(source,'  const authors = new Set(items.map(series => String(series?.author || "").trim()).filter(Boolean));\n  const years = new Set','  const authors = new Set(items.map(series => String(series?.author || "").trim()).filter(Boolean));\n  const translators = new Set(items.flatMap(translatorNames));\n  const years = new Set','translation validation options');
  source=replaceOnce(source,'  if (state.author && !authors.has(state.author)) state.author = "";\n  if (state.year','  if (state.author && !authors.has(state.author)) state.author = "";\n  if (state.translator && !translators.has(state.translator)) state.translator = "";\n  if (state.year','translation state validation');
  source=replaceOnce(source,'    if (state.author && String(series?.author || "").trim() !== state.author) return false;\n    const seriesTags','    if (state.author && String(series?.author || "").trim() !== state.author) return false;\n    if (state.translator && !translatorNames(series).includes(state.translator)) return false;\n    const seriesTags','translator filter');
  source=replaceOnce(source,'  const authors = [...new Set(items.map(series => String(series?.author || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));\n  const years','  const authors = [...new Set(items.map(series => String(series?.author || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));\n  const translators = [...new Set(items.flatMap(translatorNames))].sort((a, b) => a.localeCompare(b));\n  const years','translator filter options');
  source=replaceOnce(source,'  return { authors, years, tags, popularTags, tagCounts };','  return { authors, translators, years, tags, popularTags, tagCounts };','translator options return');
  return source;
});

await patch("src/assets/js/library.js",source=>{
  source=replaceOnce(source,'query:"",author:"",tags:new Set()','query:"",author:"",translator:"",tags:new Set()','library translator state');
  source=replaceOnce(source,'  function collectFilters(){','  function mountTranslatorFilter(){\n    if($("#translatorSelect"))return;\n    const anchor=$("#authorSelect")?.closest(".filter-group");if(!anchor)return;\n    const group=document.createElement("div");group.className="filter-group";group.innerHTML=\'<label for="translatorSelect">Fan translator / group</label><select id="translatorSelect"><option value="">Any translator</option></select>\';anchor.after(group);\n  }\n\n  function collectFilters(){','translator filter mount');
  source=replaceOnce(source,'    const options=model.filterOptions(state.items);\n    $("#authorSelect")','    const options=model.filterOptions(state.items);\n    mountTranslatorFilter();\n    $("#authorSelect")','mount translator before options');
  source=replaceOnce(source,'    $("#authorSelect").innerHTML=\'<option value="">Any author</option>\'+options.authors.map(author=>`<option value="${esc(author)}">${esc(author)}</option>`).join("");','    $("#authorSelect").innerHTML=\'<option value="">Any author</option>\'+options.authors.map(author=>`<option value="${esc(author)}">${esc(author)}</option>`).join("");\n    $("#translatorSelect").innerHTML=\'<option value="">Any translator</option>\'+options.translators.map(translator=>`<option value="${esc(translator)}">${esc(translator)}</option>`).join("");','translator select options');
  source=replaceOnce(source,'    state.author=params.get("author")||"";\n    state.tags','    state.author=params.get("author")||"";\n    state.translator=params.get("translator")||"";\n    state.tags','translator URL read');
  source=replaceOnce(source,'["q","author","tag","year","vols","reading","sort","pinned","view"]','["q","author","translator","tag","year","vols","reading","sort","pinned","view"]','translator URL keys');
  source=replaceOnce(source,'    if(state.author)params.set("author",state.author);\n    [...state.tags]','    if(state.author)params.set("author",state.author);\n    if(state.translator)params.set("translator",state.translator);\n    [...state.tags]','translator URL write');
  source=replaceOnce(source,'state.query.trim()||state.author||state.tags.size','state.query.trim()||state.author||state.translator||state.tags.size','translator active result focus');
  source=replaceOnce(source,'    if(state.author)pills.push(filterPill(`Author: ${state.author}`,"author",`author filter ${state.author}`));\n    if(state.year)','    if(state.author)pills.push(filterPill(`Author: ${state.author}`,"author",`author filter ${state.author}`));\n    if(state.translator)pills.push(filterPill(`Translator: ${state.translator}`,"translator",`translator filter ${state.translator}`));\n    if(state.year)','translator active pill');
  source=replaceOnce(source,'    else if(key==="author")state.author="";\n    else if(key==="year")','    else if(key==="author")state.author="";\n    else if(key==="translator")state.translator="";\n    else if(key==="year")','translator pill clear');
  source=replaceOnce(source,'    if($("#authorSelect"))$("#authorSelect").value=state.author;\n    if($("#yearSelect"))','    if($("#authorSelect"))$("#authorSelect").value=state.author;\n    if($("#translatorSelect"))$("#translatorSelect").value=state.translator;\n    if($("#yearSelect"))','translator control sync');
  source=replaceOnce(source,'state.query="";state.author="";state.tags=new Set();','state.query="";state.author="";state.translator="";state.tags=new Set();','translator clear filters');
  source=replaceOnce(source,'    $("#authorSelect")?.addEventListener("change",event=>{state.author=event.target.value;apply({historyMode:"push"})});\n    $("#yearSelect")','    $("#authorSelect")?.addEventListener("change",event=>{state.author=event.target.value;apply({historyMode:"push"})});\n    $("#translatorSelect")?.addEventListener("change",event=>{state.translator=event.target.value;apply({historyMode:"push"})});\n    $("#yearSelect")','translator control binding');
  return source;
});

await patch("src/assets/js/library-renderers.js",source=>{
  source=replaceOnce(source,'export function seriesCard(series, index, { readingState, preferences, urls, format }) {','export function seriesCard(series, index, { readingState, preferences, urls, format, translations }) {','library renderer translations dependency');
  source=replaceOnce(source,'  const href = urls.seriesUrl(series?.id);\n  return','  const href = urls.seriesUrl(series?.id);\n  const translator=translations?.primaryTranslator(series),translationStatus=translations?.normalizeTranslationStatus(series?.translationStatus)||"";\n  const translatorLabel=translator?translations.creditDisplayName(translator):"";\n  return','library card translator data');
  source=replaceOnce(source,'      <p>${esc(series?.author || "Unknown author")}</p>\n      <div class="card-meta">','      <p>${esc(series?.author || "Unknown author")}</p>\n      ${translatorLabel?`<p class="card-translator">TL · ${esc(translatorLabel)}${translationStatus?` · ${esc(translationStatus)}`:""}</p>`:""}\n      <div class="card-meta">','library card translator line');
  return source;
});

await patch("src/assets/js/series-renderers.js",source=>{
  const helpers=`function translatorFilterHref(series,value,urls){\n  const adult=Boolean(series?.nsfw)||String(series?.id||"").startsWith("adult-");\n  const base=urls.libraryUrl(adult);return \`${"${base}"}?translator=${"${encodeURIComponent(value)}"}\`;\n}\n\nfunction translatorLink(series,credit,urls,format,translations,className="translation-name"){\n  const esc=format.escapeHtml,label=translations.creditDisplayName(credit),filterValue=credit?.name||credit?.group||label;\n  return label?\`<a class="${"${className}"}" href="${"${translatorFilterHref(series,filterValue,urls)}"}" title="Show ${"${esc(filterValue)}"} in the ${"${series?.nsfw?\"Adult Library\":\"Library\"}"}">${"${esc(label)}"}</a>\`:"";\n}\n\nfunction translationPanel(series,dependencies){\n  const {urls,format,translations}=dependencies,esc=format.escapeHtml,credits=translations.normalizeTranslations(series?.translations),status=translations.normalizeTranslationStatus(series?.translationStatus);\n  if(!credits.length&&!status)return"";\n  return \`<section class="translation-panel" aria-label="Fan translation credits"><div class="translation-panel-head"><div><span>FAN TRANSLATION</span><h2>Translation Credits</h2></div>${"${status?`<strong class=\"translation-status\">${esc(status)}</strong>`:\"\"}"}</div><div class="translation-credit-list">${"${credits.map(credit=>`<article class=\"translation-credit\"><div><strong>${translatorLink(series,credit,urls,format,translations)}</strong>${credit.coverage?`<span>${esc(credit.coverage)}</span>`:\"\"}</div>${credit.url?`<a class=\"translation-source\" href=\"${esc(credit.url)}\" target=\"_blank\" rel=\"noopener noreferrer\">Translator site ↗</a>`:\"\"}</article>`).join(\"\")}"}</div></section>\`;\n}\n\n`;
  source=replaceOnce(source,'function volumeCard(series, entry, dependencies) {',helpers+'function volumeCard(series, entry, dependencies) {','series translation helpers');
  source=replaceOnce(source,'  const { readingState, format } = dependencies;','  const { readingState, format, urls, translations } = dependencies;','volume translator dependencies');
  source=replaceOnce(source,'  const title = volume?.title || `Volume ${index + 1}`;\n  return','  const title = volume?.title || `Volume ${index + 1}`;\n  const overrides=translations.normalizeTranslations(volume?.translations);\n  const overrideMarkup=overrides.length?`<p class="volume-translator">TL override · ${overrides.map(credit=>translatorLink(series,credit,urls,format,translations,"volume-translator-link")).join(" · ")}</p>`:"";\n  return','volume translation override data');
  source=replaceOnce(source,'    <p class="volume-meta">${[volume?.date || "", format.formatBytes(volume?.size), stateMeta].filter(Boolean).join(" · ")}</p>\n    <div class="volume-actions">','    <p class="volume-meta">${[volume?.date || "", format.formatBytes(volume?.size), stateMeta].filter(Boolean).join(" · ")}</p>\n    ${overrideMarkup}\n    <div class="volume-actions">','volume translation override render');
  source=replaceOnce(source,'  const { readingState, preferences, urls, format, identity } = dependencies;','  const { readingState, preferences, urls, format, identity, translations } = dependencies;','series translations dependency');
  source=replaceOnce(source,'  const backdrop = volumeArtwork(series, bannerVolume(series, identity)) || series?.coverThumb || first?.coverThumb || cover;\n\n  return','  const backdrop = volumeArtwork(series, bannerVolume(series, identity)) || series?.coverThumb || first?.coverThumb || cover;\n  const primaryTranslator=translations.primaryTranslator(series);\n  const translatorSummary=primaryTranslator?`<p class="series-translator-summary"><span>Fan translation</span>${translatorLink(series,primaryTranslator,urls,format,translations)}</p>`:"";\n\n  return','series primary translator');
  source=replaceOnce(source,'          <p class="series-byline">${esc(series?.author || "Unknown author")} ${series?.year ? `<span class="series-year">· ${series.year}</span>` : ""}${finishedCount ? ` <span class="series-year">· ${finishedCount}/${volumes.length} finished</span>` : ""}</p>\n          <div class="series-actions">','          <p class="series-byline">${esc(series?.author || "Unknown author")} ${series?.year ? `<span class="series-year">· ${series.year}</span>` : ""}${finishedCount ? ` <span class="series-year">· ${finishedCount}/${volumes.length} finished</span>` : ""}</p>\n          ${translatorSummary}\n          <div class="series-actions">','series translator summary');
  source=replaceOnce(source,'    <section class="series-body">\n      ${series?.description ?','    <section class="series-body">\n      ${translationPanel(series,dependencies)}\n      ${series?.description ?','series translation panel');
  return source;
});

await append("src/assets/css/library-features.css","/* v2.1 translation attribution */",`/* v2.1 translation attribution */
.card-translator{margin-top:-2px!important;color:var(--gold)!important;font-size:.68rem!important;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adult-library .card-translator{color:var(--adult-accent,#c98299)!important}
@media(max-width:720px){.card-translator{max-width:100%;font-size:.64rem!important}}`);

await append("src/assets/css/series-extra.css","/* v2.1 fan-translation provenance */",`/* v2.1 fan-translation provenance */
.series-translator-summary{margin:.42rem 0 0;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.76rem}.series-translator-summary>span{color:var(--dim);font-size:.62rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.series-translator-summary a,.translation-name,.volume-translator-link{color:var(--gold);text-decoration:none}.series-translator-summary a:hover,.translation-name:hover,.volume-translator-link:hover{color:var(--text);text-decoration:underline;text-underline-offset:3px}
.translation-panel{margin:0 0 30px;padding:18px 20px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.018)}.translation-panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.translation-panel-head span{display:block;color:var(--dim);font-size:.58rem;font-weight:800;letter-spacing:.16em}.translation-panel-head h2{margin:3px 0 0;font:500 1.12rem var(--serif)}.translation-status{padding:5px 9px;border:1px solid rgba(185,157,107,.28);border-radius:999px;color:var(--gold);font-size:.62rem;letter-spacing:.05em;text-transform:uppercase}.translation-credit-list{display:grid;gap:8px}.translation-credit{min-width:0;padding:10px 11px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:9px;background:rgba(255,255,255,.018)}.translation-credit>div{min-width:0;display:grid;gap:3px}.translation-credit strong{min-width:0}.translation-credit span{color:var(--dim);font-size:.68rem}.translation-source{flex:none;color:var(--muted);font-size:.68rem;text-decoration:none}.translation-source:hover{color:var(--text)}.volume-translator{margin:3px 0 0;color:var(--dim);font-size:.65rem}.adult-library .series-translator-summary a,.adult-library .translation-name,.adult-library .volume-translator-link{color:var(--adult-accent-strong,#e0a8b8)}.adult-library .translation-panel{border-color:var(--adult-border,rgba(214,137,160,.18));background:rgba(126,54,77,.045)}.adult-library .translation-status{border-color:var(--adult-border-strong,rgba(225,151,173,.32));color:var(--adult-accent-strong,#e0a8b8)}
@media(max-width:720px){.translation-panel{margin-bottom:20px;padding:15px}.translation-panel-head{align-items:flex-start}.translation-credit{align-items:flex-start;flex-direction:column}.translation-source{padding-top:2px}.series-translator-summary{flex-wrap:wrap}}`);

await write("functions/_lib/translations.js",`const STATUS_ALIASES=new Map([
  ["complete","Complete"],["completed","Complete"],["finished","Complete"],
  ["ongoing","Ongoing"],["active","Ongoing"],["current","Ongoing"],
  ["stalled","Stalled"],["paused","Stalled"],["inactive","Stalled"],
  ["partial","Partial"],["incomplete","Partial"]
]);
export const TRANSLATION_STATUSES=Object.freeze(["Complete","Ongoing","Stalled","Partial"]);
const clean=(value,max=500)=>String(value??"").trim().slice(0,max);
export function normalizeTranslationStatus(value){return STATUS_ALIASES.get(clean(value,80).toLowerCase())||""}
function external(value){const raw=clean(value,2000);if(!raw)return{ok:true,value:""};try{const url=new URL(raw);return["http:","https:"].includes(url.protocol)?{ok:true,value:url.href}:{ok:false}}catch{return{ok:false}}}
export function validateTranslationCredits(value){
  if(value!=null&&!Array.isArray(value))return{ok:false,error:"Translation credits must be an array"};
  const credits=[],seen=new Set();
  for(const raw of Array.isArray(value)?value:[]){
    if(!raw||typeof raw!=="object")continue;let name=clean(raw.name,160),group=clean(raw.group,160);if(!name&&group){name=group;group=""}if(!name)continue;
    const url=external(raw.url);if(!url.ok)return{ok:false,error:`Translator URL for ${name} must use http:// or https://`};
    const coverage=clean(raw.coverage,300),note=clean(raw.note,500),credit={name,...(group?{group}:{}),...(url.value?{url:url.value}:{}),...(coverage?{coverage}:{}),...(note?{note}:{})};
    const key=[credit.name,credit.group||"",credit.url||"",credit.coverage||"",credit.note||""].join("\\u0000").toLowerCase();if(seen.has(key))continue;seen.add(key);credits.push(credit);if(credits.length>=24)break;
  }
  return{ok:true,value:credits};
}
`);

await write("functions/services/translations.js",`/* Shadow Garden v2.1 — authenticated fan-translation metadata mutations. */
import { requireAdmin } from "./auth.js";
import { json, parseJson } from "./http.js";
import { clean } from "./validation.js";
import { invalidateCatalogCache, loadCatalogPair, locateSeries, saveCatalog, snapshotCatalogs } from "./catalog.js";
import { normalizeTranslationStatus, validateTranslationCredits } from "../_lib/translations.js";
import { writeClient } from "./storage.js";

export async function handleTranslationsPost({request,env}){
  if(!(await requireAdmin(request,env)))return json({ok:false,error:"Unauthorized"},401);
  const body=await parseJson(request);if(!body.ok)return json({ok:false,error:"Invalid JSON body"},400);
  const input=body.value||{},id=clean(input.id,180),target=clean(input.target,20);if(!id||!["series","volume"].includes(target))return json({ok:false,error:"Series id and translation target are required"},400);
  const parsed=validateTranslationCredits(input.translations);if(!parsed.ok)return json({ok:false,error:parsed.error},400);
  try{
    const aws=writeClient(env),data=await loadCatalogPair(aws),found=locateSeries(data,id);if(!found)return json({ok:false,error:"Series not found"},404);
    await snapshotCatalogs(aws,data.main,data.adult,target==="series"?"update-translation-credits":"update-volume-translation-override");
    if(target==="series"){
      const status=normalizeTranslationStatus(input.translationStatus);if(status)found.series.translationStatus=status;else delete found.series.translationStatus;
      if(parsed.value.length)found.series.translations=parsed.value;else delete found.series.translations;
    }else{
      const index=Number(input.volumeIndex),volumes=Array.isArray(found.series?.volumes)?found.series.volumes:[];if(!Number.isInteger(index)||index<0||index>=volumes.length)return json({ok:false,error:"Volume not found"},404);
      if(parsed.value.length)volumes[index].translations=parsed.value;else delete volumes[index].translations;
    }
    await saveCatalog(aws,found.key,found.catalog);await invalidateCatalogCache(request);
    return json({ok:true,id:found.series.id,target,translationStatus:found.series.translationStatus||"",translations:target==="series"?(found.series.translations||[]):(found.series.volumes[Number(input.volumeIndex)]?.translations||[])});
  }catch(error){console.error("Translation metadata update failed",error);return json({ok:false,error:"Could not update translation metadata",detail:String(error?.message||error)},502)}
}
`);
await write("functions/admin-api/translations.js",`/* Shadow Garden v2.1 route adapter — translation provenance lives in services/translations.js. */
import { handleTranslationsPost } from "../services/translations.js";
export async function onRequestPost(context){return handleTranslationsPost(context)}
`);

await write("src/assets/js/admin/translation-workflow.js",`/* Shadow Garden v2.1 — Garden Keeper fan-translation metadata workflow. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;const {$,arr,esc}=keeper.util,{state}=keeper,client=keeper.client;
  keeper.registerWorkflow("translations",()=>{
    const dialog=$("#seriesEditor"),volumeRoot=$("#manageVolumes");if(!dialog||!volumeRoot)return{};
    const statuses=["","Complete","Ongoing","Stalled","Partial"];
    function managed(){if(!state.management)return[];return[...arr(state.management.main),...arr(state.management.adult)]}
    const current=()=>managed().find(series=>series.id===state.activeSeriesId)||null;
    function creditRow(credit={}){return `<div class="keeper-translation-row" data-translation-row><label><span>Translator</span><input data-t-name type="text" value="${esc(credit.name||"")}" placeholder="Translator name"></label><label><span>Group</span><input data-t-group type="text" value="${esc(credit.group||"")}" placeholder="Optional group"></label><label class="wide"><span>Source URL</span><input data-t-url type="url" inputmode="url" value="${esc(credit.url||"")}" placeholder="https://translator.example/"></label><label class="wide"><span>Coverage</span><input data-t-coverage type="text" value="${esc(credit.coverage||"")}" placeholder="e.g. Chapters 1–627 or Volumes 1–4"></label><button class="translation-remove" data-translation-remove type="button" aria-label="Remove translation credit">×</button></div>`}
    function serialize(root){return[...root.querySelectorAll("[data-translation-row]")].map(row=>({name:row.querySelector("[data-t-name]")?.value.trim()||"",group:row.querySelector("[data-t-group]")?.value.trim()||"",url:row.querySelector("[data-t-url]")?.value.trim()||"",coverage:row.querySelector("[data-t-coverage]")?.value.trim()||""})).filter(item=>item.name||item.group)}
    function install(){
      if($("#manageTranslationSection"))return;const volumeHead=$("#manageVolumeLabel")?.closest(".dialog-section-head");if(!volumeHead)return;
      const section=document.createElement("section");section.id="manageTranslationSection";section.className="keeper-translation-section";section.innerHTML=`<div class="keeper-translation-head"><div><span>FAN TRANSLATION</span><h3>Translation provenance</h3></div><label><span>Translation status</span><select id="manageTranslationStatus">${statuses.map(value=>`<option value="${value}">${value||"Not set"}</option>`).join("")}</select></label></div><p class="field-note">Credit the fan translator or group and record chapter/volume coverage. Multiple rows support hand-offs between translators.</p><div id="manageTranslations" class="keeper-translation-list"></div><div class="keeper-translation-actions"><button id="addTranslationCredit" class="admin-secondary" type="button">＋ Add translator</button><button id="saveTranslationCredits" class="admin-primary inline-button" type="button">Save translation credits</button></div>`;volumeHead.before(section);
    }
    install();
    function renderSeries(){const series=current();if(!series)return;$("#manageTranslationStatus").value=series.translationStatus||"";const list=$("#manageTranslations");list.innerHTML=arr(series.translations).map(creditRow).join("");if(!list.children.length)list.innerHTML=creditRow()}
    function volumeEditor(series,card,index){const editor=card.querySelector(".manage-volume-editor");if(!editor||editor.querySelector("[data-volume-translation-editor]"))return;const own=arr(series.volumes?.[index]?.translations);const block=document.createElement("section");block.className="volume-translation-editor";block.dataset.volumeTranslationEditor="1";block.innerHTML=`<div class="volume-translation-head"><div><strong>Translation override</strong><small>Leave empty to inherit the series credits.</small></div></div><div class="keeper-translation-list" data-volume-translations>${own.map(creditRow).join("")}</div><div class="keeper-translation-actions"><button class="admin-secondary" data-add-volume-translation type="button">＋ Add override</button><button class="admin-secondary" data-save-volume-translation type="button">Save translation override</button></div>`;editor.querySelector(".volume-actions")?.before(block)}
    function renderVolumes(){const series=current();if(!series)return;[...volumeRoot.querySelectorAll(".manage-volume")].forEach(card=>volumeEditor(series,card,Number(card.dataset.volumeIndex)))}
    function sync(){if(!dialog.open)return;renderSeries();renderVolumes()}
    new MutationObserver(()=>queueMicrotask(sync)).observe(dialog,{attributes:true,attributeFilter:["open"]});
    new MutationObserver(()=>{if(dialog.open)queueMicrotask(renderVolumes)}).observe(volumeRoot,{childList:true});
    $("#addTranslationCredit")?.addEventListener("click",()=>$("#manageTranslations").insertAdjacentHTML("beforeend",creditRow()));
    dialog.addEventListener("click",event=>{const remove=event.target.closest("[data-translation-remove]");if(remove){remove.closest("[data-translation-row]")?.remove();return}const add=event.target.closest("[data-add-volume-translation]");if(add){add.closest("[data-volume-translation-editor]").querySelector("[data-volume-translations]").insertAdjacentHTML("beforeend",creditRow());return}});
    async function saveSeries(){const series=current();if(!series)return;const button=$("#saveTranslationCredits"),old=button.textContent;button.disabled=true;button.textContent="Saving…";try{await client.request("/admin-api/translations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:series.id,target:"series",translationStatus:$("#manageTranslationStatus").value,translations:serialize($("#manageTranslations"))})});keeper.ui.toast("Translation credits saved.");keeper.events.dispatchEvent(new Event("library:invalidate"))}catch(error){alert(error.message)}finally{button.disabled=false;button.textContent=old}}
    $("#saveTranslationCredits")?.addEventListener("click",saveSeries);
    volumeRoot.addEventListener("click",async event=>{const button=event.target.closest("[data-save-volume-translation]");if(!button)return;const card=button.closest(".manage-volume"),series=current();if(!card||!series)return;const index=Number(card.dataset.volumeIndex),old=button.textContent;button.disabled=true;button.textContent="Saving…";try{await client.request("/admin-api/translations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:series.id,target:"volume",volumeIndex:index,translations:serialize(card.querySelector("[data-volume-translations]"))})});keeper.ui.toast(`Volume ${series.volumes?.[index]?.number??index+1} translation override saved.`);keeper.events.dispatchEvent(new Event("library:invalidate"))}catch(error){alert(error.message)}finally{button.disabled=false;button.textContent=old}});
    keeper.events.addEventListener("library:changed",()=>{if(dialog.open)queueMicrotask(sync)});
    return{sync};
  });
})();
`);

await patch("src/assets/js/admin/app.js",source=>{
  source=replaceOnce(source,'      "/assets/js/admin/library-workflow.js",','      "/assets/js/admin/library-workflow.js",\n      "/assets/js/admin/translation-workflow.js",','keeper translation workflow load');
  source=replaceOnce(source,'["version","session","library","maintenance"','["version","session","library","translations","maintenance"','keeper translation workflow init');
  return source;
});

await append("src/assets/css/admin-components.css","/* v2.1 Keeper translation provenance */",`/* v2.1 Keeper translation provenance */
.keeper-translation-section{margin:18px 0 24px;padding:16px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.018)}.keeper-translation-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:7px}.keeper-translation-head>div>span{color:var(--dim);font-size:.56rem;font-weight:800;letter-spacing:.15em}.keeper-translation-head h3{margin:3px 0 0}.keeper-translation-head label{display:grid;gap:5px;color:var(--dim);font-size:.65rem}.keeper-translation-head select{min-width:150px}.keeper-translation-list{display:grid;gap:9px;margin-top:12px}.keeper-translation-row{position:relative;padding:11px 38px 11px 11px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border:1px solid var(--line);border-radius:9px;background:rgba(0,0,0,.12)}.keeper-translation-row label{min-width:0;display:grid;gap:4px}.keeper-translation-row label>span{color:var(--dim);font-size:.59rem}.keeper-translation-row .wide{grid-column:1/-1}.translation-remove{position:absolute;top:8px;right:8px;width:27px;height:27px;border:0;border-radius:7px;color:var(--dim);background:transparent;cursor:pointer}.translation-remove:hover{color:var(--text);background:rgba(255,255,255,.05)}.keeper-translation-actions{margin-top:10px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.volume-translation-editor{margin-top:12px;padding:12px;border:1px dashed var(--line);border-radius:9px}.volume-translation-head strong,.volume-translation-head small{display:block}.volume-translation-head small{margin-top:2px;color:var(--dim);font-size:.64rem}
@media(max-width:720px){.keeper-translation-head{align-items:stretch;flex-direction:column}.keeper-translation-head select{width:100%}.keeper-translation-row{grid-template-columns:1fr}.keeper-translation-row .wide{grid-column:auto}.keeper-translation-actions>*{flex:1 1 auto}}`);

await write("tests/unit/translations.test.mjs",`import test from "node:test";import assert from "node:assert/strict";
import { effectiveVolumeTranslations, normalizeTranslationStatus, normalizeTranslations, primaryTranslator, translatorNames } from "../../src/assets/js/domain/translations.js";
test("translation provenance normalizes status, credits, inheritance and filter names",()=>{const series={translationStatus:"completed",translations:[{name:"js06",group:"EroLNs",url:"https://erolns.blogspot.com",coverage:"Volumes 1–3"}],volumes:[{}, {translations:[{name:"Second TL",coverage:"Volume 2"}]}]};assert.equal(normalizeTranslationStatus(series.translationStatus),"Complete");assert.equal(normalizeTranslations(series.translations)[0].url,"https://erolns.blogspot.com/");assert.equal(effectiveVolumeTranslations(series,series.volumes[0])[0].name,"js06");assert.equal(effectiveVolumeTranslations(series,series.volumes[1])[0].name,"Second TL");assert.deepEqual(translatorNames(series),["js06","EroLNs","Second TL"]);assert.equal(primaryTranslator(series).name,"js06")});
`);
await write("tests/service/translation-metadata.test.mjs",`import test from "node:test";import assert from "node:assert/strict";
import { normalizeTranslationStatus, validateTranslationCredits } from "../../functions/_lib/translations.js";import { publicCatalogShape } from "../../functions/_lib/book-id.js";
test("server translation validation accepts structured provenance and rejects unsafe URLs",()=>{assert.equal(normalizeTranslationStatus("paused"),"Stalled");const good=validateTranslationCredits([{name:"Fan TL",group:"Group",url:"https://example.com/work",coverage:"Chapters 1–120"}]);assert.equal(good.ok,true);assert.equal(good.value[0].url,"https://example.com/work");assert.equal(validateTranslationCredits([{name:"Bad",url:"javascript:alert(1)"}]).ok,false)});
test("public catalog keeps translation attribution while EPUB-private fields remain redacted",async()=>{const shaped=await publicCatalogShape({series:[{id:"demo",translations:[{name:"Fan TL",coverage:"Volumes 1–2"}],translationStatus:"Ongoing",volumes:[{title:"Volume 1",file:"/media/shadow-garden/books/demo.epub",sha256:"secret",originalFilename:"secret.epub",translations:[{name:"Volume TL"}]}]}]});const series=shaped.series[0],volume=series.volumes[0];assert.equal(series.translations[0].name,"Fan TL");assert.equal(series.translationStatus,"Ongoing");assert.equal(volume.translations[0].name,"Volume TL");assert.equal("file" in volume,false);assert.equal("sha256" in volume,false);assert.equal("originalFilename" in volume,false);assert.match(volume.bookId,/^bk_/) });
`);
await write("tests/browser/translation-attribution.test.mjs",`import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs/promises";const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");
test("Library and Series expose fan translators as first-class filterable provenance",async()=>{const [library,model,cards,series,css]=await Promise.all([read("src/assets/js/library.js"),read("src/assets/js/library-model.js"),read("src/assets/js/library-renderers.js"),read("src/assets/js/series-renderers.js"),read("src/assets/css/series-extra.css")]);assert.match(library,/translator:\"\"/);assert.match(library,/id=\"translatorSelect\"/);assert.match(library,/params\.get\(\"translator\"\)/);assert.match(library,/Translator: \$\{state\.translator\}/);assert.match(model,/translatorNames\(series\)/);assert.match(cards,/card-translator/);assert.match(series,/Translation Credits/);assert.match(series,/translator=\$\{encodeURIComponent/);assert.match(series,/translation-source/);assert.match(series,/volume-translator/);assert.match(css,/translation-panel/)});
test("Garden Keeper owns editable series credits, translation status and per-volume overrides",async()=>{const [app,workflow,route,service]=await Promise.all([read("src/assets/js/admin/app.js"),read("src/assets/js/admin/translation-workflow.js"),read("functions/admin-api/translations.js"),read("functions/services/translations.js")]);assert.match(app,/admin\/translation-workflow\.js/);assert.match(app,/\"translations\"/);assert.match(workflow,/Translation provenance/);assert.match(workflow,/Translation override/);assert.match(workflow,/translationStatus/);assert.match(workflow,/\/admin-api\/translations/);assert.match(route,/handleTranslationsPost/);assert.match(service,/snapshotCatalogs/);assert.match(service,/update-volume-translation-override/)});
`);

await write("docs/architecture/TRANSLATION_METADATA.md",`# Fan Translation Metadata

Shadow Garden v2.1 treats fan-translation provenance as first-class public catalog metadata.

## Catalog shape

A series may define a translation status and one or more credits:

\`\`\`json
{
  "translationStatus": "Ongoing",
  "translations": [
    {"name":"Miraclerifle","url":"https://example.com/","coverage":"Chapters 1–627"},
    {"name":"EAP","coverage":"Chapters 628–776"}
  ]
}
\`\`\`

Supported translation statuses are \`Complete\`, \`Ongoing\`, \`Stalled\`, and \`Partial\`. Credit fields are \`name\`, optional \`group\`, optional HTTP(S) \`url\`, optional free-form \`coverage\`, and optional short \`note\`.

A volume may define its own \`translations\` array. A non-empty volume array overrides the series credits for that volume; an absent/empty volume array inherits the series credits. This allows translator hand-offs by chapter/volume range without repeating the default credit on every book.

## Public UI ownership

- \`domain/translations.js\` owns browser normalization, inheritance, translator names, search terms and primary credit selection.
- Library search indexes translator/group/coverage text. \`translator=...\` is a canonical Library query parameter and the Translator/Group control participates in active-filter pills and mobile result focus.
- Catalog cards show a compact \`TL · ...\` attribution.
- Series pages show a dedicated Translation Credits panel, translation status, filter links and safe external source links. Per-volume overrides are called out on the affected volume card.

## Garden Keeper ownership

\`admin/translation-workflow.js\` augments the existing Series Editor without replacing the Library workflow. It owns series translation status/credits and per-volume overrides. Writes go through \`/admin-api/translations\` to \`functions/services/translations.js\`, which validates URLs/lengths, snapshots catalogs before mutations, and invalidates the public catalog cache.

## Security and persistence

Translation attribution is intentionally public metadata. The public catalog transformation preserves it while continuing to redact private EPUB paths, hashes and original filenames. No reading-state or authentication contract changes.
`);
await patch("docs/architecture/README.md",source=>replaceOnce(source,'## R4 + R4.1 Reader application','## v2.1 fan-translation provenance\n\n- [`TRANSLATION_METADATA.md`](./TRANSLATION_METADATA.md) — structured fan translator/group credits, translation status, series-to-volume inheritance, Library filtering, Series attribution, and Garden Keeper write ownership.\n\n## R4 + R4.1 Reader application','translation architecture index'));

console.log("Applied Shadow Garden v2.1 translation provenance implementation.");
