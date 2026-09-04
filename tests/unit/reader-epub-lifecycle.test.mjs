import test from 'node:test';
import assert from 'node:assert/strict';
import { installEpubLifecyclePatch } from '../../src/assets/js/reader/epub-lifecycle.js';

function eventTarget(){
  const listeners=new Map();
  return{
    listeners,
    addEventListener(type,listener){
      if(!listeners.has(type))listeners.set(type,new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type,listener){listeners.get(type)?.delete(listener)},
    count(type){return listeners.get(type)?.size||0}
  };
}

function hookList(){
  const hooks=[];
  return{
    register(...items){hooks.push(...items)},
    deregister(item){const index=hooks.indexOf(item);if(index>=0)hooks.splice(index,1)},
    list(){return hooks}
  };
}

test('EPUB.js lifecycle compatibility patch releases manager listeners and rendition-owned spine hooks',()=>{
  const previousWindow=globalThis.window;
  const fakeWindow=eventTarget();
  globalThis.window=fakeWindow;

  try{
    const scroller=eventTarget();
    const orientationListener=()=>{};
    fakeWindow.addEventListener('orientationchange',orientationListener);

    class Manager{
      constructor(){
        this.settings={fullsize:false};
        this.container=scroller;
        this.stage={orientationChangeFunc:orientationListener};
        this.destroyed=false;
      }
      onScroll(){}
      addEventListeners(){throw new Error('unpatched addEventListeners called')}
      removeEventListeners(){throw new Error('unpatched removeEventListeners called')}
      destroy(){this.removeEventListeners();this.destroyed=true}
    }

    class Rendition{
      constructor(book){
        this.book=book;
        this.book.spine.hooks.content.register(this.injectIdentifier.bind(this));
        const ManagerClass=this.requireManager('default');
        this.manager=new ManagerClass();
        this.manager.addEventListeners();
        this.destroyed=false;
      }
      injectIdentifier(){}
      requireManager(){return Manager}
      destroy(){this.manager.destroy();this.book=undefined;this.destroyed=true}
    }

    class Book{
      constructor(){this.spine={hooks:{content:hookList()}}}
      renderTo(){this.rendition=new Rendition(this);return this.rendition}
    }

    // EPUB.js 0.3.93's browser bundle exposes only the coarse "0.3" API version.
    const epub={VERSION:'0.3',Rendition,Book};

    assert.equal(installEpubLifecyclePatch(epub),true);
    assert.equal(installEpubLifecyclePatch(epub),true,'installation should be idempotent');

    const book=new Book();
    const rendition=book.renderTo('viewer');

    assert.equal(book.spine.hooks.content.list().length,1,'Rendition constructor hook should be visible while live');
    assert.equal(fakeWindow.count('unload'),1);
    assert.equal(fakeWindow.count('orientationchange'),1);
    assert.equal(scroller.count('scroll'),1);

    rendition.destroy();

    assert.equal(rendition.destroyed,true);
    assert.equal(book.spine.hooks.content.list().length,0,'destroy should release the hook that roots the old Rendition');
    assert.equal(fakeWindow.count('unload'),0);
    assert.equal(fakeWindow.count('orientationchange'),0);
    assert.equal(scroller.count('scroll'),0);
  }finally{
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('EPUB.js lifecycle compatibility patch rejects an incompatible runtime API version',()=>{
  class Rendition{requireManager(){return class Manager{}}}
  class Book{renderTo(){return{}}}
  assert.equal(installEpubLifecyclePatch({VERSION:'0.4',Rendition,Book}),false);
});
