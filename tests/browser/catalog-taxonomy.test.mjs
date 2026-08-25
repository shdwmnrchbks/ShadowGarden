import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Keeper separates canonical Genres from flexible Tags and classifies EPUB subjects before upload",async()=>{
  const [html,batch,workflow]=await Promise.all([
    read("src/admin.html"),
    read("src/assets/js/admin-batch.js"),
    read("src/assets/js/admin/library-workflow.js")
  ]);
  for(const id of ["genresInput","tagsInput","manageGenres","manageTags","taxonomyMaintenanceCard"])assert.ok(html.includes(`id="${id}"`),id);
  assert.match(batch,/taxonomyPromise=import\("\/assets\/js\/domain\/catalog-taxonomy\.js"\)/);
  assert.match(batch,/classifySubjects\(rawSubjects\)/);
  assert.match(batch,/genres:item\.genres,tags:item\.tags/);
  assert.match(workflow,/genres:\$\("#manageGenres"\)\.value\.split/);
  assert.match(workflow,/\.\.\.arr\(series\.genres\),\.\.\.arr\(series\.tags\)/);
});

test("Library exposes a dedicated Genre filter while Exact Tags remain separate",async()=>{
  const [controller,model,seriesRenderer,cardRenderer]=await Promise.all([
    read("src/assets/js/library.js"),
    read("src/assets/js/library-model.js"),
    read("src/assets/js/series-renderers.js"),
    read("src/assets/js/library-renderers.js")
  ]);
  assert.match(controller,/id="genreSelect"/);
  assert.match(controller,/params\.get\("genre"\)/);
  assert.match(controller,/params\.set\("genre",state\.genre\)/);
  assert.match(controller,/Genre: \$\{state\.genre\}/);
  assert.match(model,/CANONICAL_GENRES/);
  assert.match(model,/arr\(series\?\.genres\)/);
  assert.match(seriesRenderer,/\?genre=\$\{encodeURIComponent\(value\)\}/);
  assert.match(seriesRenderer,/\?tag=\$\{encodeURIComponent\(value\)\}/);
  assert.match(cardRenderer,/arr\(series\?\.genres\)\[0\] \|\| arr\(series\?\.tags\)\[0\]/);
});

test("Garden Maintenance audits taxonomy before applying a backed-up normalization",async()=>{
  const [maintenance,catalog,html]=await Promise.all([
    read("src/assets/js/admin/maintenance-workflow.js"),
    read("functions/services/catalog.js"),
    read("src/admin.html")
  ]);
  assert.match(html,/Genre & Tag Audit/);
  assert.match(maintenance,/normalize-taxonomy/);
  assert.match(maintenance,/snapshot\?\.taxonomy\?\.affectedSeries/);
  assert.match(catalog,/catalogTaxonomyAudit/);
  assert.match(catalog,/snapshotCatalogs\(aws,data\.main,data\.adult,"normalize-catalog-taxonomy"\)/);
  assert.match(catalog,/applyCatalogTaxonomy/);
});
