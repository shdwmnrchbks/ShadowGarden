import test from "node:test";
import assert from "node:assert/strict";

import { createReaderResumeController } from "../../src/assets/js/reader/resume-controller.js";

class FakeEventTarget {
  constructor(){this.listeners=new Map()}
  addEventListener(type,listener){
    const list=this.listeners.get(type)||[];
    list.push(listener);this.listeners.set(type,list);
  }
  removeEventListener(type,listener){
    const list=(this.listeners.get(type)||[]).filter(item=>item!==listener);
    this.listeners.set(type,list);
  }
  dispatchEvent(event){
    for(const listener of [...(this.listeners.get(event.type)||[])])listener.call(this,event);
    return true;
  }
}

function installLifecycleGlobals(t){
  const previousDocument=globalThis.document;
  const previousWindow=globalThis.window;
  const previousAnimationFrame=globalThis.requestAnimationFrame;
  const documentTarget=new FakeEventTarget();
  documentTarget.hidden=false;
  const windowTarget=new FakeEventTarget();
  globalThis.document=documentTarget;
  globalThis.window=windowTarget;
  globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(Date.now()),0);
  t.after(()=>{
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousAnimationFrame===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previousAnimationFrame;
  });
  return{documentTarget,windowTarget};
}

function continuousRendition({top=460,viewTop=100}={}){
  const container={
    scrollTop:top,scrollLeft:0,clientHeight:600,scrollHeight:2400,clientWidth:800,scrollWidth:800,
    getBoundingClientRect(){return{top:0,left:0,bottom:600,right:800,height:600,width:800}}
  };
  const view={
    id:"live-view",index:4,section:{index:4,href:"large.xhtml"},
    element:{getBoundingClientRect(){const y=viewTop-container.scrollTop;return{top:y,left:0,bottom:y+1800,right:800,height:1800,width:800}}}
  };
  const rendition={
    manager:{container,settings:{fullsize:false},views:{all:()=>[view]}},
    async display(){throw new Error("unchanged Continuous lifecycle must not display a semantic target")}
  };
  return{rendition,container};
}

test("Continuous pagehide/pageshow never calls mutating semantic capture",async t=>{
  const {windowTarget}=installLifecycleGlobals(t);
  const {rendition,container}=continuousRendition();
  let semanticCaptures=0;
  const controller=createReaderResumeController({
    getRendition:()=>rendition,
    getFlow:()=>"scrolled-doc",
    getPosition:()=>({page:9,totalPages:30,cfi:"epubcfi(/6/18!/4/10)"}),
    getCfi:()=>"epubcfi(/6/18!/4/10)",
    capturePosition:async()=>{
      semanticCaptures+=1;
      return{page:9,totalPages:30,cfi:"epubcfi(/6/18!/4/12)"};
    },
    layoutChanged:()=>false
  });

  controller.remember();
  controller.bind();
  windowTarget.dispatchEvent({type:"pagehide",persisted:true});
  assert.equal(semanticCaptures,0,"pagehide must not call EPUB.js currentLocation in Continuous mode");

  container.scrollTop=520;
  windowTarget.dispatchEvent({type:"pageshow",persisted:true});
  await controller.wait();
  await new Promise(resolve=>setTimeout(resolve,10));

  assert.equal(container.scrollTop,460,"pageshow still restores the pre-suspend transient viewport");
  assert.equal(semanticCaptures,0,"post-resume refresh must remain mutation-free in Continuous mode");
});
