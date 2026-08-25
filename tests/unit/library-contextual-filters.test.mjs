import test from "node:test";
import assert from "node:assert/strict";

import { contextualFilterOptions } from "../../src/assets/js/library-model.js";

const items=[
  {id:"a",title:"A",author:"Author One",year:2025,genres:["Fantasy"],tags:["Academy"],volumes:[{title:"A1"},{title:"A2"}]},
  {id:"b",title:"B",author:"Author One",year:2026,genres:["Romance"],tags:["Academy"],volumes:[{title:"B1"}]},
  {id:"c",title:"C",author:"Author Two",year:2026,genres:["Fantasy"],tags:["Magic"],volumes:[{title:"C1"},{title:"C2"},{title:"C3"}]}
];

const state={query:"",author:"Author One",translator:"",genre:"",tags:new Set(),year:"",volumeRange:"",readingStatus:"",sort:"recent",pinnedOnly:false,view:"grid"};

test("facet counts preserve the other active filters",()=>{
  const options=contextualFilterOptions(items,state);
  assert.equal(options.genreCounts.get("Fantasy"),1);
  assert.equal(options.genreCounts.get("Romance"),1);
  assert.equal(options.yearCounts.get("2026"),1);
  assert.equal(options.authorCounts.get("Author Two"),1,"author facet clears only the author constraint while counting");
});

test("tag counts answer what adding the tag would produce",()=>{
  const options=contextualFilterOptions(items,{...state,author:"",genre:"Fantasy",tags:new Set(["Magic"])});
  assert.equal(options.tagCounts.get("Magic"),1);
  assert.equal(options.tagCounts.get("Academy"),0);
});
