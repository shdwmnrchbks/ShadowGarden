from pathlib import Path
import json


def replace(path, old, new, count=1):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f"missing marker in {path}: {old[:160]!r}")
    p.write_text(text.replace(old,new,count))

# Keeper HTML: split Genres from free-form Tags and add audit-first maintenance controls.
replace("src/admin.html",
'''<label class="admin-field wide"><span>Genres / tags</span><input id="tagsInput" type="text" placeholder="Fantasy, Adventure, Romance"></label>''',
'''<label class="admin-field wide"><span>Genres</span><input id="genresInput" type="text" placeholder="Fantasy, Adventure, Romance"><small class="field-note">Canonical Novel Updates genres. EPUB subjects are normalized here automatically.</small></label>\n              <label class="admin-field wide"><span>Tags</span><input id="tagsInput" type="text" placeholder="Academy, Reincarnation, Light Novel"><small class="field-note">Flexible descriptive tags. Unknown EPUB subjects are preserved here for review.</small></label>''')
replace("src/admin.html",
'''<label class="admin-field wide"><span>Genres / tags</span><input id="manageTags" type="text"></label>''',
'''<label class="admin-field wide"><span>Genres</span><input id="manageGenres" type="text" placeholder="Fantasy, Romance"><small class="field-note">Restricted to Shadow Garden's canonical Novel Updates genre vocabulary.</small></label>\n          <label class="admin-field wide"><span>Tags</span><input id="manageTags" type="text" placeholder="Academy, Reincarnation, Light Novel"></label>''')
replace("src/admin.html",
'''          <section class="admin-card maintenance-card" id="backupMaintenanceCard">''',
'''          <section class="admin-card maintenance-card" id="taxonomyMaintenanceCard">\n            <div class="admin-card-head">\n              <div><span>TAXONOMY</span><h2>Genre & Tag Audit</h2></div>\n              <strong id="taxonomyMaintenanceState" class="state-pill">LOADING</strong>\n            </div>\n            <p class="maintenance-copy">Preview how legacy EPUB subjects and mixed tags map into canonical Novel Updates Genres plus flexible Tags. Unknown descriptive values are preserved.</p>\n            <div id="taxonomyMaintenanceDetail" class="maintenance-callout">Loading taxonomy audit…</div>\n            <div id="taxonomyMaintenancePreview" class="maintenance-list"></div>\n            <button id="normalizeCatalogTaxonomy" class="admin-primary" type="button">Normalize catalog taxonomy</button>\n          </section>\n\n          <section class="admin-card maintenance-card" id="backupMaintenanceCard">''')

# Upload preflight: classify raw dc:subject metadata before it reaches the editor/server.
replace("src/assets/js/admin-batch.js",
'''const inputIds=["seriesInput","volumeInput","yearInput","titleInput","authorInput","tagsInput","descriptionInput","adultInput","audioAlignedInput","translationStatusInput","translatorNameInput","translatorUrlInput","translatorCoverageInput"];''',
'''const inputIds=["seriesInput","volumeInput","yearInput","titleInput","authorInput","genresInput","tagsInput","descriptionInput","adultInput","audioAlignedInput","translationStatusInput","translatorNameInput","translatorUrlInput","translatorCoverageInput"];''')
replace("src/assets/js/admin-batch.js",
'''  const q={items:[],activeId:null,library:null,running:false,editorSync:false,objectUrl:""};\n\n  state.batch=q;''',
'''  const q={items:[],activeId:null,library:null,running:false,editorSync:false,objectUrl:""};\n  const taxonomyPromise=import("/assets/js/domain/catalog-taxonomy.js");\n\n  state.batch=q;''')
replace("src/assets/js/admin-batch.js",
'''    const description=cleanHtml(firstText(opf,"description")),tags=[...new Set(texts(opf,"subject"))];''',
'''    const description=cleanHtml(firstText(opf,"description")),rawSubjects=[...new Set(texts(opf,"subject"))];\n    const taxonomy=await taxonomyPromise,classifiedSubjects=taxonomy.classifySubjects(rawSubjects),genres=classifiedSubjects.genres,tags=classifiedSubjects.tags;''')
replace("src/assets/js/admin-batch.js",
'''return{file,title,author,date,year:parseInt(date.slice(0,4))||"",language,publisher,description,tags,series,number,coverBlob,coverExt,sha256,translations:translatorNames.slice(0,1).map(name=>({name})),validation:finish(r)};''',
'''return{file,title,author,date,year:parseInt(date.slice(0,4))||"",language,publisher,description,genres,tags,rawSubjects,series,number,coverBlob,coverExt,sha256,translations:translatorNames.slice(0,1).map(name=>({name})),validation:finish(r)};''')
replace("src/assets/js/admin-batch.js",
'''    item.author=$("#authorInput").value.trim();\n    item.tags=$("#tagsInput").value.split(",").map(x=>x.trim()).filter(Boolean);''',
'''    item.author=$("#authorInput").value.trim();\n    item.genres=$("#genresInput").value.split(",").map(x=>x.trim()).filter(Boolean);\n    item.tags=$("#tagsInput").value.split(",").map(x=>x.trim()).filter(Boolean);''')
replace("src/assets/js/admin-batch.js",
'''    $("#tagsInput").value=item.tags.join(", ");$("#descriptionInput").value=item.description;$("#adultInput").checked=item.adult;''',
'''    $("#genresInput").value=(item.genres||[]).join(", ");$("#tagsInput").value=item.tags.join(", ");$("#descriptionInput").value=item.description;$("#adultInput").checked=item.adult;''')
replace("src/assets/js/admin-batch.js",
'''adult:item.adult,series:item.series,title:item.title,author:item.author,number:item.number,year:item.year,description:item.description,tags:item.tags,''',
'''adult:item.adult,series:item.series,title:item.title,author:item.author,number:item.number,year:item.year,description:item.description,genres:item.genres,tags:item.tags,''')

# Keeper Series editor/search.
replace("src/assets/js/admin/library-workflow.js",
'''return[series.title,series.author,...arr(series.tags),...arr(series.volumes).map(volume=>volume.title)].filter(Boolean).join(" ").toLowerCase().includes(query);''',
'''return[series.title,series.author,...arr(series.genres),...arr(series.tags),...arr(series.volumes).map(volume=>volume.title)].filter(Boolean).join(" ").toLowerCase().includes(query);''')
replace("src/assets/js/admin/library-workflow.js",
'''${arr(series.tags)[0]?`<span>${esc(arr(series.tags)[0])}</span>`:""}''',
'''${(arr(series.genres)[0]||arr(series.tags)[0])?`<span>${esc(arr(series.genres)[0]||arr(series.tags)[0])}</span>`:""}''')
replace("src/assets/js/admin/library-workflow.js",
'''$("#manageStatus").value=normalizeSeriesStatus(series.status);$("#manageTags").value=arr(series.tags).join(", ");$("#manageDescription").value=series.description||"";''',
'''$("#manageStatus").value=normalizeSeriesStatus(series.status);$("#manageGenres").value=arr(series.genres).join(", ");$("#manageTags").value=arr(series.tags).join(", ");$("#manageDescription").value=series.description||"";''')
replace("src/assets/js/admin/library-workflow.js",
'''status:normalizeSeriesStatus($("#manageStatus").value),tags:$("#manageTags").value.split(",").map(value=>value.trim()).filter(Boolean),description:$("#manageDescription").value''',
'''status:normalizeSeriesStatus($("#manageStatus").value),genres:$("#manageGenres").value.split(",").map(value=>value.trim()).filter(Boolean),tags:$("#manageTags").value.split(",").map(value=>value.trim()).filter(Boolean),description:$("#manageDescription").value''')

# Server-side normalization boundary.
replace("functions/services/validation.js",
'''import { normalizeTranslationStatus, validateTranslationCredits } from "../_lib/translations.js";''',
'''import { normalizeTranslationStatus, validateTranslationCredits } from "../_lib/translations.js";\nimport { classifySubjects } from "../_lib/catalog-taxonomy.js";''')
replace("functions/services/validation.js",
'''  const rawTranslationStatus=clean(input.translationStatus,80),translationStatus=normalizeTranslationStatus(rawTranslationStatus),translationCredits=validateTranslationCredits(input.translations);''',
'''  const rawTranslationStatus=clean(input.translationStatus,80),translationStatus=normalizeTranslationStatus(rawTranslationStatus),translationCredits=validateTranslationCredits(input.translations);\n  const taxonomy=classifySubjects([...arr(input.genres).map(value=>clean(value,80)),...arr(input.tags).map(value=>clean(value,80))]);''')
replace("functions/services/validation.js",
'''rawStatus: clean(input.status, 80), incomingTags: arr(input.tags).map(value => clean(value, 80)).filter(Boolean),''',
'''rawStatus: clean(input.status, 80), incomingGenres: taxonomy.genres, incomingTags: taxonomy.tags,''')

replace("functions/services/catalog.js",
'''import { canonicalizeSeriesStatus, normalizeSeriesStatus, withSeriesStatusTag } from "../_lib/series-status.js";''',
'''import { canonicalizeSeriesStatus, normalizeSeriesStatus, withSeriesStatusTag } from "../_lib/series-status.js";\nimport { CANONICAL_GENRES, normalizeSeriesTaxonomy } from "../_lib/catalog-taxonomy.js";''')
replace("functions/services/catalog.js",
'''tags: withSeriesStatusTag(input.incomingTags, requestedStatus), cover, coverThumb,''',
'''genres: input.incomingGenres, tags: withSeriesStatusTag(input.incomingTags, requestedStatus), cover, coverThumb,''')
replace("functions/services/catalog.js",
'''        series.tags = withSeriesStatusTag([...arr(series.tags), ...input.incomingTags], series.status);''',
'''        const taxonomy = normalizeSeriesTaxonomy({ genres: [...arr(series.genres), ...input.incomingGenres], tags: [...arr(series.tags), ...input.incomingTags] });\n        series.genres = taxonomy.genres; series.tags = withSeriesStatusTag(taxonomy.tags, series.status);''')
replace("functions/services/catalog.js",
'''      series.description = clean(input.description, 12000); series.tags = withSeriesStatusTag(input.tags, status); series.audioAlignedUrl = audioAlignedUrl;''',
'''      const taxonomy = normalizeSeriesTaxonomy({ genres: input.genres, tags: input.tags });\n      series.description = clean(input.description, 12000); series.genres = taxonomy.genres; series.tags = withSeriesStatusTag(taxonomy.tags, status); series.audioAlignedUrl = audioAlignedUrl;''')

# Add audit/apply helpers just before maintenancePayload.
replace("functions/services/catalog.js",
'''async function maintenancePayload(aws) {''',
'''function catalogTaxonomyAudit(data) {\n  const changes=[];\n  for (const [scope,catalog] of [["main",data.main],["adult",data.adult]]) for (const series of arr(catalog.series)) {\n    const next=normalizeSeriesTaxonomy(series), tags=withSeriesStatusTag(next.tags,normalizeSeriesStatus(series.status));\n    const beforeGenres=arr(series.genres),beforeTags=arr(series.tags);\n    if (JSON.stringify(beforeGenres)===JSON.stringify(next.genres)&&JSON.stringify(beforeTags)===JSON.stringify(tags)) continue;\n    changes.push({scope,id:series.id||"",title:series.title||"Untitled",beforeGenres,beforeTags,genres:next.genres,tags});\n  }\n  return {canonicalGenreCount:CANONICAL_GENRES.length,totalSeries:arr(data.main.series).length+arr(data.adult.series).length,affectedSeries:changes.length,preview:changes.slice(0,30)};\n}\n\nfunction applyCatalogTaxonomy(data) {\n  let changed=0;\n  for (const catalog of [data.main,data.adult]) for (const series of arr(catalog.series)) {\n    const next=normalizeSeriesTaxonomy(series),tags=withSeriesStatusTag(next.tags,normalizeSeriesStatus(series.status));\n    if (JSON.stringify(arr(series.genres))===JSON.stringify(next.genres)&&JSON.stringify(arr(series.tags))===JSON.stringify(tags)) continue;\n    series.genres=next.genres;series.tags=tags;changed++;\n  }\n  return changed;\n}\n\nasync function maintenancePayload(aws) {''')
replace("functions/services/catalog.js",
'''return { ok: true, generatedAt: new Date().toISOString(), health: catalogHealth(data, trash), backups, trash: arr(trash.items).map(item => ({''',
'''return { ok: true, generatedAt: new Date().toISOString(), health: catalogHealth(data, trash), taxonomy: catalogTaxonomyAudit(data), backups, trash: arr(trash.items).map(item => ({''')
replace("functions/services/catalog.js",
'''    if (action === "create-backup") {''',
'''    if (action === "normalize-taxonomy") {\n      const data=await loadCatalogPair(aws),audit=catalogTaxonomyAudit(data);\n      if (!audit.affectedSeries) return json({ ...(await maintenancePayload(aws)), normalizedTaxonomy: 0 });\n      await snapshotCatalogs(aws,data.main,data.adult,"normalize-catalog-taxonomy");\n      const changed=applyCatalogTaxonomy(data);await saveCatalogPair(aws,data.main,data.adult);await invalidateCatalogCache(request);\n      return json({ ...(await maintenancePayload(aws)), normalizedTaxonomy: changed });\n    }\n    if (action === "create-backup") {''')

# Maintenance UI audit-first migration.
replace("src/assets/js/admin/maintenance-workflow.js",
'''let snapshot=null,loading=false,optimizing=false,deepChecking=false;''',
'''let snapshot=null,loading=false,optimizing=false,deepChecking=false,normalizingTaxonomy=false;''')
replace("src/assets/js/admin/maintenance-workflow.js",
'''    function renderCovers(data){''',
'''    function renderTaxonomy(data){\n      const audit=data?.taxonomy||{},stateEl=$("#taxonomyMaintenanceState"),detail=$("#taxonomyMaintenanceDetail"),preview=$("#taxonomyMaintenancePreview"),button=$("#normalizeCatalogTaxonomy"),count=Number(audit.affectedSeries)||0;\n      setPill(stateEl,count?`${count} REVIEW`:"CURRENT",count?"":"ready");\n      if(detail)detail.textContent=count?`${count} of ${audit.totalSeries||0} series will be normalized into ${audit.canonicalGenreCount||35} canonical genres plus descriptive tags. A backup is created before changes are written.`:`All ${audit.totalSeries||0} series already follow the canonical genre/tag taxonomy.`;\n      if(preview)preview.innerHTML=arr(audit.preview).map(item=>`<div class="maintenance-item"><div class="maintenance-item-copy"><strong>${safe(item.title)}</strong><span>${safe([...arr(item.beforeGenres),...arr(item.beforeTags)].join(" · ")||"No taxonomy")} → ${safe([...arr(item.genres),...arr(item.tags)].join(" · ")||"No taxonomy")}</span></div></div>`).join("")||(count?'<div class="maintenance-empty">No preview rows available.</div>':'<div class="maintenance-empty maintenance-good">No taxonomy changes are pending.</div>');\n      if(button){button.disabled=normalizingTaxonomy||!count;button.textContent=normalizingTaxonomy?"Normalizing…":count?`Normalize ${count} series`:"Taxonomy is current"}\n    }\n    function renderCovers(data){''')
replace("src/assets/js/admin/maintenance-workflow.js",
'''function render(data){snapshot=data;renderSummary(data);renderHealth(data);renderCovers(data);keeper.events.dispatchEvent(new CustomEvent("maintenance:data",{detail:{data}}))}''',
'''function render(data){snapshot=data;renderSummary(data);renderHealth(data);renderTaxonomy(data);renderCovers(data);keeper.events.dispatchEvent(new CustomEvent("maintenance:data",{detail:{data}}))}''')
replace("src/assets/js/admin/maintenance-workflow.js",
'''    async function optimizeCovers(){''',
'''    async function normalizeTaxonomy(){\n      if(normalizingTaxonomy||!snapshot?.taxonomy?.affectedSeries)return;const count=Number(snapshot.taxonomy.affectedSeries)||0;\n      if(!confirm(`Normalize genre/tag metadata for ${count} series?\\n\\nShadow Garden will create a catalog backup first. Recognized EPUB/publisher aliases move into canonical Genres; unknown descriptive values remain Tags.`))return;\n      normalizingTaxonomy=true;renderTaxonomy(snapshot);try{const result=await action("normalize-taxonomy");render(result);keeper.state.management=null;keeper.events.dispatchEvent(new Event("library:invalidate"));keeper.ui.toast(`Normalized taxonomy for ${result.normalizedTaxonomy||count} series.`)}catch(error){alert(error.message)}finally{normalizingTaxonomy=false;renderTaxonomy(snapshot)}\n    }\n\n    async function optimizeCovers(){''')
replace("src/assets/js/admin/maintenance-workflow.js",
'''$("#refreshMaintenance")?.addEventListener("click",()=>{invalidate();void load(true)});$("#deepHealthCheck")?.addEventListener("click",()=>void deepCheck());$("#optimizeLegacyCovers")?.addEventListener("click",()=>void optimizeCovers());''',
'''$("#refreshMaintenance")?.addEventListener("click",()=>{invalidate();void load(true)});$("#deepHealthCheck")?.addEventListener("click",()=>void deepCheck());$("#normalizeCatalogTaxonomy")?.addEventListener("click",()=>void normalizeTaxonomy());$("#optimizeLegacyCovers")?.addEventListener("click",()=>void optimizeCovers());''')

# Public query model.
replace("src/assets/js/library-model.js",
'''import { translationSearchTerms, translatorNames } from "./domain/translations.js";''',
'''import { translationSearchTerms, translatorNames } from "./domain/translations.js";\nimport { CANONICAL_GENRES } from "./domain/catalog-taxonomy.js";''')
replace("src/assets/js/library-model.js",
'''    ...translationSearchTerms(series),\n    ...arr(series?.tags),''',
'''    ...translationSearchTerms(series),\n    ...arr(series?.genres),\n    ...arr(series?.tags),''')
replace("src/assets/js/library-model.js",
'''  const years = new Set(items.map(series => String(series?.year || "")).filter(Boolean));\n  const tags = new Set''',
'''  const years = new Set(items.map(series => String(series?.year || "")).filter(Boolean));\n  const genres = new Set(items.flatMap(series => arr(series?.genres).map(String)));\n  const tags = new Set''')
replace("src/assets/js/library-model.js",
'''  if (state.year && !years.has(state.year)) state.year = "";\n  state.tags =''',
'''  if (state.year && !years.has(state.year)) state.year = "";\n  if (state.genre && !genres.has(state.genre)) state.genre = "";\n  state.tags =''')
replace("src/assets/js/library-model.js",
'''    if (state.translator && !translatorNames(series).includes(state.translator)) return false;\n    const seriesTags''',
'''    if (state.translator && !translatorNames(series).includes(state.translator)) return false;\n    if (state.genre && !arr(series?.genres).map(String).includes(state.genre)) return false;\n    const seriesTags''')
replace("src/assets/js/library-model.js",
'''  const tagCounts = new Map();''',
'''  const presentGenres=new Set(items.flatMap(series=>arr(series?.genres).map(String)));\n  const genres=CANONICAL_GENRES.filter(genre=>presentGenres.has(genre));\n  const tagCounts = new Map();''')
replace("src/assets/js/library-model.js",
'''return { authors, translators, years, tags, popularTags, tagCounts };''',
'''return { authors, translators, years, genres, tags, popularTags, tagCounts };''')

# Public Library controller: dedicated Genre filter/URL/pill while Exact Tags stays flexible.
replace("src/assets/js/library.js",
'''query:"",author:"",translator:"",tags:new Set(),year:""''',
'''query:"",author:"",translator:"",genre:"",tags:new Set(),year:""''')
replace("src/assets/js/library.js",
'''  function collectFilters(){\n    const options=model.filterOptions(state.items);\n    mountTranslatorFilter();''',
'''  function mountGenreFilter(){\n    if($("#genreSelect"))return;const anchor=$("#translatorSelect")?.closest(".filter-group")||$("#authorSelect")?.closest(".filter-group");if(!anchor)return;\n    const group=document.createElement("div");group.className="filter-group";group.innerHTML='<label for="genreSelect">Genre</label><select id="genreSelect"><option value="">Any genre</option></select>';anchor.after(group);\n  }\n\n  function collectFilters(){\n    const options=model.filterOptions(state.items);\n    mountTranslatorFilter();mountGenreFilter();''')
replace("src/assets/js/library.js",
'''    $("#translatorSelect").innerHTML='<option value="">Any translator</option>'+options.translators.map(translator=>`<option value="${esc(translator)}">${esc(translator)}</option>`).join("");\n    $("#yearSelect")''',
'''    $("#translatorSelect").innerHTML='<option value="">Any translator</option>'+options.translators.map(translator=>`<option value="${esc(translator)}">${esc(translator)}</option>`).join("");\n    $("#genreSelect").innerHTML='<option value="">Any genre</option>'+options.genres.map(genre=>`<option value="${esc(genre)}">${esc(genre)}</option>`).join("");\n    $("#yearSelect")''')
replace("src/assets/js/library.js",
'''    state.translator=params.get("translator")||"";\n    state.tags''',
'''    state.translator=params.get("translator")||"";\n    state.genre=params.get("genre")||"";\n    state.tags''')
replace("src/assets/js/library.js",
'''["q","author","translator","tag","year"''',
'''["q","author","translator","genre","tag","year"''')
replace("src/assets/js/library.js",
'''    if(state.translator)params.set("translator",state.translator);\n    [...state.tags]''',
'''    if(state.translator)params.set("translator",state.translator);\n    if(state.genre)params.set("genre",state.genre);\n    [...state.tags]''')
replace("src/assets/js/library.js",
'''state.query.trim()||state.author||state.translator||state.tags.size''',
'''state.query.trim()||state.author||state.translator||state.genre||state.tags.size''')
replace("src/assets/js/library.js",
'''    if(state.translator)pills.push(filterPill(`Translator: ${state.translator}`,"translator",`translator filter ${state.translator}`));\n    if(state.year)''',
'''    if(state.translator)pills.push(filterPill(`Translator: ${state.translator}`,"translator",`translator filter ${state.translator}`));\n    if(state.genre)pills.push(filterPill(`Genre: ${state.genre}`,"genre",`genre filter ${state.genre}`));\n    if(state.year)''')
replace("src/assets/js/library.js",
'''    else if(key==="translator")state.translator="";\n    else if(key==="year")''',
'''    else if(key==="translator")state.translator="";\n    else if(key==="genre")state.genre="";\n    else if(key==="year")''')
replace("src/assets/js/library.js",
'''    if($("#translatorSelect"))$("#translatorSelect").value=state.translator;\n    if($("#yearSelect"))''',
'''    if($("#translatorSelect"))$("#translatorSelect").value=state.translator;\n    if($("#genreSelect"))$("#genreSelect").value=state.genre;\n    if($("#yearSelect"))''')
replace("src/assets/js/library.js",
'''state.query="";state.author="";state.translator="";state.tags=new Set();''',
'''state.query="";state.author="";state.translator="";state.genre="";state.tags=new Set();''')
replace("src/assets/js/library.js",
'''    $("#translatorSelect")?.addEventListener("change",event=>{state.translator=event.target.value;apply({historyMode:"push"})});\n    $("#yearSelect")''',
'''    $("#translatorSelect")?.addEventListener("change",event=>{state.translator=event.target.value;apply({historyMode:"push"})});\n    $("#genreSelect")?.addEventListener("change",event=>{state.genre=event.target.value;apply({historyMode:"push"})});\n    $("#yearSelect")''')

# Public cards and Series links prefer canonical Genres.
replace("src/assets/js/library-renderers.js",
'''<div class="card-meta"><span>${series?.year || "—"}</span><span>${finished ? "Finished" : esc(arr(series?.tags)[0] || "")}</span></div>''',
'''<div class="card-meta"><span>${series?.year || "—"}</span><span>${finished ? "Finished" : esc(arr(series?.genres)[0] || arr(series?.tags)[0] || "")}</span></div>''')
replace("src/assets/js/series-renderers.js",
'''  return arr(series?.tags).map(tag => {\n    const value = String(tag || "");\n    const href = `${base}?tag=${encodeURIComponent(value)}`;\n    return `<a class="tag" href="${href}" title="Show ${esc(value)} in ${adult ? "Adult Library" : "Library"}">${esc(value)}</a>`;\n  }).join("");''',
'''  const genres=arr(series?.genres).map(genre=>{const value=String(genre||"");const href=`${base}?genre=${encodeURIComponent(value)}`;return `<a class="tag genre" href="${href}" title="Show ${esc(value)} genre in ${adult ? "Adult Library" : "Library"}">${esc(value)}</a>`});\n  const tags=arr(series?.tags).map(tag=>{const value=String(tag||"");const href=`${base}?tag=${encodeURIComponent(value)}`;return `<a class="tag" href="${href}" title="Show ${esc(value)} in ${adult ? "Adult Library" : "Library"}">${esc(value)}</a>`});\n  return [...genres,...tags].join("");''')

# Documentation indexes.
for path in ["docs/README.md","docs/architecture/README.md"]:
    p=Path(path); text=p.read_text()
    if "CATALOG_TAXONOMY.md" not in text:
        text += "\n- `architecture/CATALOG_TAXONOMY.md` — canonical Novel Updates genres, flexible tags, EPUB normalization, and audit-first migration.\n" if path=="docs/README.md" else "\n- `CATALOG_TAXONOMY.md` — canonical Novel Updates genres and catalog taxonomy ownership.\n"
        p.write_text(text)

# Release metadata.
pkg=Path("package.json"); data=json.loads(pkg.read_text()); data["version"]="2.3.0"; pkg.write_text(json.dumps(data,indent=2)+"\n")
changelog=Path("CHANGELOG.md"); text=changelog.read_text(); heading="# Shadow Garden Changelog\n\n"
entry="""## 2.3.0 — Canonical Catalog Taxonomy\n- Adopt the Novel Updates genre vocabulary as Shadow Garden's controlled 35-genre list while keeping descriptive Tags flexible.\n- Normalize EPUB `dc:subject` metadata during local preflight and again at the server catalog boundary, collapsing publisher aliases such as `Fiction/Fantasy/General` and `Fantasy Fiction` into `Fantasy`.\n- Split Garden Keeper Series/New Books metadata into separate Genres and Tags fields and add a dedicated public Genre filter/deep link.\n- Add an audit-first Garden Maintenance migration for existing catalogs; a backup is created before normalization and unknown descriptive values are preserved as Tags.\n- Add permanent browser/server taxonomy ownership and normalization tests.\n\n"""
if not text.startswith(heading): raise SystemExit("changelog heading missing")
changelog.write_text(heading+entry+text[len(heading):])
