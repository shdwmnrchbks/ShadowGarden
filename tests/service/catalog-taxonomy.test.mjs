import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCatalogVolumeInput } from "../../functions/services/validation.js";

function validInput(overrides={}){
  return{
    series:"Example Series",title:"Volume 1",epubKey:"shadow-garden/books/example.epub",
    genres:[],tags:[],...overrides
  };
}

test("catalog write validation canonicalizes mixed genre/tag input at the server boundary",()=>{
  const result=normalizeCatalogVolumeInput(validInput({
    genres:["Fantasy Fiction","Science Fiction"],
    tags:["Fiction/Fantasy/General","Light Novels","Academy","Fiction"]
  }));
  assert.equal(result.ok,true);
  assert.deepEqual(result.value.incomingGenres,["Fantasy","Sci-fi"]);
  assert.deepEqual(result.value.incomingTags,["Light Novel","Academy"]);
});

test("ambiguous descriptive metadata remains a tag instead of being guessed into a specific NU genre",()=>{
  const result=normalizeCatalogVolumeInput(validInput({tags:["Boys Love"]}));
  assert.equal(result.ok,true);
  assert.deepEqual(result.value.incomingGenres,[]);
  assert.deepEqual(result.value.incomingTags,["Boys Love"]);
});
