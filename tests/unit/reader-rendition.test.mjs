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
  const geometry={rangeTop:1180};
  const textNode={nodeType:3,nodeValue:"Large chapter paragraph 46"};
  const makeRange=()=>({
    setStart(){},collapse(){},
    getBoundingClientRect(){return{top:geometry.rangeTop,left:140,bottom:geometry.rangeTop+20,right:360,height:20,width:220}}
  });
  const document={
    createRange:makeRange,
    caretPositionFromPoint(){return{offsetNode:textNode,offset:5}}
  };
  const frame={
    clientWidth:800,clientHeight:2200,contentDocument:document,
    getBoundingClientRect(){return fixture.view.element.getBoundingClientRect()}
  };
  fixture.view.iframe=frame;
  fixture.view.document=document;
  fixture.view.section={
    index:4,href:"large.xhtml",
    cfiFromRange(){return"epubcfi(/6/18!/4/92/1:5)"}
  };
  fixture.view.contents={
    document,
    range(cfi){
      assert.equal(cfi,"epubcfi(/6/18!/4/92/1:5)");
      return makeRange();
    }
  };
  return{...fixture,contentGeometry:geometry};
}

test("Continuous resume anchors to a live EPUB view instead of absolute scrollTop",()=>{
  const fixture=continuousFixture({scrollTop:1000,contentTop:100});
  const snapshot=captureContinuousScrollPosition(fixture.rendition);
  assert.deepEqual(snapshot,{index:4,href:"large.xhtml",id:"live-view-a",contentCfi:"",top:-900,left:0,fullsize:false});

  /* Simulate Continuous trim removing 500px above the live view. EPUB.js compensates the
     container from 1000 -> 500, so the same passage still sits at -900 relative to the
     Reader. Then simulate browser resume anchoring drifting that viewport to -760. */
  fixture.geometry.contentTop=-400;
  fixture.container.scrollTop=360;
  assert.equal(restoreContinuousScrollPosition(fixture.rendition,snapshot),true);
  assert.equal(fixture.container.scrollTop,500,"restore must correct relative view drift, not replay the stale 1000px scrollTop");
  assert.equal(fixture.manager.scrollTop,500);
  assert.equal(fixture.manager.prevScrollTop,500);
  assert.ok(Number(fixture.manager.__sgSuppressScrollUntil)>0);
  assert.equal(fixture.cancels(),1,"pending Continuous manager work is cancelled before corrective scrolling");
});

test("Continuous resume preserves the exact content point when a long iframe reflows internally",()=>{
  const fixture=contentRangeFixture();
  const snapshot=captureContinuousScrollPosition(fixture.rendition);
  assert.equal(snapshot.contentCfi,"epubcfi(/6/18!/4/92/1:5)");
  assert.equal(snapshot.top,180,"the visible paragraph point is captured at the Reader tracking line");

  /* The section wrapper can remain at the same outer coordinate while Firefox refreshes
     iframe content geometry. A section-only anchor sees no movement; the CFI range does. */
  fixture.contentGeometry.rangeTop=350;
  assert.equal(fixture.view.element.getBoundingClientRect().top,-900);
  assert.equal(restoreContinuousScrollPosition(fixture.rendition,snapshot),true);
  assert.equal(fixture.container.scrollTop,170,"the content CFI, not the giant chapter frame, must drive the correction");
  assert.equal(fixture.manager.scrollTop,170);
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
