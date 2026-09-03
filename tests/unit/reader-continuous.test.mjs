import test from "node:test";
import assert from "node:assert/strict";

import { createContinuousController } from "../../src/assets/js/reader/continuous.js";

function installAnimationFrame(t){
  const previous=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(Date.now()),0);
  t.after(()=>{if(previous===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previous});
}

test("Continuous settled navigation requests a fresh location report after the final display paint",async t=>{
  installAnimationFrame(t);
  const calls=[];
  const rendition={
    async display(target){calls.push(`display:${target}`)},
    reportLocation(){calls.push("report")}
  };
  const controller=createContinuousController({getRendition:()=>rendition});
  const target="epubcfi(/6/12!/4/2)";

  assert.equal(await controller.display(target),true);
  assert.deepEqual(calls,[`display:${target}`,`display:${target}`,"report"]);
});

test("Continuous non-settling display leaves location reporting to the caller",async()=>{
  const calls=[];
  const rendition={
    async display(target){calls.push(`display:${target}`)},
    reportLocation(){calls.push("report")}
  };
  const controller=createContinuousController({getRendition:()=>rendition});
  const target="epubcfi(/6/12!/4/2)";

  assert.equal(await controller.display(target,{settle:false}),true);
  assert.deepEqual(calls,[`display:${target}`]);
});
