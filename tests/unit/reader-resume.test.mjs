import test from "node:test";
import assert from "node:assert/strict";

import { createReaderResumeController } from "../../src/assets/js/reader/resume-controller.js";
import { waitForRenditionNavigation } from "../../src/assets/js/reader/navigation-state.js";

function installAnimationFrame(t){
  const previous=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(Date.now()),0);
  t.after(()=>{if(previous===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previous});
}

test("resume waits for access renewal and holds navigation until the live semantic CFI is restored",async t=>{
  installAnimationFrame(t);
  let releaseRenewal;
  const renewal=new Promise(resolve=>{releaseRenewal=resolve});
  const displays=[];
  let resizeCalls=0,spreadCalls=0,pageMapTargets=0;
  const rendition={
    resize(){resizeCalls+=1},
    async display(target){displays.push(target)}
  };
  const controller=createReaderResumeController({
    getRendition:()=>rendition,getFlow:()=>"paginated",
    getPageMap:()=>({async targetForPosition(){pageMapTargets+=1;return "page:7"}}),
    getPosition:()=>({page:7,totalPages:20,cfi:"epubcfi(/6/14)"}),getCfi:()=>"epubcfi(/6/14)",
    capturePosition:async()=>({page:7,totalPages:20,cfi:"epubcfi(/6/14!/4/8)"}),
    renewAccess:()=>renewal,resizeRendition:value=>value.resize(),configureRendition:()=>{spreadCalls+=1},layoutChanged:()=>false
  });

  controller.remember();
  const restore=controller.restore();
  const barrier=waitForRenditionNavigation(rendition);
  let barrierSettled=false;
  barrier.then(()=>{barrierSettled=true});
  await new Promise(resolve=>setTimeout(resolve,0));

  assert.equal(barrierSettled,false,"navigation must remain blocked while access renewal is pending");
  assert.deepEqual(displays,[]);

  releaseRenewal();
  await Promise.all([restore,barrier]);
  assert.deepEqual(displays,["epubcfi(/6/14!/4/8)"]);
  assert.equal(pageMapTargets,0,"a valid semantic CFI must not be replaced by a device-page target");
  assert.equal(resizeCalls,1);
  assert.equal(spreadCalls,1);
});

test("Continuous resume captures the visible passage and settles twice at that CFI",async t=>{
  installAnimationFrame(t);
  const displays=[];
  let captures=0,pageMapTargets=0;
  const rendition={async display(target){displays.push(target)}};
  const controller=createReaderResumeController({
    getRendition:()=>rendition,getFlow:()=>"scrolled-doc",
    getPageMap:()=>({async targetForPosition(){pageMapTargets+=1;return "stale-page-target"}}),
    getPosition:()=>({page:9,totalPages:30,pageFraction:.4,cfi:"epubcfi(/6/18)"}),getCfi:()=>"epubcfi(/6/18)",
    capturePosition:async()=>{captures+=1;return{page:9,totalPages:30,pageFraction:.4,cfi:"epubcfi(/6/18!/4/12)"}},
    layoutChanged:()=>false
  });

  controller.remember();
  assert.equal(await controller.restore(),true);
  assert.deepEqual(displays,["epubcfi(/6/18!/4/12)","epubcfi(/6/18!/4/12)"]);
  assert.ok(captures>=1);
  assert.equal(pageMapTargets,0);
});

test("resume falls back to Page Map only when no semantic CFI exists",async t=>{
  installAnimationFrame(t);
  const displays=[];
  let pageMapTargets=0;
  const rendition={async display(target){displays.push(target)}};
  const controller=createReaderResumeController({
    getRendition:()=>rendition,getFlow:()=>"paginated",
    getPageMap:()=>({async targetForPosition(position){pageMapTargets+=1;return `page:${position.page}`}}),
    getPosition:()=>({page:5,totalPages:20,cfi:""}),getCfi:()=>"",capturePosition:async()=>({page:5,totalPages:20,cfi:""}),
    layoutChanged:()=>false
  });

  assert.equal(await controller.restore(),true);
  assert.deepEqual(displays,["page:5"]);
  assert.equal(pageMapTargets,1);
});

test("layout-changing resume keeps semantic CFI and requests a fresh Page Map",async t=>{
  installAnimationFrame(t);
  const displays=[];
  let pageMapTargets=0,refreshes=0;
  const rendition={async display(target){displays.push(target)}};
  const controller=createReaderResumeController({
    getRendition:()=>rendition,getFlow:()=>"paginated",
    getPageMap:()=>({async targetForPosition(){pageMapTargets+=1;return "stale-page-target"}}),
    getPosition:()=>({page:12,totalPages:40,cfi:"epubcfi(/6/24)"}),getCfi:()=>"epubcfi(/6/24)",
    capturePosition:async()=>({page:12,totalPages:40,cfi:"epubcfi(/6/24)"}),
    layoutChanged:()=>true,onLayoutChanged:()=>{refreshes+=1}
  });

  controller.remember();
  assert.equal(await controller.restore(),true);
  assert.deepEqual(displays,["epubcfi(/6/24)"]);
  assert.equal(pageMapTargets,0,"an old layout Page Map must not reposition an orientation-changed rendition");
  assert.equal(refreshes,1);
});
