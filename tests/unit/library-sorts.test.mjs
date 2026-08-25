import test from "node:test";
import assert from "node:assert/strict";

import { filterAndSort, VALID_SORTS } from "../../src/assets/js/library-model.js";

const items=[
  {id:"beta",title:"Beta",author:"Ada",year:2022,volumes:[{added:"2026-08-21"},{added:"2026-08-22"}]},
  {id:"alpha",title:"Alpha",author:"Zed",year:2024,volumes:[{added:"2026-08-24"}]},
  {id:"gamma",title:"Gamma",author:"Mira",year:2020,volumes:[{added:"2026-08-20"},{added:"2026-08-21"},{added:"2026-08-23"}]},
  {id:"undated",title:"Undated",author:"No Date",year:0,volumes:[]}
];
const state=sort=>({query:"",author:"",translator:"",genre:"",tags:new Set(),year:"",volumeRange:"",readingStatus:"",sort,pinnedOnly:false,view:"grid"});
const ids=sort=>filterAndSort(items,state(sort)).map(item=>item.id);

test("v2.4 Library sort set preserves old keys and adds explicit reverse directions",()=>{
  assert.deepEqual([...VALID_SORTS],["recent","oldest","title","title-desc","author","author-desc","year","year-asc","volumes","volumes-asc"]);
  assert.deepEqual(ids("recent"),["alpha","gamma","beta","undated"]);
  assert.deepEqual(ids("oldest"),["beta","gamma","alpha","undated"]);
  assert.deepEqual(ids("title"),["alpha","beta","gamma","undated"]);
  assert.deepEqual(ids("title-desc"),["undated","gamma","beta","alpha"]);
  assert.deepEqual(ids("author"),["beta","gamma","undated","alpha"]);
  assert.deepEqual(ids("author-desc"),["alpha","undated","gamma","beta"]);
  assert.deepEqual(ids("year"),["alpha","beta","gamma","undated"]);
  assert.deepEqual(ids("year-asc"),["gamma","beta","alpha","undated"]);
  assert.deepEqual(ids("volumes"),["gamma","beta","alpha","undated"]);
  assert.deepEqual(ids("volumes-asc"),["undated","alpha","beta","gamma"]);
});
