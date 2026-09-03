import test from "node:test";
import assert from "node:assert/strict";

import { displayRenditionTarget } from "../../src/assets/js/reader/rendition.js";

test("Reader retries first readable content once when a saved EPUB target is stale",async()=>{
  const calls=[];
  const rendition={
    async display(target){
      calls.push(target);
      if(target)throw new Error("No Section Found");
    }
  };
  const result=await displayRenditionTarget(rendition,"epubcfi(/6/999!/4/2/2:0)");
  assert.deepEqual(calls,["epubcfi(/6/999!/4/2/2:0)",undefined]);
  assert.deepEqual(result,{fallback:true});
});

test("Reader does not retry a first-content display failure without a saved target",async()=>{
  let calls=0;
  const rendition={async display(){calls+=1;throw new Error("No Section Found")}};
  await assert.rejects(()=>displayRenditionTarget(rendition),/No Section Found/);
  assert.equal(calls,1);
});

test("Reader preserves a hard fallback failure when both saved and first content are unreadable",async()=>{
  let calls=0;
  const rendition={
    async display(target){
      calls+=1;
      if(target)throw new Error("stale saved CFI");
      throw new Error("No readable spine section");
    }
  };
  await assert.rejects(()=>displayRenditionTarget(rendition,"epubcfi(/6/999)"),error=>{
    assert.equal(error.message,"No readable spine section");
    assert.equal(error.cause?.message,"stale saved CFI");
    return true;
  });
  assert.equal(calls,2);
});
