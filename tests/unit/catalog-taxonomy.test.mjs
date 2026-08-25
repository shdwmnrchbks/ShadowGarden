import test from "node:test";
import assert from "node:assert/strict";

import * as browser from "../../src/assets/js/domain/catalog-taxonomy.js";
import * as server from "../../functions/_lib/catalog-taxonomy.js";

const expected=["Action","Adult","Adventure","Comedy","Drama","Ecchi","Fantasy","Gender Bender","Harem","Historical","Horror","Josei","Martial Arts","Mature","Mecha","Mystery","Psychological","Romance","School Life","Sci-fi","Seinen","Shoujo","Shoujo Ai","Shounen","Shounen Ai","Slice of Life","Smut","Sports","Supernatural","Tragedy","Wuxia","Xianxia","Xuanhuan","Yaoi","Yuri"];

test("browser and server taxonomy owners share the canonical Novel Updates genre vocabulary",()=>{
  assert.deepEqual(browser.CANONICAL_GENRES,expected);
  assert.deepEqual(server.CANONICAL_GENRES,expected);
  assert.equal(expected.length,35);
});

for(const [name,owner] of [["browser",browser],["server",server]]){
  test(`${name} normalizes common EPUB subject variants without duplicating genres`,()=>{
    assert.deepEqual(owner.classifySubjects(["Fiction/Fantasy/General","Fantasy","Fantasy Fiction"]),{genres:["Fantasy"],tags:[],rawSubjects:["Fiction/Fantasy/General","Fantasy","Fantasy Fiction"]});
    assert.deepEqual(owner.classifySubjects(["Science Fiction","Fiction/Romance/General"]),{genres:["Romance","Sci-fi"],tags:[],rawSubjects:["Science Fiction","Fiction/Romance/General"]});
    assert.deepEqual(owner.classifySubjects(["Fiction/Action & Adventure/General"]),{genres:["Action","Adventure"],tags:[],rawSubjects:["Fiction/Action & Adventure/General"]});
  });

  test(`${name} preserves descriptive metadata as tags while dropping generic publisher parents`,()=>{
    const value=owner.classifySubjects(["Fiction/Fantasy/Dragons & Mythical Creatures","Light Novels","Fiction","Boys Love"]);
    assert.deepEqual(value.genres,["Fantasy"]);
    assert.deepEqual(value.tags,["Dragons & Mythical Creatures","Light Novel","Boys Love"]);
    assert.equal(value.tags.includes("Fiction"),false);
    assert.equal(value.genres.includes("Yaoi"),false,"ambiguous Boys Love metadata must not be guessed as Yaoi");
  });

  test(`${name} migrates legacy mixed tags into separate genres and tags without losing unknown descriptors`,()=>{
    const value=owner.normalizeSeriesTaxonomy({tags:["Fantasy","Fiction/Fantasy/General","Complete","Web Novel","Academy"]});
    assert.deepEqual(value.genres,["Fantasy"]);
    assert.deepEqual(value.tags,["Complete","Webnovel","Academy"]);
  });
}
