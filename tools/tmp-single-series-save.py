from pathlib import Path
import json


def replace(path, old, new, count=1):
    p=Path(path)
    text=p.read_text()
    if old not in text:
        raise SystemExit(f"missing marker in {path}: {old[:180]!r}")
    p.write_text(text.replace(old,new,count))

# Series-level translation edits are collected by the translation workflow and committed by Save series.
replace("src/assets/js/admin/translation-workflow.js",
'''    function serialize(root){\n      return[...root.querySelectorAll("[data-translation-row]")].map(row=>({''',
'''    function serialize(root){\n      return[...(root?.querySelectorAll("[data-translation-row]")||[])].map(row=>({''')
replace("src/assets/js/admin/translation-workflow.js",
'''      <p class="field-note">Credit fan translators and record chapter/volume coverage. Multiple rows support hand-offs between translators.</p>\n      <div id="manageTranslations" class="keeper-translation-list"></div>\n      <div class="keeper-translation-actions"><button id="addTranslationCredit" class="admin-secondary" type="button">＋ Add translator</button><button id="saveTranslationCredits" class="admin-primary inline-button" type="button">Save translation credits</button></div>`;''',
'''      <p class="field-note">Credit fan translators and record chapter/volume coverage. Multiple rows support hand-offs between translators. Changes are saved with <strong>Save series</strong>.</p>\n      <div id="manageTranslations" class="keeper-translation-list"></div>\n      <div class="keeper-translation-actions"><button id="addTranslationCredit" class="admin-secondary" type="button">＋ Add translator</button></div>`;''')
replace("src/assets/js/admin/translation-workflow.js",
'''    async function saveSeriesCredits(){\n      const series=currentSeries();if(!series)return;\n      const button=$("#saveTranslationCredits"),old=button.textContent;button.disabled=true;button.textContent="Saving…";\n      try{\n        await client.request("/admin-api/translations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:series.id,target:"series",translationStatus:$("#manageTranslationStatus").value,translations:serialize($("#manageTranslations"))})});\n        keeper.ui.toast("Translation credits saved.");keeper.events.dispatchEvent(new Event("library:invalidate"));\n      }catch(error){alert(error.message)}finally{button.disabled=false;button.textContent=old}\n    }\n    $("#saveTranslationCredits")?.addEventListener("click",saveSeriesCredits);\n\n''',
'''    function seriesPayload(){\n      return{translationStatus:$("#manageTranslationStatus")?.value||"",translations:serialize($("#manageTranslations"))};\n    }\n\n''')
replace("src/assets/js/admin/translation-workflow.js",
'''    return{sync};''',
'''    return{sync,seriesPayload};''')

# Save series includes translation metadata in the same atomic catalog mutation.
replace("src/assets/js/admin/library-workflow.js",
'''      try{\n        const result=await client.request("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"update-series",id:state.activeSeriesId,title:$("#manageTitle").value,author:$("#manageAuthor").value,year:$("#manageYear").value,status:normalizeSeriesStatus($("#manageStatus").value),genres:$("#manageGenres").value.split(",").map(value=>value.trim()).filter(Boolean),tags:$("#manageTags").value.split(",").map(value=>value.trim()).filter(Boolean),description:$("#manageDescription").value,audioAlignedUrl:$("#manageAudioAlignedUrl").value.trim(),adult:$("#manageAdult").checked})});''',
'''      try{\n        const translationPayload=keeper.workflows.get("translations")?.instance?.seriesPayload?.()||{};\n        const result=await client.request("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"update-series",id:state.activeSeriesId,title:$("#manageTitle").value,author:$("#manageAuthor").value,year:$("#manageYear").value,status:normalizeSeriesStatus($("#manageStatus").value),genres:$("#manageGenres").value.split(",").map(value=>value.trim()).filter(Boolean),tags:$("#manageTags").value.split(",").map(value=>value.trim()).filter(Boolean),description:$("#manageDescription").value,audioAlignedUrl:$("#manageAudioAlignedUrl").value.trim(),adult:$("#manageAdult").checked,...translationPayload})});''')

# Server validates and persists translation metadata inside update-series, preserving stale clients that omit it.
replace("functions/services/catalog.js",
'''import { CANONICAL_GENRES, normalizeSeriesTaxonomy } from "../_lib/catalog-taxonomy.js";''',
'''import { CANONICAL_GENRES, normalizeSeriesTaxonomy } from "../_lib/catalog-taxonomy.js";\nimport { normalizeTranslationStatus, validateTranslationCredits } from "../_lib/translations.js";''')
replace("functions/services/catalog.js",
'''    if (action === "update-series") {\n      const audioAlignedUrl = externalUrl(input.audioAlignedUrl); if (audioAlignedUrl === null) return json({ ok: false, error: "Audio-aligned EPUB folder URL must use http:// or https://" }, 400);\n      await snapshotCatalogs(aws, data.main, data.adult, "update-series");\n      const status = normalizeSeriesStatus(input.status);''',
'''    if (action === "update-series") {\n      const audioAlignedUrl = externalUrl(input.audioAlignedUrl); if (audioAlignedUrl === null) return json({ ok: false, error: "Audio-aligned EPUB folder URL must use http:// or https://" }, 400);\n      const hasTranslationMetadata=Object.prototype.hasOwnProperty.call(input,"translationStatus")||Object.prototype.hasOwnProperty.call(input,"translations");\n      const rawTranslationStatus=hasTranslationMetadata?clean(input.translationStatus,80):"",translationStatus=hasTranslationMetadata?normalizeTranslationStatus(rawTranslationStatus):"",translationCredits=hasTranslationMetadata?validateTranslationCredits(input.translations):{ok:true,value:[]};\n      if(rawTranslationStatus&&!translationStatus)return json({ok:false,error:"Unknown translation status"},400);\n      if(!translationCredits.ok)return json({ok:false,error:translationCredits.error},400);\n      await snapshotCatalogs(aws, data.main, data.adult, "update-series");\n      const status = normalizeSeriesStatus(input.status);''')
replace("functions/services/catalog.js",
'''      series.description = clean(input.description, 12000); series.genres = taxonomy.genres; series.tags = withSeriesStatusTag(taxonomy.tags, status); series.audioAlignedUrl = audioAlignedUrl;\n      for (const volume of arr(series.volumes)) delete volume.audioAlignedUrl;''',
'''      series.description = clean(input.description, 12000); series.genres = taxonomy.genres; series.tags = withSeriesStatusTag(taxonomy.tags, status); series.audioAlignedUrl = audioAlignedUrl;\n      if(hasTranslationMetadata){if(translationStatus)series.translationStatus=translationStatus;else delete series.translationStatus;if(translationCredits.value.length)series.translations=translationCredits.value;else delete series.translations;}\n      for (const volume of arr(series.volumes)) delete volume.audioAlignedUrl;''')

# Release metadata.
pkg=Path("package.json")
data=json.loads(pkg.read_text())
data["version"]="2.3.1"
pkg.write_text(json.dumps(data,indent=2)+"\n")

changelog=Path("CHANGELOG.md")
text=changelog.read_text()
heading="# Shadow Garden Changelog\n\n"
entry="""## 2.3.1 — Unified Series Editor Save\n- Remove the redundant series-level **Save translation credits** action from Garden Keeper.\n- Save translation status and translator credits atomically with the existing **Save series** action.\n- Keep per-volume translation override saves unchanged because they belong to the individual volume editor.\n- Preserve backward compatibility for older management clients that omit translation fields.\n\n"""
if not text.startswith(heading):
    raise SystemExit("changelog heading missing")
changelog.write_text(heading+entry+text[len(heading):])
