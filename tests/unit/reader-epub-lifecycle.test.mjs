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

test('EPUB.js lifecycle compatibility patch releases manager window listeners on destroy',()=>{
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
      requireManager(){return Manager}
    }
    const epub={Rendition};

    assert.equal(installEpubLifecyclePatch(epub),true);
    assert.equal(installEpubLifecyclePatch(epub),true,'installation should be idempotent');

    const PatchedManager=new Rendition().requireManager('default');
    const manager=new PatchedManager();
    manager.addEventListeners();

    assert.equal(fakeWindow.count('unload'),1);
    assert.equal(fakeWindow.count('orientationchange'),1);
    assert.equal(scroller.count('scroll'),1);

    manager.destroy();

    assert.equal(manager.destroyed,true);
    assert.equal(fakeWindow.count('unload'),0);
    assert.equal(fakeWindow.count('orientationchange'),0);
    assert.equal(scroller.count('scroll'),0);
  }finally{
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});
