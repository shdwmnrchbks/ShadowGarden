import test from "node:test";
import assert from "node:assert/strict";

import { createPaginatedController } from "../../src/assets/js/reader/paginated.js";
import { createProgressController } from "../../src/assets/js/reader/progress-controller.js";

function classList(initial=[]){
  const values=new Set(initial);
  return{
    add(...names){names.forEach(name=>values.add(name))},
    remove(...names){names.forEach(name=>values.delete(name))},
    contains(name){return values.has(name)}
  };
}

test("paginated Next waits for an exact progress seek before handing the final page to completion", async t => {
  const previousDocument=globalThis.document,previousAnimationFrame=globalThis.requestAnimationFrame;
  const endClasses=classList(["hidden"]);
  const endPage={classList:endClasses,querySelector(){return null}};
  globalThis.document={
    body:{classList:{contains:name=>name==="reader-flow-paginated"}},
    dispatchEvent(){},
    getElementById(id){return id==="volumeEndPage"?endPage:null}
  };
  globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(Date.now()),0);
  t.after(()=>{
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
    if(previousAnimationFrame===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previousAnimationFrame;
  });

  let releaseLocations;
  const locationsGenerated=new Promise(resolve=>{releaseLocations=resolve});
  const section={href:"large-chapter.xhtml",index:0,linear:"yes"};
  const book={
    ready:Promise.resolve(),
    spine:{spineItems:[section],get(){return section}},
    locations:{
      generate(){return locationsGenerated},
      cfiFromPercentage(){return "epubcfi(/6/2!/4/200)"},
      percentageFromCfi(){return 1}
    }
  };
  const displayed=[];
  let nextCalls=0;
  const rendition={
    book,
    location:{
      start:{href:section.href,cfi:"epubcfi(/6/2!/4/2)",displayed:{page:1,total:10}},
      end:{href:section.href,cfi:"epubcfi(/6/2!/4/4)",displayed:{page:1,total:10}}
    },
    manager:{container:{scrollLeft:0,scrollTop:0},current(){return{section}}},
    async display(target){
      displayed.push(target);
      const exact=String(target).startsWith("epubcfi(");
      rendition.location={
        start:{href:section.href,cfi:exact?String(target):"epubcfi(/6/2!/4/2)",displayed:{page:exact?10:1,total:10}},
        end:{href:section.href,cfi:exact?String(target):"epubcfi(/6/2!/4/4)",displayed:{page:exact?10:1,total:10}}
      };
      rendition.manager.container.scrollLeft=exact?900:0;
    },
    async next(){nextCalls+=1},
    async prev(){}
  };
  const progress=createProgressController({
    storage:{canonicalIdentity:"fixture",saveProgress(){}},elements:{},getBook:()=>book,getRendition:()=>rendition,
    getPageMap:()=>({hasCompleteMap:()=>false,map:()=>null}),getFlow:()=>"paginated",getChapter:()=>"Large Chapter"
  });
  const paginated=createPaginatedController({getRendition:()=>rendition});

  progress.startLocationGeneration();
  const seek=progress.seekTo(1,true);
  const turn=paginated.turn(1);
  await new Promise(resolve=>setTimeout(resolve,0));

  assert.deepEqual(displayed,[section.href]);
  assert.equal(nextCalls,0,"Next must not race the pending exact seek");
  assert.equal(endClasses.contains("active"),false);

  releaseLocations();
  await Promise.all([seek,turn]);

  assert.equal(displayed.at(-1),"epubcfi(/6/2!/4/200)");
  assert.equal(nextCalls,0,"Next from the final displayed page should hand off without an extra rendition turn");
  assert.equal(endClasses.contains("hidden"),false);
  assert.equal(endClasses.contains("active"),true);
});
