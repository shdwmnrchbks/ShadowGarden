import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Library and Adult filters keep wrapped removable active-filter pills directly below search",async()=>{
  const [controller,mobile,css,mainHtml,adultHtml]=await Promise.all([
    read("src/assets/js/library.js"),
    read("src/assets/js/library-mobile-filter.js"),
    read("src/assets/css/library-features.css"),
    read("src/index.html"),
    read("src/nsfw.html")
  ]);

  assert.match(mainHtml,/library-mobile-filter\.js/);
  assert.match(adultHtml,/library-mobile-filter\.js/);
  assert.match(mobile,/writeCollapsed\(true\)/);
  assert.match(mobile,/mobileInitialized/);
  assert.match(mobile,/filters-collapsed/);
  assert.equal(mobile.includes("tagPicker"),false,"active pills must no longer be owned by the Exact tags group");
  assert.match(mobile,/searchField\.insertAdjacentElement\('afterend',activeTags\)/);

  for(const html of [mainHtml,adultHtml]){
    const search=html.indexOf('class="search-field"');
    const pills=html.indexOf('id="activeTags"');
    const author=html.indexOf('for="authorSelect"');
    const exactTags=html.indexOf('for="tagSelect"');
    assert.ok(search>=0&&pills>search&&author>pills,"active filter pills must sit below search and before Author");
    assert.ok(exactTags>author,"Exact tags must remain a later filter group");
  }

  const queryMarker='filterPill(`Search: ${query}`,"query"';
  const authorMarker='filterPill(`Author: ${state.author}`,"author"';
  for(const marker of [
    queryMarker,
    authorMarker,
    'filterPill(`Translator: ${state.translator}`,"translator"',
    'filterPill(`Year: ${state.year}`,"year"',
    'filterPill(`Volumes: ${labels[state.volumeRange]||state.volumeRange}`,"volumeRange"',
    'filterPill(`Reading: ${state.readingStatus==="finished"?"Finished":"Unfinished"}`,"readingStatus"',
    'filterPill("Pinned only","pinnedOnly"'
  ])assert.ok(controller.includes(marker),`missing active filter pill contract: ${marker}`);

  assert.ok(controller.indexOf(queryMarker)<controller.indexOf(authorMarker),"active search query must be the first filter pill");
  assert.match(controller,/if\(key==="query"\)state\.query=""/);
  assert.match(controller,/active-filter-pill-label/);
  assert.match(controller,/data-remove-tag/);
  assert.match(controller,/clearNamedFilter/);
  assert.match(css,/text-overflow:ellipsis/);
  assert.match(css,/active-filter-pill-label/);
  assert.match(css,/\.active-filter-tags\{display:flex;flex-wrap:wrap/);
  assert.match(css,/\.active-filter-tags \.active-filter-pill-label\{max-width:min\(68vw,250px\)\}/);
  assert.equal(css.includes(".active-filter-tags{flex-wrap:nowrap"),false,"filter pills must not return to a clipped single-row rail");
});

test("mobile Search Filter is collapsed on first paint before deferred Library initialization",async()=>{
  const [mobile,css,mainHtml,adultHtml]=await Promise.all([
    read("src/assets/js/library-mobile-filter.js"),
    read("src/assets/css/library-features.css"),
    read("src/index.html"),
    read("src/nsfw.html")
  ]);

  for(const html of [mainHtml,adultHtml]){
    assert.match(html,/class="filters filters-mobile-initial-collapsed"/);
    assert.match(html,/id="filterToggle"[^>]*aria-expanded="false"/);
    assert.equal(/id="filterToggle"[^>]*\shidden(?:\s|>)/.test(html),false,"mobile toggle must not wait on JavaScript to become visible");
  }
  assert.match(css,/@media\(min-width:721px\)\{\.mobile-filter-toggle\{display:none!important\}\}/);
  assert.match(css,/@media\(max-width:720px\)\{[\s\S]*?\.filters\.filters-mobile-initial-collapsed>\.filter-head,[^\n]*display:none!important/);
  assert.match(css,/\.filters\.filters-mobile-initial-collapsed\{display:block;gap:0\}/);
  const handoff="panel.classList.remove('filters-mobile-initial-collapsed')";
  const domainImport="await import('/assets/js/domain/index.js')";
  assert.ok(mobile.indexOf(handoff)>=0&&mobile.indexOf(handoff)<mobile.indexOf(domainImport),"first-paint marker must hand off before the async domain import");
  assert.match(mobile,/if\(mobileQuery\.matches\)\{[\s\S]*?panel\.classList\.add\('filters-collapsed'\)/);
});

test("long search text cannot widen the Search Filter panel, Search field, or selectors",async()=>{
  const css=await read("src/assets/css/library-features.css");
  assert.match(css,/\.catalog-layout,\.catalog-main,\.filters,\.filters>\*,\.search-stack,\.search-field,\.filter-group\{min-width:0;max-width:100%\}/);
  assert.match(css,/\.filters,\.search-stack,\.search-field,\.filter-group\{width:100%\}/);
  assert.match(css,/\.search-field\{overflow:hidden\}/);
  assert.match(css,/\.search-field>span\{flex:0 0 auto\}/);
  assert.match(css,/\.search-field input\{flex:1 1 0;width:0;min-width:0;max-width:100%\}/);
  assert.match(css,/\.filter-group select\{width:100%;min-width:0;max-width:100%\}/);
  assert.match(css,/\.search-stack\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:6px\}/);
  assert.match(css,/\.filters\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/@media\(max-width:980px\)\{[\s\S]*?\.filters\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(css,/@media\(max-width:720px\)\{[\s\S]*?\.filters\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/\.active-filter-tags\{display:flex;flex-wrap:wrap;gap:6px;min-width:0;max-width:100%;min-height:0\}/);
  assert.equal(css.includes(".search-field input,.filter-group select{width:100%"),false,"Search input must not claim the full flex row width alongside icon/toggle siblings");
});

test("any result filter fades Recently Added on desktop and mobile without reserving catalog space",async()=>{
  const [controller,css]=await Promise.all([
    read("src/assets/js/library.js"),
    read("src/assets/css/library-features.css")
  ]);

  assert.match(controller,/hasActiveResultFilter/);
  assert.match(controller,/state\.query\.trim\(\)/);
  assert.match(controller,/function syncResultFocus\(\)/);
  assert.match(controller,/classList\.toggle\("results-focus",hasActiveResultFilter\(\)\)/);
  assert.match(controller,/addEventListener\("input"[^\n]*syncResultFocus\(\)/);
  assert.equal(controller.includes("mobile-results-focus"),false,"result focus must not be mobile-only");
  assert.match(css,/\.recent-section\.results-focus\{[^}]*max-height:0[^}]*opacity:0/);
  assert.match(css,/\.catalog-main>\.recent-section\.results-focus\{[^}]*max-height:0[^}]*padding:0!important[^}]*min-height:0/);
  assert.match(css,/\.catalog-main>\.recent-section\.results-focus\+\.catalog-bar\{margin-top:0\}/);
  assert.match(css,/transition:opacity \.18s ease/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test("grid cards do not reserve an empty second title line on any viewport and translator matches author hierarchy",async()=>{
  const [layout,features]=await Promise.all([
    read("src/assets/css/library-layout.css"),
    read("src/assets/css/library-features.css")
  ]);
  assert.match(layout,/\.catalog-grid:not\(\.compact\) \.series-card>\.card-copy h2\{[^}]*min-height:0!important/);
  assert.equal(layout.includes("@media(min-width:721px){\n  .catalog-grid:not(.compact) .series-card>.card-copy h2"),false,"grid title spacing fix must apply to mobile too");
  assert.match(features,/\.card-translator\{[^}]*color:var\(--dim\)!important[^}]*font-weight:400!important/);
  assert.equal(features.includes(".card-translator{margin-top:-2px"),false);
  assert.equal(features.includes("color:var(--gold)!important"),false);
});
