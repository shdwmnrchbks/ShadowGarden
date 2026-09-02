import test from "node:test";
import assert from "node:assert/strict";

import { createReaderResumeController } from "../../src/assets/js/reader/resume-controller.js";
import { waitForRenditionNavigation } from "../../src/assets/js/reader/navigation-state.js";

function installAnimationFrame(t){
  const previous=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(Date.now()),0);
  t.after(()=>{if(previous===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previous});
}

function continuousRendition({top=0,left=0,height=600,scrollHeight=2400}={}){
  const container={scrollTop:top,scrollLeft:left,clientHeight:height,scrollHeight,clientWidth:800,scrollWidth:800};
  const displays=[];
  const rendition={manager:{container,settings:{fullsize:false}},async display(target){displays.push(target)}};
  return{rendition,container,displays};
}

test("resume waits for access renewal and holds navigation until the pre-suspend semantic CFI is restored",async t=>{
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
  await controller.capture();
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

test("Continuous unchanged-layout resume restores the exact pre-suspend native scroll without display",async t=>{
  installAnimationFrame(t);
  const {rendition,container,displays}=continuousRendition({top:460});
  let captures=0,resizeCalls=0,spreadCalls=0,pageMapTargets=0;
  const controller=createReaderResumeController({
    getRendition:()=>rendition,getFlow:()=>"scrolled-doc",
    getPageMap:()=>({async targetForPosition(){pageMapTargets+=1;return "stale-page-target"}}),
    getPosition:()=>({page:9,totalPages:30,pageFraction:.4,cfi:"epubcfi(/6/18)"}),getCfi:()=>"epubcfi(/6/18)",
    capturePosition:async()=>{captures+=1;return{page:9,totalPages:30,pageFraction:.4,cfi:"epubcfi(/6/18!/4/12)"}},
    resizeRendition:()=>{resizeCalls+=1},configureRendition:()=>{spreadCalls+=1},layoutChanged:()=>false
  });

  controller.remember();
  await controller.capture();
  container.scrollTop=520; // Browser scroll anchoring drift during pageshow.
  assert.equal(await controller.restore(),true);
  assert.equal(container.scrollTop,460,"resume must reapply the exact pre-suspend Continuous viewport");
  assert.equal(rendition.manager.scrollTop,460);
  assert.equal(rendition.manager.prevScrollTop,460);
  assert.ok(Number(rendition.manager.__sgSuppressScrollUntil)>0);
  assert.deepEqual(displays,[],"unchanged Continuous resume must not call display() and reset the section");
  assert.ok(captures>=1);
  assert.equal(resizeCalls,0);
  assert.equal(spreadCalls,0);
  assert.equal(pageMapTargets,0);
});

test("Continuous layout-changing resume ignores native pixels and settles twice at the pre-change CFI",async t=>{
  installAnimationFrame(t);
  const {rendition,container,displays}=continuousRendition({top:460});
  let captures=0,pageMapTargets=0,refreshes=0;
  const controller=createReaderResumeController({
    getRendition:()=>rendition,getFlow:()=>"scrolled-doc",
    getPageMap:()=>({async targetForPosition(){pageMapTargets+=1;return "stale-page-target"}}),
    getPosition:()=>({page:9,totalPages:30,pageFraction:.4,cfi:"epubcfi(/6/18)"}),getCfi:()=>"epubcfi(/6/18)",
    capturePosition:async()=>{captures+=1;return{page:9,totalPages:30,pageFraction:.4,cfi:"epubcfi(/6/18!/4/12)"}},
    layoutChanged:()=>true,onLayoutChanged:()=>{refreshes+=1}
  });

  controller.remember();
  await controller.capture();
  container.scrollTop=520; // New geometry invalidates the old pixel offset.
  assert.equal(await controller.restore(),true);
  assert.deepEqual(displays,["epubcfi(/6/18!/4/12)","epubcfi(/6/18!/4/12)"]);
  assert.equal(container.scrollTop,520,"layout changes must not replay stale native pixels");
  assert.ok(captures>=1);
  assert.equal(pageMapTargets,0);
  assert.equal(refreshes,1);
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

  await controller.capture();
  assert.equal(await controller.restore(),true);
  assert.deepEqual(displays,["page:5"]);
  assert.equal(pageMapTargets,1);
});

test("layout-changing resume keeps the pre-change semantic CFI and requests a fresh Page Map",async t=>{
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
  await controller.capture();
  assert.equal(await controller.restore(),true);
  assert.deepEqual(displays,["epubcfi(/6/24)"]);
  assert.equal(pageMapTargets,0,"an old layout Page Map must not reposition an orientation-changed rendition");
  assert.equal(refreshes,1);
});
