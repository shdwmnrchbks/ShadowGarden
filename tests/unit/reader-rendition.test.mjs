import test from "node:test";
import assert from "node:assert/strict";

import {
  captureContinuousScrollPosition,
  restoreContinuousScrollPosition,
  stabilizeContinuousScrollLifecycle
} from "../../src/assets/js/reader/rendition.js";

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clock=()=>globalThis.performance?.now?.()||Date.now();

function continuousFixture({scrollTop=1000,contentTop=100}={}){
  const container={
    scrollTop,scrollLeft:0,clientHeight:600,clientWidth:800,scrollHeight:4000,scrollWidth:800,
    getBoundingClientRect(){return{top:100,left:20,bottom:700,right:820,height:600,width:800}}
  };
  const geometry={contentTop};
  const view={
    id:"live-view-a",index:4,section:{index:4,href:"large.xhtml"},
    element:{
      getBoundingClientRect(){
        const top=100+geometry.contentTop-container.scrollTop;
        return{top,left:20,bottom:top+2200,right:820,height:2200,width:800};
      }
    }
  };
  let cancels=0;
  const scrolled=()=>{};scrolled.cancel=()=>{cancels+=1};
  const manager={container,settings:{fullsize:false},views:{all:()=>[view]},_scrolled:scrolled};
  return{rendition:{manager},manager,container,geometry,view,cancels:()=>cancels};
}

function contentRangeFixture(){
  const fixture=continuousFixture({scrollTop:1000,contentTop:0});
  const geometry={blockTop:1120,hitTop:1410,caretTop:1410,resolvedTop:1410};
  let caretCalls=0;
  const textNode={nodeType:3,nodeValue:"Large chapter paragraph 48"};
  const block={
    nodeType:1,isConnected:true,ownerDocument:null,
    closest(selector){return selector.includes("p")?this:null},
    getBoundingClientRect(){return{top:geometry.blockTop,left:120,bottom:geometry.blockTop+120,right:700,height:120,width:580}}
  };
  const hitBlock={
    nodeType:1,isConnected:true,ownerDocument:null,
    closest(selector){return selector.includes("p")?this:null},
    getBoundingClientRect(){return{top:geometry.hitTop,left:120,bottom:geometry.hitTop+120,right:700,height:120,width:580}}
  };
  const makeRange=(kind="resolved")=>({
    kind,
    setStart(){this.kind="caret"},
    collapse(){},
    selectNodeContents(node){assert.equal(node,block);this.kind="block"},
    getBoundingClientRect(){
      const top=this.kind==="caret"?geometry.caretTop:this.kind==="block"?geometry.blockTop:geometry.resolvedTop;
      return{top,left:140,bottom:top+20,right:360,height:20,width:220};
    }
  });
  const document={
    createRange(){return makeRange()},
    elementFromPoint(){return hitBlock},
    querySelectorAll(){return[block,hitBlock]},
    caretPositionFromPoint(){caretCalls+=1;return{offsetNode:textNode,offset:5}}
  };
  block.ownerDocument=document;
  hitBlock.ownerDocument=document;
  const frame={
    clientWidth:800,clientHeight:2200,contentDocument:document,
    getBoundingClientRect(){return fixture.view.element.getBoundingClientRect()}
  };
  fixture.view.iframe=frame;
  fixture.view.document=document;
  fixture.view.section={
    index:4,href:"large.xhtml",
    cfiFromRange(range){
      assert.equal(range.kind,"block","transient CFI must describe the visible semantic block, not a browser hit-test/caret boundary");
      return"epubcfi(/6/18!/4/92,/1:0,/1:240)";
    }
  };
  fixture.view.contents={
    document,
    range(cfi){
      assert.equal(cfi,"epubcfi(/6/18!/4/92,/1:0,/1:240)");
      return makeRange("resolved");
    }
  };
  return{...fixture,contentGeometry:geometry,block,hitBlock,document,caretCalls:()=>caretCalls};
}

test("Continuous resume anchors to a live EPUB view instead of absolute scrollTop",()=>{
  const fixture=continuousFixture({scrollTop:1000,contentTop:100});
  const snapshot=captureContinuousScrollPosition(fixture.rendition);
  assert.deepEqual(snapshot,{index:4,href:"large.xhtml",id:"live-view-a",contentCfi:"",contentNode:null,top:-900,left:0,fullsize:false});

  /* Simulate Continuous trim removing 500px above the live view. EPUB.js compensates the
     container from 1000 -> 500, so the same passage still sits at -900 relative to the
     Reader. Then simulate browser resume anchoring drifting that viewport to -760. */
  fixture.geometry.contentTop=-400;
  fixture.container.scrollTop=360;
  fixture.manager.trimTimeout=setTimeout(()=>{},10_000);
  assert.equal(restoreContinuousScrollPosition(fixture.rendition,snapshot),true);
  assert.equal(fixture.container.scrollTop,500,"restore must correct relative view drift, not replay the stale 1000px scrollTop");
  assert.equal(fixture.manager.scrollTop,500);
  assert.equal(fixture.manager.prevScrollTop,500);
  assert.equal(fixture.manager.trimTimeout,0,"stale delayed trim must be cancelled before corrective scrolling");
  assert.ok(Number(fixture.manager.__sgSuppressScrollUntil)>0);
  assert.equal(fixture.cancels(),1,"pending Continuous manager work is cancelled before corrective scrolling");
});

test("Continuous resume preserves the nearest semantic block when Firefox hit-testing reports a later paragraph",()=>{
  const fixture=contentRangeFixture();
  const snapshot=captureContinuousScrollPosition(fixture.rendition);
  assert.equal(snapshot.contentCfi,"epubcfi(/6/18!/4/92,/1:0,/1:240)");
  assert.equal(snapshot.contentNode,fixture.block,"nearest rendered paragraph must win over a later elementFromPoint result");
  assert.equal(snapshot.top,120,"the visible paragraph block top is captured relative to the Reader viewport");
  assert.equal(fixture.caretCalls(),0,"geometry-resolved semantic content must win before browser caret hit-testing");

  /* Keep the original block alive while making CFI range reconstruction deliberately point
     elsewhere. Unchanged BFCache/background resume must use the surviving node geometry and
     avoid the browser-dependent CFI round-trip. */
  fixture.contentGeometry.blockTop=1290;
  fixture.contentGeometry.resolvedTop=1620;
  assert.equal(fixture.view.element.getBoundingClientRect().top,-900);
  assert.equal(restoreContinuousScrollPosition(fixture.rendition,snapshot),true);
  assert.equal(fixture.container.scrollTop,1170,"the surviving visible paragraph node must drive the correction");
  assert.equal(fixture.manager.scrollTop,1170);
});

test("Continuous resume falls back to transient content CFI after the live block detaches",()=>{
  const fixture=contentRangeFixture();
  const snapshot=captureContinuousScrollPosition(fixture.rendition);
  fixture.block.isConnected=false;
  fixture.contentGeometry.resolvedTop=1350;

  assert.equal(restoreContinuousScrollPosition(fixture.rendition,snapshot),true);
  assert.equal(fixture.container.scrollTop,1230,"a recreated/detached view must resolve the transient CFI instead of using stale DOM geometry");
  assert.equal(fixture.manager.scrollTop,1230);
});

test("Continuous resume resolves a recreated live view by section identity",()=>{
  const fixture=continuousFixture();
  const snapshot=captureContinuousScrollPosition(fixture.rendition);
  const replacement={...fixture.view,id:"replacement-view",element:fixture.view.element};
  fixture.manager.views.all=()=>[replacement];
  fixture.container.scrollTop=940;
  assert.equal(restoreContinuousScrollPosition(fixture.rendition,snapshot),true);
  assert.equal(fixture.container.scrollTop,1000,"section index keeps the anchor resolvable even when EPUB.js recreates the view object");
});

test("Continuous resume reports an expired transient view so semantic CFI can take over",()=>{
  const fixture=continuousFixture();
  const snapshot=captureContinuousScrollPosition(fixture.rendition);
  fixture.manager.views.all=()=>[];
  assert.equal(restoreContinuousScrollPosition(fixture.rendition,snapshot),false);
});

test("Continuous lifecycle suppresses manager maintenance during native resume restoration",async()=>{
  let calls=0,cancels=0;
  const original=()=>{};
  original.cancel=()=>{cancels+=1};
  const manager={
    _scrolled:original,
    scrolled(){calls+=1}
  };

  assert.equal(stabilizeContinuousScrollLifecycle({manager}),true);
  assert.equal(cancels,1,"the old debounce should be cancelled when the safe wrapper is installed");

  manager.__sgSuppressScrollUntil=clock()+120;
  manager._scrolled();
  await delay(55);
  assert.equal(calls,0,"a corrective resume scroll must not enqueue Continuous check/trim work");

  manager.__sgSuppressScrollUntil=0;
  manager._scrolled();
  await delay(55);
  assert.equal(calls,1,"normal user scrolling should resume manager maintenance after suppression expires");
});

test("Continuous lifecycle rechecks suppression before its delayed manager callback",async()=>{
  let calls=0;
  const original=()=>{};
  original.cancel=()=>{};
  const manager={
    _scrolled:original,
    scrolled(){calls+=1}
  };

  stabilizeContinuousScrollLifecycle({manager});
  manager._scrolled();
  manager.__sgSuppressScrollUntil=clock()+120;
  await delay(55);
  assert.equal(calls,0,"resume restoration that begins during the debounce window must cancel deferred manager work");
});

test("Continuous lifecycle suppresses delayed trim during the corrective resume window",async()=>{
  let trims=0;
  const original=()=>{};original.cancel=()=>{};
  const manager={
    _scrolled:original,
    trim(){trims+=1;return Promise.resolve()}
  };

  assert.equal(stabilizeContinuousScrollLifecycle({manager}),true);
  manager.__sgSuppressScrollUntil=clock()+120;
  await manager.trim();
  assert.equal(trims,0,"EPUB.js delayed trim must not undo a just-restored Continuous viewport");

  manager.__sgSuppressScrollUntil=0;
  await manager.trim();
  assert.equal(trims,1,"normal Continuous trimming must resume after the short correction window");
});
