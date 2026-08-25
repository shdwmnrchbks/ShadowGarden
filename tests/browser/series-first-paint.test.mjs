import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=relative=>fs.readFile(new URL(`../../${relative}`,import.meta.url),"utf8");

test("Adult Series shell chooses its wine theme and back label before visible content is parsed",async()=>{
  const [html,css,controller]=await Promise.all([
    read("src/series.html"),
    read("src/assets/css/series-extra.css"),
    read("src/assets/js/series.js")
  ]);

  const scopeMarker='window.__SG_SERIES_ROUTE_ADULT__=adult';
  assert.ok(html.includes(scopeMarker),"Series entrypoint must expose its pre-paint route scope");
  assert.match(html,/id\.startsWith\("adult-"\)/);
  assert.match(html,/document\.body\.classList\.add\("adult-library"\)/);
  assert.match(html,/theme\.content="#10090c"/);
  assert.ok(html.indexOf(scopeMarker)<html.indexOf('<header class="site-header">'),"Adult scope must be applied before the visible Series header is parsed");
  assert.ok(html.indexOf(scopeMarker)<html.indexOf('class="series-loading-skeleton"'),"Adult scope must exist before the Series loading skeleton can paint");

  assert.match(html,/class="series-back-main">◀ Back to archive<\/span>/);
  assert.match(html,/class="series-back-adult">◀ Back to Adult Library<\/span>/);
  assert.match(css,/\.series-back-adult\{display:none\}/);
  assert.match(css,/\.adult-library \.series-back-main\{display:none\}/);
  assert.match(css,/\.adult-library \.series-back-adult\{display:inline\}/);

  assert.match(controller,/window\.__SG_SERIES_ROUTE_ADULT__===true/);
  assert.match(controller,/if\(back\)back\.href=domain\.urls\.libraryUrl\(adult\)/);
  assert.equal(controller.includes("back.textContent="),false,"catalog startup must not repaint the visible back label");
  assert.match(controller,/syncLibraryScope\(Boolean\(series\.nsfw\)\)/);
});
